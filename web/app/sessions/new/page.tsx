"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { SCENE_TAGS } from "@/lib/sceneTags";

export default function NewSessionPage() {
  const [worldview, setWorldview] = useState("");
  const [attribute, setAttribute] = useState("");
  const [difficulty, setDifficulty] = useState("Easy");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    try {
      const response = await apiFetch<{
        session_id: string;
        intro_text: string;
        intro_image_url: string;
        public_state: Record<string, unknown>;
        turn_limit: number;
        turns_left: number;
      }>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          worldview,
          attribute,
          difficulty,
          image_tags: selectedTags,
          image_keyword: keyword,
        }),
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      window.sessionStorage.setItem(
        `session-${response.session_id}`,
        JSON.stringify(response)
      );
      setSessionId(response.session_id);
      setStatus("ok");
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>新規セッション</h2>
      <label>
        世界観
        <input value={worldview} onChange={(event) => setWorldview(event.target.value)} />
      </label>
      <label>
        プレイヤー属性
        <input value={attribute} onChange={(event) => setAttribute(event.target.value)} />
      </label>
      <label>
        難易度
        <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
          <option value="Easy">Easy</option>
          <option value="Normal">Normal</option>
          <option value="Hard">Hard</option>
          <option value="Expert">Expert</option>
        </select>
      </label>
      <label>
        シーンタグ（複数選択）
        <div className="grid two">
          {SCENE_TAGS.map((tag) => (
            <button
              type="button"
              key={tag}
              className={selectedTags.includes(tag) ? "" : "secondary"}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </label>
      <label>
        キーワード（任意）
        <input value={keyword} onChange={(event) => setKeyword(event.target.value)} />
      </label>
      <button type="submit">セッション開始</button>
      {status && <p>status: {status}</p>}
      {sessionId && (
        <p>
          セッションID: {sessionId} - <a href={`/sessions/${sessionId}`}>移動</a>
        </p>
      )}
    </form>
  );
}
