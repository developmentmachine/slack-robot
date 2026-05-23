import { spawn, type ChildProcess } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { CliProviderError, CliTimeoutError } from "../errors.js";

export interface RunCliOptions {
  binary: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface RunCliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function killProcessTree(child: ChildProcess): void {
  try {
    child.kill("SIGTERM");
  } catch {
    // ignore
  }
  setTimeout(() => {
    try {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    } catch {
      // ignore
    }
  }, 2_000).unref();
}

/**
 * Run CLI to completion and return captured stdout/stderr.
 */
export function runCliSync(options: RunCliOptions): Promise<RunCliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.binary, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const outDecoder = new StringDecoder("utf8");
    const errDecoder = new StringDecoder("utf8");

    const timeout = setTimeout(() => {
      killProcessTree(child);
      reject(new CliTimeoutError(options.binary, options.timeoutMs));
    }, options.timeoutMs);

    const onAbort = (): void => {
      killProcessTree(child);
      reject(
        new CliProviderError("CLI aborted", {
          exitCode: null,
          stderr,
          binary: options.binary,
        }),
      );
    };

    if (options.signal) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += outDecoder.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += errDecoder.write(chunk);
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(
        new CliProviderError(`Failed to spawn ${options.binary}: ${err.message}`, {
          exitCode: null,
          stderr,
          binary: options.binary,
          cause: err,
        }),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      stdout += outDecoder.end();
      stderr += errDecoder.end();
      options.signal?.removeEventListener("abort", onAbort);
      const exitCode = code ?? 1;
      if (exitCode !== 0) {
        reject(
          new CliProviderError(
            `${options.binary} exited with code ${exitCode}`,
            { exitCode, stderr: stderr.trim(), binary: options.binary },
          ),
        );
        return;
      }
      resolve({ stdout, stderr, exitCode });
    });
  });
}

/**
 * Stream stdout line-by-line while CLI runs.
 */
export async function* streamCliLines(
  options: RunCliOptions,
): AsyncGenerator<string> {
  const child = spawn(options.binary, options.args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stderrChunks: string[] = [];
  const errDecoder = new StringDecoder("utf8");
  child.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(errDecoder.write(chunk));
  });

  let rejectError: Error | null = null;
  let settled = false;

  const timeout = setTimeout(() => {
    killProcessTree(child);
    rejectError = new CliTimeoutError(options.binary, options.timeoutMs);
    settled = true;
  }, options.timeoutMs);

  const onAbort = (): void => {
    killProcessTree(child);
    rejectError = new CliProviderError("CLI aborted", {
      exitCode: null,
      stderr: stderrChunks.join(""),
      binary: options.binary,
    });
    settled = true;
  };

  if (options.signal) {
    if (options.signal.aborted) {
      onAbort();
    } else {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  const lineQueue: string[] = [];
  let resolveWait: (() => void) | null = null;
  let streamDone = false;

  const pushLine = (line: string): void => {
    lineQueue.push(line);
    resolveWait?.();
    resolveWait = null;
  };

  const outDecoder = new StringDecoder("utf8");
  let buffer = "";

  child.stdout.on("data", (chunk: Buffer) => {
    buffer += outDecoder.write(chunk);
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      pushLine(line);
    }
  });

  const closePromise = new Promise<number>((resolve, reject) => {
    child.on("error", (err) => {
      reject(
        new CliProviderError(`Failed to spawn ${options.binary}: ${err.message}`, {
          exitCode: null,
          stderr: stderrChunks.join(""),
          binary: options.binary,
          cause: err,
        }),
      );
    });
    child.on("close", (code) => {
      buffer += outDecoder.end();
      if (buffer.length > 0) {
        pushLine(buffer);
      }
      stderrChunks.push(errDecoder.end());
      resolve(code ?? 1);
    });
  });

  try {
    while (!streamDone) {
      if (rejectError) {
        throw rejectError;
      }
      while (lineQueue.length > 0) {
        yield lineQueue.shift() as string;
      }
      if (settled) {
        streamDone = true;
        break;
      }
      await Promise.race([
        closePromise.then(() => {
          settled = true;
        }),
        new Promise<void>((resolve) => {
          resolveWait = resolve;
        }),
      ]);
    }

    while (lineQueue.length > 0) {
      yield lineQueue.shift() as string;
    }

    const exitCode = await closePromise;
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);

    if (rejectError) {
      throw rejectError;
    }
    if (exitCode !== 0) {
      throw new CliProviderError(
        `${options.binary} exited with code ${exitCode}`,
        {
          exitCode,
          stderr: stderrChunks.join("").trim(),
          binary: options.binary,
        },
      );
    }
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
