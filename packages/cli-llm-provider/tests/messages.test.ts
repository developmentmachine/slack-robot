import { describe, expect, it } from "vitest";
import { appendSystemPrompt, messagesToPrompt } from "../src/messages.js";

describe("messagesToPrompt", () => {
  it("formats multi-turn messages", () => {
    const prompt = messagesToPrompt([
      { role: "system", content: "Be concise." },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "Bye" },
    ]);
    expect(prompt).toContain("System:\nBe concise.");
    expect(prompt).toContain("User:\nBye");
    expect(prompt).toContain("Reply as the Assistant");
  });

  it("throws on empty messages", () => {
    expect(() => messagesToPrompt([])).toThrow();
  });
});

describe("appendSystemPrompt", () => {
  it("prepends system and strips duplicate system messages", () => {
    const out = appendSystemPrompt("Rules", [
      { role: "system", content: "ignored" },
      { role: "user", content: "q" },
    ]);
    expect(out[0]).toEqual({ role: "system", content: "Rules" });
    expect(out).toHaveLength(2);
  });
});
