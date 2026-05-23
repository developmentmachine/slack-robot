import type { LLMCompleteResult, LLMStreamChunk, LLMUsage } from "../types.js";
import { getStringField } from "./ndjson.js";

interface CursorResultEvent {
  type: "result";
  subtype?: string;
  is_error?: boolean;
  result?: string;
  session_id?: string;
  duration_ms?: number;
  duration_api_ms?: number;
}

function extractAssistantText(event: Record<string, unknown>): string | undefined {
  const message = event.message;
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    return undefined;
  }
  const content = (message as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    return undefined;
  }
  let text = "";
  for (const part of content) {
    if (part !== null && typeof part === "object" && !Array.isArray(part)) {
      const t = (part as Record<string, unknown>).text;
      if (typeof t === "string") {
        text += t;
      }
    }
  }
  return text.length > 0 ? text : undefined;
}

function isCursorStreamingDelta(event: Record<string, unknown>): boolean {
  const hasTimestamp = typeof event.timestamp_ms === "number";
  const hasModelCallId = typeof event.model_call_id === "string";
  return hasTimestamp && !hasModelCallId;
}

function extractToolName(event: Record<string, unknown>): string | undefined {
  const toolCall = event.tool_call;
  if (toolCall === null || typeof toolCall !== "object" || Array.isArray(toolCall)) {
    return undefined;
  }
  const keys = Object.keys(toolCall as Record<string, unknown>);
  if (keys.length === 0) {
    return undefined;
  }
  const key = keys[0];
  return key?.replace(/ToolCall$/, "") ?? key;
}

export function parseCursorJsonOutput(stdout: string): LLMCompleteResult {
  const trimmed = stdout.trim();
  const lastLine = trimmed.split("\n").filter(Boolean).pop() ?? trimmed;
  const parsed = JSON.parse(lastLine) as CursorResultEvent;
  if (parsed.type !== "result" || parsed.is_error) {
    throw new Error("Cursor CLI returned a non-success result");
  }
  const usage: LLMUsage = {
    durationMs: parsed.duration_ms,
    durationApiMs: parsed.duration_api_ms,
  };
  return {
    text: parsed.result ?? "",
    sessionId: parsed.session_id,
    usage,
    raw: parsed,
  };
}

export function* mapCursorStreamEvent(
  event: Record<string, unknown>,
  state: { lastAssistantText: string },
): Generator<LLMStreamChunk> {
  const type = getStringField(event, "type");
  const subtype = getStringField(event, "subtype");

  if (type === "assistant") {
    if (isCursorStreamingDelta(event)) {
      const full = extractAssistantText(event) ?? "";
      const delta = full.startsWith(state.lastAssistantText)
        ? full.slice(state.lastAssistantText.length)
        : full;
      if (delta.length > 0) {
        state.lastAssistantText = full;
        yield { type: "text-delta", text: delta };
      }
    } else if (typeof event.timestamp_ms !== "number") {
      const text = extractAssistantText(event);
      if (text) {
        state.lastAssistantText = text;
        yield { type: "text", text };
      }
    }
    return;
  }

  if (type === "tool_call") {
    const name = extractToolName(event) ?? "tool";
    const callId = getStringField(event, "call_id");
    if (subtype === "started") {
      yield { type: "tool-start", name, id: callId };
    } else if (subtype === "completed") {
      yield { type: "tool-end", name, id: callId };
    }
    return;
  }

  if (type === "result" && subtype === "success") {
    const text = getStringField(event, "result") ?? "";
    const usage: LLMUsage = {
      durationMs: typeof event.duration_ms === "number" ? event.duration_ms : undefined,
      durationApiMs:
        typeof event.duration_api_ms === "number" ? event.duration_api_ms : undefined,
    };
    yield {
      type: "done",
      result: {
        text,
        sessionId: getStringField(event, "session_id"),
        usage,
        raw: event,
      },
    };
  }
}

export function getCursorInitModel(event: Record<string, unknown>): string | undefined {
  if (getStringField(event, "type") === "system" && getStringField(event, "subtype") === "init") {
    return getStringField(event, "model");
  }
  return undefined;
}

export function extractCursorErrorHint(stderr: string): string {
  return stderr.trim() || "Cursor CLI failed";
}

/** @internal for tests */
export { extractAssistantText, isCursorStreamingDelta };
