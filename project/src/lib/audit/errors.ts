import type { ModelFailureCode, PublicModelFailure } from "./types";

export const MODEL_TIMEOUT_MS = 60_000;
export const AUDIT_DEADLINE_MS = 115_000;

export class AuditInputError extends Error {
  readonly code: string;
  readonly status: 400 | 408 | 413;

  constructor(code: string, message: string, status: 400 | 408 | 413 = 400) {
    super(message);
    this.name = "AuditInputError";
    this.code = code;
    this.status = status;
  }
}

export class ModelOperationError extends Error {
  readonly code: ModelFailureCode;
  readonly requestId: string | null;
  readonly retryable: boolean;

  constructor(
    code: ModelFailureCode,
    message: string,
    options: { requestId?: string | null; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "ModelOperationError";
    this.code = code;
    this.requestId = options.requestId ?? null;
    this.retryable = options.retryable ?? false;
  }

  toPublicFailure(): PublicModelFailure {
    return {
      code: this.code,
      message: publicModelMessage(this.code),
      retryable: this.retryable,
      requestId: this.requestId,
      action: modelFailureAction(this.code),
    };
  }
}

function stringProperty(
  value: unknown,
  property: string,
): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === "string" ? candidate : undefined;
}

function numberProperty(
  value: unknown,
  property: string,
): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as Record<string, unknown>)[property];
  return typeof candidate === "number" ? candidate : undefined;
}

function requestIdFrom(error: unknown): string | null {
  return (
    stringProperty(error, "request_id") ??
    stringProperty(error, "requestId") ??
    stringProperty(error, "requestID") ??
    null
  );
}

export function classifyModelError(error: unknown): ModelOperationError {
  if (error instanceof ModelOperationError) return error;

  const name = stringProperty(error, "name") ?? "";
  const code = stringProperty(error, "code") ?? "";
  const status = numberProperty(error, "status");
  const requestId = requestIdFrom(error);
  const normalized = `${name} ${code}`.toLowerCase();

  if (normalized.includes("abort") || normalized.includes("timeout")) {
    return new ModelOperationError("timeout", "Model request timed out.", {
      requestId,
      retryable: true,
    });
  }
  if (status === 401 || status === 403 || normalized.includes("auth")) {
    return new ModelOperationError("auth", "Model authentication failed.", {
      requestId,
    });
  }
  if (
    code === "insufficient_quota" ||
    normalized.includes("insufficient_quota") ||
    normalized.includes("quota")
  ) {
    return new ModelOperationError("quota", "Model quota is exhausted.", {
      requestId,
    });
  }
  if (status === 429 || normalized.includes("rate")) {
    return new ModelOperationError("rate_limit", "Model rate limit reached.", {
      requestId,
      retryable: true,
    });
  }
  if ((status && status >= 500) || normalized.includes("server")) {
    return new ModelOperationError("server", "Model service failed.", {
      requestId,
      retryable: true,
    });
  }
  if (status === 400 || normalized.includes("badrequest")) {
    return new ModelOperationError("request", "Model request was rejected.", {
      requestId,
    });
  }
  return new ModelOperationError("unknown", "Model operation failed.", {
    requestId,
    retryable: true,
  });
}

export function publicModelMessage(code: ModelFailureCode): string {
  const messages: Record<ModelFailureCode, string> = {
    auth: "OpenAI authentication needs attention.",
    quota: "OpenAI quota is currently unavailable.",
    rate_limit: "OpenAI is busy; try again shortly.",
    timeout: "The model took too long; the file scan is still available.",
    server: "OpenAI had a temporary server problem.",
    refusal: "The model could not evaluate this content.",
    invalid_output: "The model response could not be safely verified.",
    request: "The model request was not accepted.",
    unknown: "The model step did not complete.",
  };
  return messages[code];
}

export function modelFailureAction(code: ModelFailureCode): string {
  const actions: Record<ModelFailureCode, string> = {
    auth: "Check the server-side OpenAI API key.",
    quota: "Review OpenAI project quota and billing.",
    rate_limit: "Wait briefly, then retry once.",
    timeout: "Retry with a shorter rules file or fewer artifacts.",
    server: "Retry once after a short delay.",
    refusal: "Remove unrelated sensitive content or review the rules manually.",
    invalid_output: "Review the file manually and retry with clearer source text.",
    request: "Check model access and the request configuration.",
    unknown: "Review server logs using the request ID, then retry.",
  };
  return actions[code];
}

export function logModelError(
  operation: "requirement_extraction" | "cross_audit",
  error: ModelOperationError,
): void {
  console.error("[CrossReady:model]", {
    operation,
    code: error.code,
    requestId: error.requestId,
    retryable: error.retryable,
  });
}

export async function withModelTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const controller = new AbortController();
  const externalSignal = options.signal;
  const timeoutMs = options.timeoutMs ?? MODEL_TIMEOUT_MS;
  let timedOut = false;

  const abortFromExternalSignal = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal?.aborted) {
    abortFromExternalSignal();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, {
      once: true,
    });
  }

  if (controller.signal.aborted) {
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
    throw new ModelOperationError("timeout", "Model request was cancelled.", {
      retryable: true,
    });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ModelOperationError(
        "timeout",
        timedOut ? "Model request timed out." : "Model request was cancelled.",
        { retryable: true },
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}
