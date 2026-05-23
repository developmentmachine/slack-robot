export class CliProviderError extends Error {
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly binary: string;

  constructor(
    message: string,
    options: { exitCode: number | null; stderr: string; binary: string; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = "CliProviderError";
    this.exitCode = options.exitCode;
    this.stderr = options.stderr;
    this.binary = options.binary;
  }
}

export class CliTimeoutError extends CliProviderError {
  constructor(binary: string, timeoutMs: number) {
    super(`CLI timed out after ${timeoutMs}ms`, {
      exitCode: null,
      stderr: "",
      binary,
    });
    this.name = "CliTimeoutError";
  }
}
