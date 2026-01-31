"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface SessionData {
  session_id: string;
  intro_text: string;
  intro_image_url: string;
  public_state: Record<string, unknown>;
  turn_limit: number;
  turns_left: number;
}

export default function GamePage({ params }: { params: { id: string } }) {
  const sessionId = params.id;
  const [session, setSession] = useState<SessionData | null>(null);
  const [inputText, setInputText] = useState("");
  const [reply, setReply] = useState("");
  const [turnsLeft, setTurnsLeft] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const cached = window.sessionStorage.getItem(`session-${sessionId}`);
    if (cached) {
      const parsed = JSON.parse(cached) as SessionData;
      setSession(parsed);
      setTurnsLeft(parsed.turns_left);
    }
  }, [sessionId]);

  const handleTurn = async () => {
    setStatus("loading");
    try {
      const response = await apiFetch<{
        reply_text: string;
        turns_left: number;
        force_submit?: boolean;
      }>(`/sessions/${sessionId}/turn`, {
        method: "POST",
        body: JSON.stringify({ mode: "free", input_text: inputText }),
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      setReply(response.reply_text);
      setTurnsLeft(response.turns_left);
      setInputText("");
      if (response.force_submit) {
        window.location.href = `/sessions/${sessionId}/submit`;
      }
      setStatus("ok");
    } catch (error) {
      setStatus("error");
    }
  };

  if (!session) {
    return (
      <section className="card">
        <p>セッション情報を保持していません。/sessions/newから再生成してください。</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>ゲーム進行</h2>
      <p>残り回数: {turnsLeft ?? session.turns_left}</p>
      <img src={session.intro_image_url} alt="intro" style={{ width: "100%", borderRadius: 12 }} />
      <pre style={{ whiteSpace: "pre-wrap" }}>{session.intro_text}</pre>
      <label>
        質問
        <textarea value={inputText} onChange={(event) => setInputText(event.target.value)} />
      </label>
      <button type="button" onClick={handleTurn}>
        送信
      </button>
      {status && <p>status: {status}</p>}
      {reply && (
        <div className="card">
          <strong>返答</strong>
          <p>{reply}</p>
        </div>
      )}
    </section>
  );
}
