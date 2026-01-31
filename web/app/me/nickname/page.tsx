"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function NicknamePage() {
  const [nickname, setNickname] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    try {
      await apiFetch("/me/nickname", {
        method: "PUT",
        body: JSON.stringify({ nickname }),
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      setStatus("ok");
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>ニックネーム設定</h2>
      <label>
        Nickname
        <input value={nickname} onChange={(event) => setNickname(event.target.value)} />
      </label>
      <button type="submit">保存</button>
      {status && <p>status: {status}</p>}
    </form>
  );
}
