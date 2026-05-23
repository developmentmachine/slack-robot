import { messagesToPrompt } from "../messages.js";
import { parseNdjsonLines } from "../parsers/ndjson.js";
import { runCliSync, streamCliLines, type RunCliOptions } from "../process/run-cli.js";
import type {
  CliBackend,
  LLMCompleteOptions,
  LLMCompleteResult,
  LLMMessage,
  LLMProvider,
  LLMStreamChunk,
} from "../types.js";

const DEFAULT_TIMEOUT_MS = 600_000;

export interface BaseCliProviderOptions {
  id?: string;
  backend: CliBackend;
  binary: string;
  defaultCwd?: string;
  defaultTimeoutMs?: number;
  trustWorkspace?: boolean;
  allowWrites?: boolean;
  defaultExtraArgs?: string[];
}

export abstract class BaseCliProvider implements LLMProvider {
  readonly id: string;
  readonly backend: CliBackend;
  protected readonly binary: string;
  protected readonly defaultCwd?: string;
  protected readonly defaultTimeoutMs: number;
  protected readonly trustWorkspace: boolean;
  protected readonly allowWrites: boolean;
  protected readonly defaultExtraArgs: string[];

  constructor(options: BaseCliProviderOptions) {
    this.id = options.id ?? `${options.backend}-cli`;
    this.backend = options.backend;
    this.binary = options.binary;
    this.defaultCwd = options.defaultCwd;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.trustWorkspace = options.trustWorkspace ?? true;
    this.allowWrites = options.allowWrites ?? false;
    this.defaultExtraArgs = options.defaultExtraArgs ?? [];
  }

  abstract complete(
    messages: LLMMessage[],
    options?: LLMCompleteOptions,
  ): Promise<LLMCompleteResult>;

  async *stream(
    messages: LLMMessage[],
    options?: LLMCompleteOptions,
  ): AsyncGenerator<LLMStreamChunk> {
    const prompt = messagesToPrompt(messages);
    const runOptions = this.buildRunOptions(prompt, "stream", options);

    const state = { lastAssistantText: "" };
    let doneEmitted = false;

    try {
      for await (const event of parseNdjsonLines(streamCliLines(runOptions))) {
        for (const chunk of this.mapStreamEvent(event, state)) {
          if (chunk.type === "done") {
            doneEmitted = true;
          }
          yield chunk;
        }
      }

      if (!doneEmitted && state.lastAssistantText.length > 0) {
        yield {
          type: "done",
          result: { text: state.lastAssistantText },
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield { type: "error", message, cause: err };
      throw err;
    }
  }

  protected buildRunOptions(
    prompt: string,
    mode: "complete" | "stream",
    options?: LLMCompleteOptions,
  ): RunCliOptions {
    const args = this.buildArgs(prompt, mode, options);
    return {
      binary: this.binary,
      args,
      cwd: options?.cwd ?? this.defaultCwd,
      timeoutMs: options?.timeoutMs ?? this.defaultTimeoutMs,
      signal: options?.signal,
    };
  }

  protected abstract buildArgs(
    prompt: string,
    mode: "complete" | "stream",
    options?: LLMCompleteOptions,
  ): string[];

  protected abstract parseCompleteOutput(stdout: string): LLMCompleteResult;

  protected abstract mapStreamEvent(
    event: Record<string, unknown>,
    state: { lastAssistantText: string },
  ): Generator<LLMStreamChunk>;

  protected async runComplete(
    messages: LLMMessage[],
    options?: LLMCompleteOptions,
  ): Promise<LLMCompleteResult> {
    const prompt = messagesToPrompt(messages);
    const runOptions = this.buildRunOptions(prompt, "complete", options);
    const { stdout } = await runCliSync(runOptions);
    return this.parseCompleteOutput(stdout);
  }
}
