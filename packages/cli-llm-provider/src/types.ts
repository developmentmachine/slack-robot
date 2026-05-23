/** Chat role aligned with common agent frameworks. */
export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMCompleteOptions {
  /** Abort the underlying CLI process. */
  signal?: AbortSignal;
  /** Model id passed to CLI (--model). */
  model?: string;
  /** Resume Cursor/Gemini session when supported. */
  sessionId?: string;
  /** Working directory for the CLI agent. */
  cwd?: string;
  /** Extra CLI arguments appended before the prompt. */
  extraArgs?: string[];
  /** Kill subprocess after this many ms (default 600_000). */
  timeoutMs?: number;
}

export interface LLMUsage {
  durationMs?: number;
  durationApiMs?: number;
}

export interface LLMCompleteResult {
  text: string;
  sessionId?: string;
  usage?: LLMUsage;
  /** Raw JSON payload from CLI when available. */
  raw?: unknown;
}

/** Normalized stream events for agent loops. */
export type LLMStreamChunk =
  | { type: "text-delta"; text: string }
  | { type: "text"; text: string }
  | { type: "tool-start"; name: string; id?: string; args?: unknown }
  | { type: "tool-end"; name: string; id?: string; result?: unknown }
  | { type: "done"; result: LLMCompleteResult }
  | { type: "error"; message: string; cause?: unknown };

/**
 * Framework-agnostic LLM surface. Inject into any agent that expects
 * `complete` / `stream` instead of OpenAI HTTP.
 */
export interface LLMProvider {
  readonly id: string;
  readonly backend: CliBackend;
  complete(
    messages: LLMMessage[],
    options?: LLMCompleteOptions,
  ): Promise<LLMCompleteResult>;
  stream(
    messages: LLMMessage[],
    options?: LLMCompleteOptions,
  ): AsyncGenerator<LLMStreamChunk>;
}

export type CliBackend = "cursor" | "gemini";

export interface CliProviderConfig {
  backend: CliBackend;
  /** CLI executable name or path (default: agent | gemini). */
  binary?: string;
  cwd?: string;
  /** Default timeout per call in ms. */
  timeoutMs?: number;
  /** Cursor: trust workspace without prompt (--trust). */
  trustWorkspace?: boolean;
  /** Allow file edits without confirmation (--force / --yolo). */
  allowWrites?: boolean;
  extraArgs?: string[];
}
