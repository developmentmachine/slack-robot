import type { LLMMessage } from "./types.js";

/**
 * Flatten chat messages into a single prompt for headless CLI.
 * CLIs take one-shot prompts; multi-turn is encoded in text.
 */
export function messagesToPrompt(messages: LLMMessage[]): string {
  if (messages.length === 0) {
    throw new Error("messagesToPrompt: at least one message is required");
  }

  const parts: string[] = [];
  for (const message of messages) {
    const label =
      message.role === "system"
        ? "System"
        : message.role === "user"
          ? "User"
          : "Assistant";
    parts.push(`${label}:\n${message.content.trim()}`);
  }

  parts.push(
    "\n---\nReply as the Assistant. Follow the System instructions if any. Do not repeat the conversation labels.",
  );

  return parts.join("\n\n");
}

/** Extract trailing user instruction when system prompt is provided separately. */
export function appendSystemPrompt(
  systemPrompt: string,
  messages: LLMMessage[],
): LLMMessage[] {
  const withoutSystem = messages.filter((m) => m.role !== "system");
  return [{ role: "system", content: systemPrompt }, ...withoutSystem];
}
