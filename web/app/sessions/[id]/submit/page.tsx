"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

export default function SubmitPage({ params }: { params: { id: string } }) {
  const sessionId = params.id;
  const [culprit, setCulprit] = useState("");
  const [logic, setLogic] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    try {
      await apiFetch(`/sessions/${sessionId}/submit`, {
        method: "POST",
        body: JSON.stringify({ culprit, logic_text: logic }),
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      setStatus("ok");
      window.location.href = `/sessions/${sessionId}/result`;
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>提出</h2>
      <label>
        犯人
        <input value={culprit} onChange={(event) => setCulprit(event.target.value)} />
      </label>
      <label>
        矛盾立証
        <textarea value={logic} onChange={(event) => setLogic(event.target.value)} />
      </label>
      <button type="submit">提出</button>
      {status && <p>status: {status}</p>}
    </form>
  );
}
