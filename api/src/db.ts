import { D1Database } from "@cloudflare/workers-types";
import { nowIso } from "./utils";

export async function getIdempotentResponse(
  db: D1Database,
  userId: string,
  endpoint: string,
  key: string
) {
  const { results } = await db
    .prepare(
      "SELECT response_json FROM idempotency WHERE user_id = ? AND endpoint = ? AND key = ?"
    )
    .bind(userId, endpoint, key)
    .all();
  return results?.[0]?.response_json ?? null;
}

export async function setIdempotentResponse(
  db: D1Database,
  userId: string,
  endpoint: string,
  key: string,
  response: unknown
) {
  await db
    .prepare(
      "INSERT INTO idempotency (user_id, endpoint, key, response_json, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(userId, endpoint, key, JSON.stringify(response), nowIso())
    .run();
}
