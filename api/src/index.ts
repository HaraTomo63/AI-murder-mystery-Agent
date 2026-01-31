import { createToken, hashPassword, newMessageId, newSeed, newSessionId, newUserId, passwordMatches, timestamp, verifyToken } from "./auth";
import { getIdempotentResponse, setIdempotentResponse } from "./db";
import { runChatPrompt, runGuardPrompt, runInitPrompt, runScorePrompt, generateGeminiImage } from "./llm";
import { PROMPT_VERSIONS } from "./prompts";
import { AbuseFlags, Difficulty, Env, PublicState } from "./types";
import { detectAbuse, difficultyConfig, jsonResponse, sanitizeKeyword, worldExplainNeeded, nowIso } from "./utils";

const FINALIZE_MESSAGE = "捜査時間が尽きた。今ある手がかりで真相を示してくれ。";
const GUARD_FALLBACK_MESSAGE = "沈黙が落ちる。今はそれ以上語るべき時ではない。";
const ABUSE_THRESHOLD = 3;

function getIdempotencyKey(request: Request) {
  return request.headers.get("Idempotency-Key");
}

async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  return JSON.parse(text) as T;
}

async function requireAuth(request: Request, env: Env) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const payload = await verifyToken(env.JWT_SECRET, token);
  if (!payload?.user_id) return null;
  return payload as { user_id: string };
}

function extractJsonAndText(content: string) {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  const jsonText = jsonMatch[0];
  const introText = content.replace(jsonText, "").trim();
  return { jsonText, introText };
}

async function guardText(env: Env, text: string): Promise<boolean> {
  try {
    const guardRaw = await runGuardPrompt(env, text);
    const guard = JSON.parse(guardRaw);
    return Array.isArray(guard.violations) && guard.violations.length > 0;
  } catch {
    return false;
  }
}

async function rateLimitCheck(env: Env, sessionId: string): Promise<boolean> {
  const { results } = await env.DB.prepare(
    "SELECT created_at FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 1"
  )
    .bind(sessionId)
    .all();
  const last = results?.[0]?.created_at;
  if (!last) return true;
  const delta = Date.now() - new Date(last).getTime();
  return delta >= 1500;
}

async function updateAbuseScore(env: Env, sessionId: string, flags: AbuseFlags) {
  const scoreDelta = Object.values(flags).filter(Boolean).length;
  if (scoreDelta === 0) return;
  await env.DB.prepare(
    "UPDATE sessions SET abuse_score = abuse_score + ?, updated_at = ? WHERE id = ?"
  )
    .bind(scoreDelta, nowIso(), sessionId)
    .run();
}

async function getSession(env: Env, sessionId: string) {
  const { results } = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?")
    .bind(sessionId)
    .all();
  return results?.[0] ?? null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/auth/signup" && request.method === "POST") {
      const idemKey = getIdempotencyKey(request);
      if (!idemKey) return jsonResponse({ error: "idempotency required" }, 400);
      const body = await readJson<{ email: string; password: string }>(request);
      const userId = newUserId();
      const passwordHash = await hashPassword(body.password);
      const now = timestamp();
      await env.DB.prepare(
        "INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(userId, body.email, passwordHash, now, now)
        .run();
      const token = await createToken(env.JWT_SECRET, { user_id: userId });
      const response = { token };
      await setIdempotentResponse(env.DB, userId, path, idemKey, response);
      return jsonResponse(response);
    }

    if (path === "/auth/login" && request.method === "POST") {
      const idemKey = getIdempotencyKey(request);
      if (!idemKey) return jsonResponse({ error: "idempotency required" }, 400);
      const body = await readJson<{ email: string; password: string }>(request);
      const { results } = await env.DB.prepare(
        "SELECT id, password_hash FROM users WHERE email = ?"
      )
        .bind(body.email)
        .all();
      const user = results?.[0];
      if (!user || !(await passwordMatches(user.password_hash, body.password))) {
        return jsonResponse({ error: "invalid" }, 401);
      }
      const token = await createToken(env.JWT_SECRET, { user_id: user.id });
      const response = { token };
      await setIdempotentResponse(env.DB, user.id, path, idemKey, response);
      return jsonResponse(response);
    }

    if (path === "/me" && request.method === "GET") {
      const auth = await requireAuth(request, env);
      if (!auth) return jsonResponse({ error: "unauthorized" }, 401);
      const { results } = await env.DB.prepare(
        "SELECT id, email, nickname FROM users WHERE id = ?"
      )
        .bind(auth.user_id)
        .all();
      return jsonResponse(results?.[0] ?? null);
    }

    if (path === "/me/nickname" && request.method === "PUT") {
      const auth = await requireAuth(request, env);
      if (!auth) return jsonResponse({ error: "unauthorized" }, 401);
      const body = await readJson<{ nickname: string }>(request);
      await env.DB.prepare("UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?")
        .bind(body.nickname, nowIso(), auth.user_id)
        .run();
      return jsonResponse({ ok: true });
    }

    if (path === "/sessions" && request.method === "POST") {
      const auth = await requireAuth(request, env);
      if (!auth) return jsonResponse({ error: "unauthorized" }, 401);
      const idemKey = getIdempotencyKey(request);
      if (!idemKey) return jsonResponse({ error: "idempotency required" }, 400);
      const cached = await getIdempotentResponse(env.DB, auth.user_id, path, idemKey);
      if (cached) return jsonResponse(JSON.parse(cached));

      const body = await readJson<{
        worldview: string;
        attribute: string;
        difficulty: Difficulty;
        image_tags: string[];
        image_keyword?: string;
      }>(request);

      const difficultyConfigValue = difficultyConfig(body.difficulty);
      const seed = newSeed();
      const worldExplain = worldExplainNeeded(body.worldview);

      const promptVars = {
        nickname: "プレイヤー",
        worldview: body.worldview,
        player_attribute: body.attribute,
        difficulty: body.difficulty,
        suspect_count: String(difficultyConfigValue.suspectCount),
        world_explain_needed: String(worldExplain),
        image_tags: JSON.stringify(body.image_tags),
        image_keyword: sanitizeKeyword(body.image_keyword),
      };

      const initRaw = await runInitPrompt(env, promptVars);
      const extracted = extractJsonAndText(initRaw);
      if (!extracted) return jsonResponse({ error: "init_parse" }, 500);
      const initJson = JSON.parse(extracted.jsonText);
      const introText = extracted.introText;

      const publicState: PublicState = {
        visible_evidence: initJson.truth_table.public_state_seed.visible_evidence || [],
        initial_statements: initJson.truth_table.public_state_seed.initial_statements || {},
        discoverables: [],
      };

      const sessionId = newSessionId();
      const now = nowIso();
      await env.DB.prepare(
        "INSERT INTO sessions (id, user_id, difficulty, turn_limit, turns_used, status, seed, worldview_text, attribute_text, prompt_version_init, prompt_version_chat, prompt_version_score, intro_image_url, truth_table_json, public_state_json, abuse_score, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          sessionId,
          auth.user_id,
          body.difficulty,
          difficultyConfigValue.turnLimit,
          0,
          "active",
          seed,
          body.worldview,
          body.attribute,
          PROMPT_VERSIONS.init,
          PROMPT_VERSIONS.chat,
          PROMPT_VERSIONS.score,
          "",
          JSON.stringify(initJson.truth_table),
          JSON.stringify(publicState),
          0,
          now,
          now
        )
        .run();

      const keyword = initJson.image_hints?.keyword_suggested || sanitizeKeyword(body.image_keyword);
      const tags = initJson.image_hints?.tags_suggested?.length
        ? initJson.image_hints.tags_suggested
        : body.image_tags;
      const imageBuffer = await generateGeminiImage(env, tags, keyword);
      const imageKey = `intro/${sessionId}.png`;
      await env.R2_BUCKET.put(imageKey, imageBuffer, {
        httpMetadata: { contentType: "image/png" },
      });
      const introImageUrl = `https://r2.example.com/${imageKey}`;
      await env.DB.prepare("UPDATE sessions SET intro_image_url = ?, updated_at = ? WHERE id = ?")
        .bind(introImageUrl, nowIso(), sessionId)
        .run();

      const response = {
        session_id: sessionId,
        intro_text: introText,
        intro_image_url: introImageUrl,
        public_state: publicState,
        turn_limit: difficultyConfigValue.turnLimit,
        turns_left: difficultyConfigValue.turnLimit,
      };
      await setIdempotentResponse(env.DB, auth.user_id, path, idemKey, response);
      return jsonResponse(response);
    }

    if (path.startsWith("/sessions/") && path.endsWith("/turn") && request.method === "POST") {
      const auth = await requireAuth(request, env);
      if (!auth) return jsonResponse({ error: "unauthorized" }, 401);
      const idemKey = getIdempotencyKey(request);
      if (!idemKey) return jsonResponse({ error: "idempotency required" }, 400);
      const cached = await getIdempotentResponse(env.DB, auth.user_id, path, idemKey);
      if (cached) return jsonResponse(JSON.parse(cached));

      const sessionId = path.split("/")[2];
      const session = await getSession(env, sessionId);
      if (!session || session.user_id !== auth.user_id) {
        return jsonResponse({ error: "not_found" }, 404);
      }
      if (session.status !== "active") {
        return jsonResponse({ error: "invalid_status" }, 409);
      }
      const turnsLeft = session.turn_limit - session.turns_used;
      if (turnsLeft <= 0) {
        const response = {
          reply_text: FINALIZE_MESSAGE,
          public_state: JSON.parse(session.public_state_json),
          turns_left: 0,
          force_submit: true,
        };
        await setIdempotentResponse(env.DB, auth.user_id, path, idemKey, response);
        return jsonResponse(response);
      }

      const rateOk = await rateLimitCheck(env, sessionId);
      if (!rateOk) return jsonResponse({ error: "rate_limited" }, 429);

      const body = await readJson<{ mode: "free" | "choice"; input_text?: string }>(request);
      const playerInput = body.input_text ?? "";

      const lastMessage = await env.DB.prepare(
        "SELECT input_hash FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 1"
      )
        .bind(sessionId)
        .first();

      const abuse = detectAbuse(playerInput, lastMessage?.input_hash as string | undefined);
      await updateAbuseScore(env, sessionId, abuse.flags);

      const updatedSession = await getSession(env, sessionId);
      const abuseScore = updatedSession?.abuse_score ?? 0;
      const publicState = JSON.parse(session.public_state_json);

      if (abuseScore >= ABUSE_THRESHOLD) {
        await env.DB.prepare("UPDATE sessions SET turns_used = turn_limit, updated_at = ? WHERE id = ?")
          .bind(nowIso(), sessionId)
          .run();
        const response = {
          reply_text: FINALIZE_MESSAGE,
          public_state: publicState,
          turns_left: 0,
          force_submit: true,
        };
        await setIdempotentResponse(env.DB, auth.user_id, path, idemKey, response);
        return jsonResponse(response);
      }

      const chatVars = {
        nickname: "プレイヤー",
        worldview_short: session.worldview_text,
        player_attribute_short: session.attribute_text,
        difficulty: session.difficulty,
        turns_left: String(turnsLeft),
        time_pressure: String(turnsLeft <= 3),
        abuse_flags: JSON.stringify(abuse.flags),
        public_state: JSON.stringify(publicState),
        target_npc: "",
        last_messages_short: "",
        player_input: playerInput,
      };

      let replyText = "";
      try {
        const raw = await runChatPrompt(env, chatVars);
        const parsed = JSON.parse(raw);
        replyText = parsed.reply_text ?? "";
      } catch {
        replyText = GUARD_FALLBACK_MESSAGE;
      }

      const violated = await guardText(env, replyText);
      if (violated) {
        replyText = GUARD_FALLBACK_MESSAGE;
      }

      await env.DB.prepare(
        "INSERT INTO messages (id, session_id, role, content, created_at, input_hash, abuse_flags_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          newMessageId(),
          sessionId,
          "assistant",
          replyText,
          nowIso(),
          abuse.hash,
          JSON.stringify(abuse.flags)
        )
        .run();

      await env.DB.prepare("UPDATE sessions SET turns_used = turns_used + 1, updated_at = ? WHERE id = ?")
        .bind(nowIso(), sessionId)
        .run();

      const response = {
        reply_text: replyText,
        public_state: publicState,
        turns_left: turnsLeft - 1,
        phase_hint: turnsLeft - 1 <= 0 ? "submit" : undefined,
      };
      await setIdempotentResponse(env.DB, auth.user_id, path, idemKey, response);
      return jsonResponse(response);
    }

    if (path.startsWith("/sessions/") && path.endsWith("/submit") && request.method === "POST") {
      const auth = await requireAuth(request, env);
      if (!auth) return jsonResponse({ error: "unauthorized" }, 401);
      const idemKey = getIdempotencyKey(request);
      if (!idemKey) return jsonResponse({ error: "idempotency required" }, 400);
      const cached = await getIdempotentResponse(env.DB, auth.user_id, path, idemKey);
      if (cached) return jsonResponse(JSON.parse(cached));

      const sessionId = path.split("/")[2];
      const body = await readJson<{ culprit: string; logic_text: string }>(request);
      await env.DB.prepare(
        "INSERT INTO submissions (session_id, culprit, logic_text, created_at) VALUES (?, ?, ?, ?)"
      )
        .bind(sessionId, body.culprit, body.logic_text, nowIso())
        .run();
      await env.DB.prepare("UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?")
        .bind("submitted", nowIso(), sessionId)
        .run();
      const response = { ok: true };
      await setIdempotentResponse(env.DB, auth.user_id, path, idemKey, response);
      return jsonResponse(response);
    }

    if (path.startsWith("/sessions/") && path.endsWith("/score") && request.method === "POST") {
      const auth = await requireAuth(request, env);
      if (!auth) return jsonResponse({ error: "unauthorized" }, 401);
      const idemKey = getIdempotencyKey(request);
      if (!idemKey) return jsonResponse({ error: "idempotency required" }, 400);
      const cached = await getIdempotentResponse(env.DB, auth.user_id, path, idemKey);
      if (cached) return jsonResponse(JSON.parse(cached));

      const sessionId = path.split("/")[2];
      const session = await getSession(env, sessionId);
      const submission = await env.DB.prepare(
        "SELECT culprit, logic_text FROM submissions WHERE session_id = ?"
      )
        .bind(sessionId)
        .first();
      if (!session || !submission) return jsonResponse({ error: "not_found" }, 404);

      const scoreVars = {
        truth_table_json: session.truth_table_json,
        player_submit: JSON.stringify(submission),
      };
      const scoreRaw = await runScorePrompt(env, scoreVars);
      const scoreJson = JSON.parse(scoreRaw);

      const shareImageUrl = session.intro_image_url;
      await env.DB.prepare(
        "INSERT INTO results (session_id, score_total, breakdown_json, grade, result_text, share_image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          sessionId,
          scoreJson.score_total,
          JSON.stringify(scoreJson.breakdown),
          scoreJson.grade,
          scoreJson.result_text,
          shareImageUrl,
          nowIso()
        )
        .run();
      await env.DB.prepare("UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?")
        .bind("scored", nowIso(), sessionId)
        .run();

      const response = {
        score_total: scoreJson.score_total,
        breakdown: scoreJson.breakdown,
        grade: scoreJson.grade,
        result_text: scoreJson.result_text,
        share_image_url: shareImageUrl,
      };
      await setIdempotentResponse(env.DB, auth.user_id, path, idemKey, response);
      return jsonResponse(response);
    }

    if (path === "/history" && request.method === "GET") {
      const auth = await requireAuth(request, env);
      if (!auth) return jsonResponse({ error: "unauthorized" }, 401);
      const { results } = await env.DB.prepare(
        "SELECT sessions.id as session_id, results.score_total, results.grade, results.share_image_url, sessions.created_at FROM sessions LEFT JOIN results ON sessions.id = results.session_id WHERE sessions.user_id = ? ORDER BY sessions.created_at DESC"
      )
        .bind(auth.user_id)
        .all();
      return jsonResponse({ history: results ?? [] });
    }

    return jsonResponse({ error: "not_found" }, 404);
  },
};
