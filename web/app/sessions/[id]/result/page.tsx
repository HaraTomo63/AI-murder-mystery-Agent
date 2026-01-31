"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface ResultData {
  score_total: number;
  breakdown: Record<string, number>;
  grade: string;
  result_text: string;
  share_image_url: string;
}

export default function ResultPage({ params }: { params: { id: string } }) {
  const sessionId = params.id;
  const [result, setResult] = useState<ResultData | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const load = async () => {
      setStatus("loading");
      try {
        const response = await apiFetch<ResultData>(`/sessions/${sessionId}/score`, {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
        });
        setResult(response);
        setStatus("ok");
      } catch (error) {
        setStatus("error");
      }
    };
    load();
  }, [sessionId]);

  if (!result) {
    return (
      <section className="card">
        <p>Result loading... {status}</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>結果</h2>
      <p>Score: {result.score_total}</p>
      <p>Grade: {result.grade}</p>
      <p>{result.result_text}</p>
      <pre>{JSON.stringify(result.breakdown, null, 2)}</pre>
      <img src={result.share_image_url} alt="share" style={{ width: "100%", borderRadius: 12 }} />
    </section>
  );
}
