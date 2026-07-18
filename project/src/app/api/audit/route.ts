import { createHash } from "node:crypto";
import path from "node:path";

import {
  acquireAuditRequestSlot,
  consumeLiveAuditBudget,
  deriveAuditIdentity,
  type LiveAuditBudgetDecision,
} from "@/lib/audit/cost-guard";
import northstarRequirements from "@/lib/audit/fixtures/northstar-requirements.json";
import {
  createCanonicalSampleReport,
  createDeterministicAuditReport,
  crossAuditWithGpt,
} from "@/lib/audit/cross-audit";
import {
  extractRequirementsWithGpt,
  RULES_LIMITS,
  type RulesDocument,
  validateRulesDocument,
} from "@/lib/audit/extract-requirements";
import {
  AUDIT_DEADLINE_MS,
  AuditInputError,
  classifyModelError,
  logModelError,
  ModelOperationError,
} from "@/lib/audit/errors";
import { requirementSetSchema } from "@/lib/audit/requirement-schema";
import {
  scanZipArchive,
  ZIP_LIMITS,
} from "@/lib/audit/scan-zip";
import type { AuditResponse } from "@/lib/audit/types";

export const runtime = "nodejs";

const NORTHSTAR_RULES_SHA256 =
  "6d0eef5715d7da7782b172fd46b95fb2c3edfff0fdf080b6302f1e6c9bc96a3f";
const NORTHSTAR_ARCHIVE_SHA256 =
  "f899c4b4174897f69b1be94fa29631f15490fb3f9625ad3bdc1eccbd32370d93";
export const MAX_MULTIPART_BYTES = 20 * 1024 * 1024;
export const MAX_SUBMISSION_COPY_CHARACTERS = 20_000;

function json(body: AuditResponse, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function requiredFile(
  formData: FormData,
  field: "rules" | "archive",
): File {
  const value = formData.get(field);
  if (!value || typeof value === "string") {
    throw new AuditInputError(
      "MISSING_FILE",
      `A ${field} file is required.`,
    );
  }
  return value;
}

function rulesMediaType(filename: string): RulesDocument["mediaType"] {
  switch (path.extname(filename).toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".md":
      return "text/markdown";
    case ".txt":
      return "text/plain";
    default:
      throw new AuditInputError(
        "RULES_TYPE",
        "Rules must be a .pdf, .md, or .txt file.",
      );
  }
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function optionalSubmissionCopy(formData: FormData): string | undefined {
  const value = formData.get("submissionCopy");
  if (value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new AuditInputError(
      "SUBMISSION_COPY_TYPE",
      "Submission copy must be plain text.",
    );
  }
  if (value.length > MAX_SUBMISSION_COPY_CHARACTERS) {
    throw new AuditInputError(
      "SUBMISSION_COPY_TOO_LARGE",
      `Submission copy exceeds the ${MAX_SUBMISSION_COPY_CHARACTERS.toLocaleString("en-US")} character limit.`,
      413,
    );
  }
  return value;
}

function limitSnapshot(budget: LiveAuditBudgetDecision) {
  return {
    limit: budget.limit,
    remaining: budget.remaining,
    resetAt: new Date(budget.resetAt).toISOString(),
  };
}

function createAuditDeadlineSignal(requestSignal: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const abortFromRequest = () => controller.abort(requestSignal.reason);

  if (requestSignal.aborted) {
    abortFromRequest();
  } else {
    requestSignal.addEventListener("abort", abortFromRequest, { once: true });
  }

  const deadline = setTimeout(() => {
    controller.abort(new DOMException("Audit deadline exceeded", "TimeoutError"));
  }, AUDIT_DEADLINE_MS);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(deadline);
      requestSignal.removeEventListener("abort", abortFromRequest);
    },
  };
}

export async function startCrossAuditIfActive<T>(
  signal: AbortSignal,
  operation: () => Promise<T>,
): Promise<T> {
  if (signal.aborted) {
    throw new ModelOperationError(
      "timeout",
      "The audit was cancelled before cross-audit started.",
      { retryable: true },
    );
  }
  return operation();
}

async function boundedMultipartFormData(
  request: Request,
  contentType: string,
  signal: AbortSignal,
): Promise<FormData> {
  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > MAX_MULTIPART_BYTES
  ) {
    throw new AuditInputError(
      "REQUEST_TOO_LARGE",
      `The upload exceeds the ${MAX_MULTIPART_BYTES / 1024 / 1024} MiB request limit.`,
      413,
    );
  }

  if (!request.body) {
    throw new AuditInputError(
      "INVALID_FORM_DATA",
      "The request must contain multipart form data.",
    );
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const cancelReader = () => {
    void reader.cancel();
  };

  if (signal.aborted) {
    throw new AuditInputError(
      "REQUEST_TIMEOUT",
      "The audit request ended before the upload could be read.",
      408,
    );
  }
  signal.addEventListener("abort", cancelReader, { once: true });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal.aborted) {
        throw new AuditInputError(
          "REQUEST_TIMEOUT",
          "The audit request exceeded its safe time limit.",
          408,
        );
      }
      totalBytes += value.byteLength;
      if (totalBytes > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        throw new AuditInputError(
          "REQUEST_TOO_LARGE",
          `The upload exceeds the ${MAX_MULTIPART_BYTES / 1024 / 1024} MiB request limit.`,
          413,
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof AuditInputError) throw error;
    if (signal.aborted) {
      throw new AuditInputError(
        "REQUEST_TIMEOUT",
        "The audit request exceeded its safe time limit.",
        408,
      );
    }
    throw new AuditInputError(
      "INVALID_FORM_DATA",
      "The request must be readable multipart form data.",
    );
  } finally {
    signal.removeEventListener("abort", cancelReader);
  }

  if (signal.aborted) {
    throw new AuditInputError(
      "REQUEST_TIMEOUT",
      "The audit request exceeded its safe time limit.",
      408,
    );
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return await new Response(bytes, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new AuditInputError(
      "INVALID_FORM_DATA",
      "The request must be multipart form data.",
    );
  }
}

function preflightFileSizes(rules: File, archive: File): void {
  const mediaType = rulesMediaType(rules.name);
  const maxRulesBytes =
    mediaType === "application/pdf"
      ? RULES_LIMITS.maxPdfBytes
      : RULES_LIMITS.maxTextBytes;

  if (rules.size > maxRulesBytes) {
    throw new AuditInputError(
      "RULES_TOO_LARGE",
      `The rules file exceeds the ${maxRulesBytes / 1024 / 1024} MiB limit.`,
      413,
    );
  }
  if (archive.size > ZIP_LIMITS.maxArchiveBytes) {
    throw new AuditInputError(
      "ARCHIVE_TOO_LARGE",
      `The ZIP exceeds the ${ZIP_LIMITS.maxArchiveBytes / 1024 / 1024} MiB limit.`,
      413,
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const requestSlot = acquireAuditRequestSlot();
  if (!requestSlot.allowed) {
    return json(
      {
        ok: false,
        error: {
          code: "AUDIT_CAPACITY",
          message: "CrossReady is already processing its safe request limit.",
          retryable: true,
          action: "Wait for an active audit to finish, then retry once.",
        },
      },
      429,
    );
  }
  const auditDeadline = createAuditDeadlineSignal(request.signal);

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      throw new AuditInputError(
        "INVALID_CONTENT_TYPE",
        "The request must use multipart form data.",
      );
    }

    const formData = await boundedMultipartFormData(
      request,
      contentType,
      auditDeadline.signal,
    );

    const rulesFile = requiredFile(formData, "rules");
    const archiveFile = requiredFile(formData, "archive");
    const demoMode = formData.get("demoMode") === "true";
    const submissionCopy = optionalSubmissionCopy(formData);

    preflightFileSizes(rulesFile, archiveFile);

    const [rulesArrayBuffer, archiveArrayBuffer] = await Promise.all([
      rulesFile.arrayBuffer(),
      archiveFile.arrayBuffer(),
    ]);
    const rulesBytes = new Uint8Array(rulesArrayBuffer);
    const archiveBytes = new Uint8Array(archiveArrayBuffer);
    const rulesDocument: RulesDocument = {
      filename: rulesFile.name,
      mediaType: rulesMediaType(rulesFile.name),
      bytes: rulesBytes,
    };
    validateRulesDocument(rulesDocument);

    // Validation happens before any model call. The ZIP scanner only reads bytes;
    // it never writes archive content to disk or executes submitted code.
    const inventory = await scanZipArchive(archiveFile.name, archiveBytes);
    const warnings: string[] = [];

    const isCanonicalSample =
      sha256(rulesBytes) === NORTHSTAR_RULES_SHA256 &&
      inventory.archiveSha256 === NORTHSTAR_ARCHIVE_SHA256;

    if (demoMode && isCanonicalSample) {
      const requirements = requirementSetSchema.parse(northstarRequirements);
      return json({
        ok: true,
        mode: "sample",
        model: null,
        warnings: [
          "Sample mode used the bundled answer set. GPT-5.6 was not called.",
        ],
        inventory,
        requirements,
        report: createCanonicalSampleReport(requirements, inventory),
        metadata: null,
        modelFailure: null,
        limits: null,
      });
    }

    if (demoMode && !isCanonicalSample) {
      warnings.push(
        "Sample mode was not used because the two uploaded files did not match the bundled sample fingerprints.",
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      warnings.push(
        "OPENAI_API_KEY is not configured, so only the ZIP scan ran. GPT-5.6 was not called.",
      );
      return json({
        ok: true,
        mode: "scanner_only",
        model: null,
        warnings,
        inventory,
        requirements: null,
        report: createDeterministicAuditReport(null, inventory),
        metadata: null,
        modelFailure: null,
        limits: null,
      });
    }

    if (auditDeadline.signal.aborted) {
      return json(
        {
          ok: false,
          error: {
            code: "REQUEST_TIMEOUT",
            message: "The audit request ended before GPT-5.6 could start.",
            retryable: true,
            action: "Start the audit again when you are ready.",
          },
        },
        408,
      );
    }

    const budget = consumeLiveAuditBudget(deriveAuditIdentity(request));
    if (!budget.allowed) {
      const resetAt = new Date(budget.resetAt).toISOString();
      const dailyBudget = budget.reason === "daily_budget";
      return json(
        {
          ok: false,
          error: {
            code: dailyBudget ? "DAILY_BUDGET_EXHAUSTED" : "RATE_LIMITED",
            message: dailyBudget
              ? "CrossReady has reached its protected daily live-audit budget."
              : "This browser has reached the live-audit limit for now.",
            retryable: !dailyBudget,
            action: dailyBudget
              ? "Use the bundled sample now, or raise the server budget intentionally."
              : "Wait until the displayed reset time, then run the same files again.",
            resetAt,
          },
        },
        429,
      );
    }

    const limits = limitSnapshot(budget);
    const safeIdentifier = budget.safetyIdentifier;
    try {
      const extraction = await extractRequirementsWithGpt(
        rulesDocument,
        undefined,
        {
          safetyIdentifier: safeIdentifier,
          signal: auditDeadline.signal,
        },
      );
      if (rulesDocument.mediaType === "application/pdf") {
        warnings.push(
          "PDF requirement excerpts and page locators were extracted by GPT-5.6 and need human page confirmation; CrossReady did not independently verify the PDF quotes.",
        );
      }

      try {
        const crossAudit = await startCrossAuditIfActive(
          auditDeadline.signal,
          () =>
            crossAuditWithGpt({
              requirements: extraction.requirements,
              inventory,
              submissionCopy,
              safetyIdentifier: safeIdentifier,
              signal: auditDeadline.signal,
            }),
        );
        return json({
          ok: true,
          mode: "live",
          model: crossAudit.metadata.model,
          warnings,
          inventory,
          requirements: extraction.requirements,
          report: crossAudit.report,
          metadata: {
            requirementExtraction: extraction.metadata,
            crossAudit: crossAudit.metadata,
          },
          modelFailure: null,
          limits,
        });
      } catch (error) {
        const modelError = classifyModelError(error);
        logModelError("cross_audit", modelError);
        warnings.push(
          "GPT-5.6 cross-audit did not complete. Verified file facts and extracted requirements are still available.",
        );
        return json({
          ok: true,
          mode: "partial",
          model: extraction.metadata.model,
          warnings,
          inventory,
          requirements: extraction.requirements,
          report: createDeterministicAuditReport(
            extraction.requirements,
            inventory,
          ),
          metadata: {
            requirementExtraction: extraction.metadata,
            crossAudit: null,
          },
          modelFailure: modelError.toPublicFailure(),
          limits,
        });
      }
    } catch (error) {
      const modelError = classifyModelError(error);
      logModelError("requirement_extraction", modelError);
      warnings.push(
        "GPT-5.6 requirement extraction did not complete. The ZIP scan is still available and no model result is being claimed.",
      );
      return json({
        ok: true,
        mode: "scanner_only",
        model: null,
        warnings,
        inventory,
        requirements: null,
        report: createDeterministicAuditReport(null, inventory),
        metadata: null,
        modelFailure: modelError.toPublicFailure(),
        limits,
      });
    }
  } catch (error) {
    if (error instanceof AuditInputError) {
      return json(
        {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        error.status,
      );
    }

    console.error(
      "Audit request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "The audit could not be completed.",
        },
      },
      500,
    );
  } finally {
    auditDeadline.cleanup();
    requestSlot.release();
  }
}
