import { describe, expect, it } from "vitest";
import {
  mapCursorStreamEvent,
  parseCursorJsonOutput,
} from "../src/parsers/cursor.js";

describe("parseCursorJsonOutput", () => {
  it("parses success result JSON", () => {
    const stdout = JSON.stringify({
      type: "result",
      subtype: "success",
      is_error: false,
      result: "Hello world",
      session_id: "sess-1",
      duration_ms: 100,
      duration_api_ms: 80,
    });

    const result = parseCursorJsonOutput(stdout);
    expect(result.text).toBe("Hello world");
    expect(result.sessionId).toBe("sess-1");
    expect(result.usage?.durationMs).toBe(100);
  });
});

describe("mapCursorStreamEvent", () => {
  it("emits text-delta for streaming assistant chunks", () => {
    const state = { lastAssistantText: "" };
    const events = [
      ...mapCursorStreamEvent(
        {
          type: "assistant",
          timestamp_ms: 1,
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hel" }],
          },
        },
        state,
      ),
      ...mapCursorStreamEvent(
        {
          type: "assistant",
          timestamp_ms: 2,
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello" }],
          },
        },
        state,
      ),
    ];

    expect(events).toEqual([
      { type: "text-delta", text: "Hel" },
      { type: "text-delta", text: "lo" },
    ]);
    expect(state.lastAssistantText).toBe("Hello");
  });

  it("emits done on terminal result", () => {
    const state = { lastAssistantText: "x" };
    const events = [
      ...mapCursorStreamEvent(
        {
          type: "result",
          subtype: "success",
          result: "final",
          session_id: "s2",
        },
        state,
      ),
    ];
    expect(events[0]?.type).toBe("done");
    if (events[0]?.type === "done") {
      expect(events[0].result.text).toBe("final");
    }
  });
});
