import {
  mapGeminiStreamEvent,
  parseGeminiJsonOutput,
} from "../parsers/gemini.js";
import type { LLMCompleteOptions, LLMCompleteResult, LLMMessage, LLMStreamChunk } from "../types.js";
import { BaseCliProvider, type BaseCliProviderOptions } from "./base-cli-provider.js";

export interface GeminiCliProviderOptions extends Omit<BaseCliProviderOptions, "backend" | "binary"> {
  binary?: string;
}

/**
 * LLM provider backed by Gemini CLI (`gemini -p`).
 * @see https://geminicli.com/docs/cli/headless/
 */
export class GeminiCliProvider extends BaseCliProvider {
  constructor(options: GeminiCliProviderOptions = {}) {
    super({
      ...options,
      id: options.id ?? "gemini-cli",
      backend: "gemini",
      binary: options.binary ?? "gemini",
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

    if (this.allowWrites) {
      args.push("--yolo");
    }

    if (options?.model) {
      args.push("--model", options.model);
    }

    args.push(...this.defaultExtraArgs);
    if (options?.extraArgs) {
      args.push(...options.extraArgs);
    }

    args.push(prompt);
    return args;
  }

  protected parseCompleteOutput(stdout: string): LLMCompleteResult {
    return parseGeminiJsonOutput(stdout);
  }

  protected mapStreamEvent(
    event: Record<string, unknown>,
    state: { lastAssistantText: string },
  ): Generator<LLMStreamChunk> {
    return mapGeminiStreamEvent(event, state);
  }
}
