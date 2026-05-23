import type { LLMCompleteResult, LLMStreamChunk, LLMUsage } from "../types.js";
import { getStringField } from "./ndjson.js";

interface GeminiJsonOutput {
  response?: string;
  stats?: {
    duration_ms?: number;
  };
  error?: { message?: string };
}

function extractGeminiMessageText(event: Record<string, unknown>): string | undefined {
  const message = event.message;
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    return undefined;
  }
  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    let text = "";
    for (const part of content) {
      if (typeof part === "string") {
        text += part;
      } else if (part !== null && typeof part === "object" && !Array.isArray(part)) {
        const t = (part as Record<string, unknown>).text;
        if (typeof t === "string") {
          text += t;
        }
      }
    }
    return text.length > 0 ? text : undefined;
  }
  return undefined;
}

export function parseGeminiJsonOutput(stdout: string): LLMCompleteResult {
  const parsed = JSON.parse(stdout.trim()) as GeminiJsonOutput;
  if (parsed.error?.message) {
    throw new Error(parsed.error.message);
  }
  const usage: LLMUsage | undefined = parsed.stats?.duration_ms
    ? { durationMs: parsed.stats.duration_ms }
    : undefined;
  return {
    text: parsed.response ?? "",
    usage,
    raw: parsed,
  };
}

export function* mapGeminiStreamEvent(
  event: Record<string, unknown>,
  state: { lastAssistantText: string },
): Generator<LLMStreamChunk> {
  const type = getStringField(event, "type");

  if (type === "message") {
    const role =
      event.message !== null &&
      typeof event.message === "object" &&
      !Array.isArray(event.message)
        ? getStringField(event.message as Record<string, unknown>, "role")
        : undefined;
    if (role === "assistant" || role === undefined) {
      const text = extractGeminiMessageText(event) ?? "";
      if (text.length > 0) {
        const delta = text.startsWith(state.lastAssistantText)
          ? text.slice(state.lastAssistantText.length)
          : text;
        if (delta.length > 0) {
          state.lastAssistantText = text;
          yield { type: "text-delta", text: delta };
        }
      }
    }
    return;
  }

  if (type === "tool_use") {
    const name = getStringField(event, "name") ?? "tool";
    const id = getStringField(event, "id");
    yield { type: "tool-start", name, id, args: event.arguments };
    return;
  }

  if (type === "tool_result") {
    const name = getStringField(event, "name") ?? "tool";
    const id = getStringField(event, "id");
    yield { type: "tool-end", name, id, result: event.output };
    return;
  }

  if (type === "result") {
    const text =
      getStringField(event, "response") ??
      (typeof event.response === "string" ? event.response : state.lastAssistantText);
    const usage: LLMUsage | undefined =
      typeof event.duration_ms === "number"
        ? { durationMs: event.duration_ms }
        : undefined;
    yield {
      type: "done",
      result: {
        text,
        sessionId: getStringField(event, "session_id"),
        usage,
        raw: event,
      },
    };
    return;
  }

  if (type === "error") {
    const message =
      getStringField(event, "message") ?? getStringField(event, "error") ?? "Gemini CLI error";
    yield { type: "error", message, cause: event };
  }
}
