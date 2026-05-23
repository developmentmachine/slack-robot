import { describe, expect, it } from "vitest";
import {
  mapGeminiStreamEvent,
  parseGeminiJsonOutput,
} from "../src/parsers/gemini.js";

describe("parseGeminiJsonOutput", () => {
  it("parses response field", () => {
    const result = parseGeminiJsonOutput(
      JSON.stringify({ response: "Paris", stats: { duration_ms: 50 } }),
    );
    expect(result.text).toBe("Paris");
    expect(result.usage?.durationMs).toBe(50);
  });
});

describe("mapGeminiStreamEvent", () => {
  it("maps message chunks to text-delta", () => {
    const state = { lastAssistantText: "" };
    const chunks = [
      ...mapGeminiStreamEvent(
        {
          type: "message",
          message: { role: "assistant", content: "Hi" },
        },
        state,
      ),
    ];
    expect(chunks).toEqual([{ type: "text-delta", text: "Hi" }]);
  });

  it("maps result event to done", () => {
    const state = { lastAssistantText: "Hi" };
    const chunks = [
      ...mapGeminiStreamEvent(
        { type: "result", response: "Hi there" },
        state,
      ),
    ];
    expect(chunks[0]?.type).toBe("done");
  });
});
