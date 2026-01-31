import initPrompt from "../prompts/init_v1.md?raw";
import chatPrompt from "../prompts/chat_v1.md?raw";
import scorePrompt from "../prompts/score_v1.md?raw";
import guardPrompt from "../prompts/guard_v1.md?raw";

export const PROMPT_VERSIONS = {
  init: "init_v1",
  chat: "chat_v1",
  score: "score_v1",
  guard: "guard_v1",
};

const PROMPT_MAP: Record<string, string> = {
  init_v1: initPrompt,
  chat_v1: chatPrompt,
  score_v1: scorePrompt,
  guard_v1: guardPrompt,
};

export function renderPrompt(
  version: keyof typeof PROMPT_MAP,
  variables: Record<string, string>
): string {
  let template = PROMPT_MAP[version];
  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`{{${key}}}`, value);
  }
  return template;
}
