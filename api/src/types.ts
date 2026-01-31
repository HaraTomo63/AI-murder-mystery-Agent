export type Difficulty = "Easy" | "Normal" | "Hard" | "Expert";

export interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  JWT_SECRET: string;
  OPENAI_API_KEY: string;
  GEMINI_API_KEY: string;
}

export interface AbuseFlags {
  prompt_injection: boolean;
  spam: boolean;
  repetitive: boolean;
  too_long: boolean;
}

export interface PublicState {
  visible_evidence: string[];
  initial_statements: Record<string, string>;
  discoverables?: string[];
}
