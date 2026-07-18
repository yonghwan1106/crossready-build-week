import { describe, expect, it, vi } from "vitest";

import { classifyModelError, withModelTimeout } from "./errors";

describe("classifyModelError", () => {
  it("keeps the OpenAI SDK request ID on authentication failures", () => {
    const error = classifyModelError({
      name: "AuthenticationError",
      status: 401,
      requestID: "req_auth_123",
    });

    expect(error).toMatchObject({
      code: "auth",
      requestId: "req_auth_123",
      retryable: false,
    });
  });

  it("distinguishes exhausted quota from a temporary rate limit", () => {
    expect(
      classifyModelError({
        name: "RateLimitError",
        status: 429,
        code: "insufficient_quota",
      }),
    ).toMatchObject({
      code: "quota",
      retryable: false,
    });

    expect(
      classifyModelError({
        name: "RateLimitError",
        status: 429,
        code: "rate_limit_exceeded",
      }),
    ).toMatchObject({
      code: "rate_limit",
      retryable: true,
    });
  });

  it("marks connection timeouts as safe to retry", () => {
    expect(
      classifyModelError({ name: "APIConnectionTimeoutError" }),
    ).toMatchObject({
      code: "timeout",
      retryable: true,
    });
  });
});

describe("withModelTimeout", () => {
  it("does not start a model operation when the caller already cancelled", async () => {
    const controller = new AbortController();
    const operation = vi.fn(async () => "should not run");
    controller.abort();

    await expect(
      withModelTimeout(operation, { signal: controller.signal }),
    ).rejects.toMatchObject({
      code: "timeout",
      message: "Model request was cancelled.",
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it("forwards a later caller cancellation to the active model operation", async () => {
    const controller = new AbortController();
    let modelSignal: AbortSignal | undefined;
    const operation = vi.fn(
      (signal: AbortSignal) =>
        new Promise<string>((_resolve, reject) => {
          modelSignal = signal;
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );

    const pending = withModelTimeout(operation, {
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: "timeout",
      message: "Model request was cancelled.",
    });
    expect(operation).toHaveBeenCalledOnce();
    expect(modelSignal?.aborted).toBe(true);
  });
});
