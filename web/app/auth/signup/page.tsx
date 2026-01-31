"use client";

import { useState } from "react";
import { apiFetch, setToken } from "@/lib/api";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    try {
      const data = await apiFetch<{ token: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      setToken(data.token);
      setStatus("ok");
    } catch (error) {
      setStatus("error");
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>サインアップ</h2>
      <label>
        Email
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button type="submit">アカウント作成</button>
      {status && <p>status: {status}</p>}
    </form>
  );
}
