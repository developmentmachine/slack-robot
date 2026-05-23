import type { AgentLlmContext } from "./llm-turn.js";
import { llmTurn } from "./llm-turn.js";
import type { LLMMessage } from "../types.js";

export interface SimpleAgentConfig extends AgentLlmContext {
  /** Max back-and-forth turns with the LLM (each turn = one CLI invocation). */
  maxTurns?: number;
}

export interface SimpleAgentRunResult {
  messages: LLMMessage[];
  finalText: string;
  sessionId?: string;
  turns: number;
}

/**
 * Minimal agent: maintains message history and calls `llmTurn` each step.
 * Plug in tools separately by wrapping `llmTurn` or extending this loop.
 */
export async function runSimpleAgent(
  config: SimpleAgentConfig,
  userMessage: string,
  hooks?: {
    onTurnStart?: (turn: number, messages: LLMMessage[]) => void;
    onAssistantText?: (text: string, turn: number) => void;
  },
): Promise<SimpleAgentRunResult> {
  const maxTurns = config.maxTurns ?? 1;
  const messages: LLMMessage[] = [{ role: "user", content: userMessage }];

  let finalText = "";
  let sessionId: string | undefined;
  let turns = 0;

  for (let turn = 0; turn < maxTurns; turn += 1) {
    turns = turn + 1;
    hooks?.onTurnStart?.(turns, [...messages]);

    const result = await llmTurn(config, messages, {
      sessionId,
      stream: false,
    });

    finalText = result.text;
    sessionId = result.sessionId ?? sessionId;
    messages.push({ role: "assistant", content: finalText });
    hooks?.onAssistantText?.(finalText, turns);

    break;
  }

  return { messages, finalText, sessionId, turns };
}
