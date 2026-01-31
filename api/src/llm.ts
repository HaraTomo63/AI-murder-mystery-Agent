import { renderPrompt } from "./prompts";
import { Env } from "./types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

async function openAiRequest(
  env: Env,
  model: string,
  prompt: string
): Promise<string> {
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function runInitPrompt(env: Env, variables: Record<string, string>) {
  const prompt = renderPrompt("init_v1", variables);
  return openAiRequest(env, "gpt-4.1", prompt);
}

export async function runChatPrompt(env: Env, variables: Record<string, string>) {
  const prompt = renderPrompt("chat_v1", variables);
  return openAiRequest(env, "gpt-4.1-mini", prompt);
}

export async function runScorePrompt(env: Env, variables: Record<string, string>) {
  const prompt = renderPrompt("score_v1", variables);
  return openAiRequest(env, "gpt-4.1", prompt);
}

export async function runGuardPrompt(env: Env, text: string) {
  const prompt = renderPrompt("guard_v1", { text });
  return openAiRequest(env, "gpt-4.1-mini", prompt);
}

export async function generateGeminiImage(
  env: Env,
  tags: string[],
  keyword: string
): Promise<ArrayBuffer> {
  const prompt = `cinematic illustration, semi-realistic, no text, no gore, wide shot, people allowed but not close-up faces, emphasize environment and objects, ${tags.join(
    ", "
  )}, keyword: ${keyword}`;
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        prompt,
        sampleCount: 1,
        aspectRatio: "16:9",
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Gemini error: ${response.status}`);
  }
  const data = await response.json();
  const base64 = data?.images?.[0]?.image ?? "";
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}
