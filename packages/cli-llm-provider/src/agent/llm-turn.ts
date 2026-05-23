import { appendSystemPrompt } from "../messages.js";
import type {
  LLMCompleteOptions,
  LLMCompleteResult,
  LLMMessage,
  LLMProvider,
  LLMStreamChunk,
} from "../types.js";

/** Minimal context every agent loop needs — inject `llm` like a database client. */
export interface AgentLlmContext {
  llm: LLMProvider;
  systemPrompt?: string;
}

export interface LlmTurnOptions extends LLMCompleteOptions {
  /** When true, use stream() and invoke onChunk for each event. */
  stream?: boolean;
  onChunk?: (chunk: LLMStreamChunk) => void;
}

/**
 * Run one LLM turn inside an agent loop.
 * Returns the final assistant text and optional session id for multi-turn CLI resume.
 */
export async function llmTurn(
  ctx: AgentLlmContext,
  messages: LLMMessage[],
  options?: LlmTurnOptions,
): Promise<LLMCompleteResult> {
  const prepared =
    ctx.systemPrompt !== undefined
      ? appendSystemPrompt(ctx.systemPrompt, messages)
      : messages;

  if (options?.stream) {
    let finalResult: LLMCompleteResult | null = null;
    for await (const chunk of ctx.llm.stream(prepared, options)) {
      options.onChunk?.(chunk);
      if (chunk.type === "done") {
        finalResult = chunk.result;
      }
      if (chunk.type === "error") {
        throw new Error(chunk.message);
      }
    }
    if (!finalResult) {
      throw new Error("llmTurn: stream ended without done event");
    }
    return finalResult;
  }

  return ctx.llm.complete(prepared, options);
}

/**
 * Collect streamed text deltas into a single string (utility for simple UIs).
 */
export async function collectStreamText(
  llm: LLMProvider,
  messages: LLMMessage[],
  options?: LLMCompleteOptions,
): Promise<string> {
  let text = "";
  for await (const chunk of llm.stream(messages, options)) {
    if (chunk.type === "text-delta") {
      text += chunk.text;
    } else if (chunk.type === "done") {
      return chunk.result.text || text;
    } else if (chunk.type === "error") {
      throw new Error(chunk.message);
    }
  }
  return text;
}
