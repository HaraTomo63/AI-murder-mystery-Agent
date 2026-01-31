"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface HistoryItem {
  session_id: string;
  score_total: number;
  grade: string;
  share_image_url: string;
  created_at: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const load = async () => {
      setStatus("loading");
      try {
        const response = await apiFetch<{ history: HistoryItem[] }>("/history");
        setHistory(response.history);
        setStatus("ok");
      } catch (error) {
        setStatus("error");
      }
    };
    load();
  }, []);

  return (
    <section className="card">
      <h2>履歴</h2>
      {status && <p>status: {status}</p>}
      <ul>
        {history.map((item) => (
          <li key={item.session_id}>
            <strong>{item.grade}</strong> {item.score_total} - {item.created_at}
            {item.share_image_url && (
              <div>
                <img
                  src={item.share_image_url}
                  alt="share"
                  style={{ width: "100%", borderRadius: 12 }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
