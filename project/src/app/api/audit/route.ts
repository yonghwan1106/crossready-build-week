import { createHash } from "node:crypto";
import path from "node:path";

import northstarRequirements from "@/lib/audit/fixtures/northstar-requirements.json";
import {
  extractRequirementsWithGpt,
  EXTRACTION_MODEL,
  RULES_LIMITS,
  type RulesDocument,
  validateRulesDocument,
} from "@/lib/audit/extract-requirements";
import { AuditInputError } from "@/lib/audit/errors";
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
const MAX_MULTIPART_BYTES = 20 * 1024 * 1024;

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
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      throw new AuditInputError(
        "INVALID_CONTENT_TYPE",
        "The request must use multipart form data.",
      );
    }

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

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new AuditInputError(
        "INVALID_FORM_DATA",
        "The request must be multipart form data.",
      );
    }

    const rulesFile = requiredFile(formData, "rules");
    const archiveFile = requiredFile(formData, "archive");
    const demoMode = formData.get("demoMode") === "true";

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
      return json({
        ok: true,
        mode: "sample",
        model: null,
        warnings: [
          "Sample mode used the bundled answer set. GPT-5.6 was not called.",
        ],
        inventory,
        requirements: requirementSetSchema.parse(northstarRequirements),
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
      });
    }

    try {
      const requirements = await extractRequirementsWithGpt(rulesDocument);
      return json({
        ok: true,
        mode: "live",
        model: EXTRACTION_MODEL,
        warnings,
        inventory,
        requirements,
      });
    } catch {
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
  }
}
