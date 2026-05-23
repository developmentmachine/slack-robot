import { describe, expect, it, vi, beforeEach } from "vitest";
import { CursorCliProvider } from "../src/providers/cursor-cli-provider.js";
import { GeminiCliProvider } from "../src/providers/gemini-cli-provider.js";

vi.mock("../src/process/run-cli.js", () => ({
  runCliSync: vi.fn(),
  streamCliLines: vi.fn(),
}));

import { runCliSync, streamCliLines } from "../src/process/run-cli.js";

const mockedRun = vi.mocked(runCliSync);
const mockedStream = vi.mocked(streamCliLines);

describe("CursorCliProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("complete() parses JSON from agent CLI", async () => {
    mockedRun.mockResolvedValue({
      stdout: JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "ok",
      }),
      stderr: "",
      exitCode: 0,
    });

    const provider = new CursorCliProvider({ binary: "agent", trustWorkspace: true });
    const result = await provider.complete([{ role: "user", content: "test" }]);

    expect(result.text).toBe("ok");
    expect(mockedRun).toHaveBeenCalledOnce();
    const call = mockedRun.mock.calls[0]?.[0];
    expect(call?.binary).toBe("agent");
    expect(call?.args).toContain("-p");
    expect(call?.args).toContain("--trust");
    expect(call?.args).toContain("--output-format");
    expect(call?.args).toContain("json");
  });

  it("stream() yields deltas and done", async () => {
    async function* fakeLines() {
      yield JSON.stringify({
        type: "assistant",
        timestamp_ms: 1,
        message: { role: "assistant", content: [{ type: "text", text: "A" }] },
      });
      yield JSON.stringify({
        type: "result",
        subtype: "success",
        result: "A",
      });
    }

    mockedStream.mockReturnValue(fakeLines());

    const provider = new CursorCliProvider();
    const chunks = [];
    for await (const chunk of provider.stream([{ role: "user", content: "x" }])) {
      chunks.push(chunk);
    }

    expect(chunks.some((c) => c.type === "text-delta")).toBe(true);
    expect(chunks.some((c) => c.type === "done")).toBe(true);
    const call = mockedStream.mock.calls[0]?.[0];
    expect(call?.args).toContain("stream-json");
    expect(call?.args).toContain("--stream-partial-output");
  });
});

describe("GeminiCliProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("complete() parses gemini json", async () => {
    mockedRun.mockResolvedValue({
      stdout: JSON.stringify({ response: "gemini-ok" }),
      stderr: "",
      exitCode: 0,
    });

    const provider = new GeminiCliProvider();
    const result = await provider.complete([{ role: "user", content: "hi" }]);
    expect(result.text).toBe("gemini-ok");
    expect(mockedRun.mock.calls[0]?.[0].binary).toBe("gemini");
  });
});
