import {
  mapCursorStreamEvent,
  parseCursorJsonOutput,
} from "../parsers/cursor.js";
import type { LLMCompleteOptions, LLMCompleteResult, LLMMessage, LLMStreamChunk } from "../types.js";
import { BaseCliProvider, type BaseCliProviderOptions } from "./base-cli-provider.js";

export interface CursorCliProviderOptions extends Omit<BaseCliProviderOptions, "backend" | "binary"> {
  /** Executable: `agent`, `cursor-agent`, or absolute path. */
  binary?: string;
}

/**
 * LLM provider backed by Cursor Agent CLI (`agent -p`).
 * @see https://cursor.com/docs/cli/headless
 */
export class CursorCliProvider extends BaseCliProvider {
  constructor(options: CursorCliProviderOptions = {}) {
    super({
      ...options,
      id: options.id ?? "cursor-cli",
      backend: "cursor",
      binary: options.binary ?? "agent",
    });
  }

  complete(
    messages: LLMMessage[],
    options?: LLMCompleteOptions,
  ): Promise<LLMCompleteResult> {
    return this.runComplete(messages, options);
  }

  protected buildArgs(
    prompt: string,
    mode: "complete" | "stream",
    options?: LLMCompleteOptions,
  ): string[] {
    const args: string[] = [
      "-p",
      "--output-format",
      mode === "complete" ? "json" : "stream-json",
    ];

    if (mode === "stream") {
      args.push("--stream-partial-output");
    }

    if (this.trustWorkspace) {
      args.push("--trust");
    }

    if (this.allowWrites) {
      args.push("--force");
    }

    if (options?.model) {
      args.push("--model", options.model);
    }

    if (options?.sessionId) {
      args.push("--resume", options.sessionId);
    }

    const cwd = options?.cwd ?? this.defaultCwd;
    if (cwd) {
      args.push("--workspace", cwd);
    }

    args.push(...this.defaultExtraArgs);
    if (options?.extraArgs) {
      args.push(...options.extraArgs);
    }

    args.push(prompt);
    return args;
  }

  protected parseCompleteOutput(stdout: string): LLMCompleteResult {
    return parseCursorJsonOutput(stdout);
  }

  protected mapStreamEvent(
    event: Record<string, unknown>,
    state: { lastAssistantText: string },
  ): Generator<LLMStreamChunk> {
    return mapCursorStreamEvent(event, state);
  }
}
