import { CursorCliProvider } from "./providers/cursor-cli-provider.js";
import { GeminiCliProvider } from "./providers/gemini-cli-provider.js";
import type { CliProviderConfig, LLMProvider } from "./types.js";

/**
 * Create a CLI-backed LLM provider for Cursor or Gemini.
 *
 * @example
 * ```ts
 * const llm = createCliProvider({ backend: "cursor", cwd: process.cwd() });
 * const reply = await llm.complete([{ role: "user", content: "Hello" }]);
 * ```
 */
export function createCliProvider(config: CliProviderConfig): LLMProvider {
  const common = {
    cwd: config.cwd,
    timeoutMs: config.timeoutMs,
    allowWrites: config.allowWrites,
    defaultExtraArgs: config.extraArgs,
    trustWorkspace: config.trustWorkspace,
  };

  if (config.backend === "cursor") {
    return new CursorCliProvider({
      ...common,
      binary: config.binary,
    });
  }

  return new GeminiCliProvider({
    ...common,
    binary: config.binary,
  });
}
