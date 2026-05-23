import { describe, expect, it, vi } from "vitest";
import { llmTurn } from "../src/agent/llm-turn.js";
import type { LLMProvider, LLMStreamChunk } from "../src/types.js";

function mockProvider(impl: Partial<LLMProvider>): LLMProvider {
  return {
    id: "mock",
    backend: "cursor",
    complete: vi.fn(),
    stream: vi.fn(),
    ...impl,
  };
}

describe("llmTurn", () => {
  it("calls complete when stream is false", async () => {
    const llm = mockProvider({
      complete: vi.fn().mockResolvedValue({ text: "done" }),
    });

    const result = await llmTurn(
      { llm, systemPrompt: "sys" },
      [{ role: "user", content: "hi" }],
    );

    expect(result.text).toBe("done");
    expect(llm.complete).toHaveBeenCalledOnce();
  });

  it("aggregates stream done event", async () => {
    async function* fakeStream(): AsyncGenerator<LLMStreamChunk> {
      yield { type: "text-delta", text: "a" };
      yield { type: "done", result: { text: "ab" } };
    }

    const llm = mockProvider({ stream: vi.fn().mockReturnValue(fakeStream()) });
    const chunks: LLMStreamChunk[] = [];

    const result = await llmTurn(
      { llm },
      [{ role: "user", content: "x" }],
      { stream: true, onChunk: (c) => chunks.push(c) },
    );

    expect(result.text).toBe("ab");
    expect(chunks.length).toBeGreaterThan(0);
  });
});
