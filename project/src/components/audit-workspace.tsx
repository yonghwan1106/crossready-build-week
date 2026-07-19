"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  FindingDetailDialog,
} from "@/components/finding-detail-dialog";
import type {
  AuditFinding,
  AuditResponse,
  AuditSuccess,
} from "@/lib/audit/types";
import { isAuditResponse } from "@/lib/audit/response-guard";

type UiError = {
  title: string;
  message: string;
  code?: string;
  action?: string;
  retryable: boolean;
  requestId?: string | null;
  resetAt?: string;
};

const CLIENT_AUDIT_TIMEOUT_MS = 125_000;

function UploadIcon({ kind }: { kind: "rules" | "archive" | "upload" | "scan" }) {
  const path =
    kind === "rules" ? (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </>
    ) : kind === "archive" ? (
      <>
        <path d="M4 7h16M5 7v12h14V7M3 3h18v4H3zM9 11h6" />
      </>
    ) : kind === "scan" ? (
      <>
        <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
        <path d="M7 12h10M12 7v10" />
      </>
    ) : (
      <>
        <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
      </>
    );

  return (
    <svg
      aria-hidden="true"
      className="size-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortHash(hash: string) {
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}

function modelMetadataSummary(result: AuditSuccess) {
  const runs = [
    result.metadata?.requirementExtraction,
    result.metadata?.crossAudit,
  ].filter((run) => run !== null && run !== undefined);
  const durationMs = runs.reduce((total, run) => total + run.durationMs, 0);
  const totalTokens = runs.reduce(
    (total, run) => total + (run.usage?.totalTokens ?? 0),
    0,
  );
  const models = Array.from(new Set(runs.map((run) => run.model)));

  return { durationMs, totalTokens, models };
}

function modeLabel(result: AuditSuccess) {
  const metadata = modelMetadataSummary(result);

  if (result.mode === "live") {
    return {
      title: "GPT-5.6 live",
      detail: metadata.models.join(", ") || result.model || "GPT-5.6",
      className: "bg-accent/10 text-accent ring-accent/25",
    };
  }

  if (result.mode === "sample") {
    return {
      title: "Sample data",
      detail: "Bundled demo files",
      className: "bg-sky-400/10 text-sky-300 ring-sky-300/25",
    };
  }

  if (result.mode === "partial") {
    return {
      title: "Partial result",
      detail: metadata.models.join(", ") || "Only some AI stages completed",
      className: "bg-amber-300/10 text-amber-200 ring-amber-200/25",
    };
  }

  return {
    title: "File scan only",
    detail: "GPT extraction skipped",
    className: "bg-amber-300/10 text-amber-200 ring-amber-200/25",
  };
}

function manifestSummary(manifest: AuditSuccess["inventory"]["manifest"]) {
  if (!manifest.present) {
    return {
      value: "—",
      label: "No manifest",
      tone: "text-amber-200",
    };
  }

  if (manifest.checked === 0) {
    return {
      value: "!",
      label: "Not verified",
      tone: "text-amber-200",
    };
  }

  return {
    value: String(manifest.mismatches.length),
    label: "Hash mismatches",
    tone: manifest.mismatches.length ? "text-rose-300" : "text-emerald-300",
  };
}

function mismatchReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    hash_mismatch:
      "The file fingerprint does not match the value recorded in the manifest.",
    missing_file: "A file listed in the manifest is missing from the ZIP.",
    invalid_sha256: "The manifest contains an invalid SHA-256 value.",
    invalid_manifest:
      "The manifest could not be read in a supported verification format.",
    unsafe_manifest_path: "The manifest contains an unsafe file path.",
  };

  return labels[reason] ?? reason;
}

function warningLabel(warning: string) {
  if (warning.includes("Sample mode used the bundled answer set")) {
    return "This run used the bundled sample answer set. GPT-5.6 was not called.";
  }
  if (warning.includes("OPENAI_API_KEY")) {
    return "No OpenAI connection was available, so only the file scan completed.";
  }
  if (warning.includes("PDF requirement excerpts and page locators")) {
    return "GPT located the PDF excerpts and page references. Verify them against the original pages before submitting.";
  }
  return warning;
}

function failureMessage(
  error: Extract<AuditResponse, { ok: false }>["error"],
): UiError {
  const code = error.code.toUpperCase();
  const defaults: Record<string, Pick<UiError, "title" | "message" | "action">> =
    {
      RATE_LIMITED: {
        title: "Too many audit requests",
        message: "Try again when audit capacity becomes available.",
        action: "Wait briefly, then run the same files again.",
      },
      AUDIT_CAPACITY: {
        title: "Another audit is in progress",
        message: "New audits are paused to stay within the safe concurrency limit.",
        action: "Wait briefly, then run the same files again.",
      },
      TIMEOUT: {
        title: "The audit took too long",
        message: "The audit was stopped after reaching the safety timeout.",
        action: "Reduce the ZIP size or try again shortly.",
      },
      ARCHIVE_TYPE: {
        title: "A ZIP file is required",
        message: "The submission bundle must be a .zip file.",
        action: "Package the final submission as a ZIP and select it again.",
      },
      RULES_TYPE: {
        title: "Check the rules file format",
        message: "The rules must be a PDF, Markdown, or TXT file.",
        action: "Select the rules again in a supported format.",
      },
      ARCHIVE_TOO_LARGE: {
        title: "The ZIP file is too large",
        message: "The archive was not opened because it exceeds the safe audit limit.",
        action: "Remove unnecessary files, reduce the ZIP size, and try again.",
      },
      RULES_TOO_LARGE: {
        title: "The rules file is too large",
        message: "The rules were not read because the file exceeds the safe audit limit.",
        action: "Keep only the relevant rules pages and try again.",
      },
      RULES_PDF_TOO_MANY_PAGES: {
        title: "The rules PDF has too many pages",
        message: "A single audit can process up to 40 pages.",
        action: "Keep only the relevant pages in the PDF and try again.",
      },
      EMPTY_ARCHIVE: {
        title: "The ZIP contains no files to audit",
        message: "Select a non-empty final submission ZIP.",
        action: "Check the ZIP contents, then select it again.",
      },
      API_KEY_MISSING: {
        title: "The GPT connection is not configured",
        message: "The file scan can run, but requirements cannot be extracted automatically.",
        action: "Check the server's OpenAI connection or use the sample audit.",
      },
      DAILY_BUDGET_EXHAUSTED: {
        title: "Today's live-audit limit has been reached",
        message: "A live GPT audit cannot run until the limit resets.",
        action: "Try again after the reset time shown below.",
      },
      REQUEST_TOO_LARGE: {
        title: "The combined upload is too large",
        message: "The rules and submission ZIP exceed the safe request limit.",
        action: "Remove unnecessary files or reduce their size, then try again.",
      },
      SUBMISSION_COPY_TOO_LARGE: {
        title: "The submission copy is too long",
        message: "The pasted description exceeds the comparison limit.",
        action: "Keep only the key claims, then try again.",
      },
    };
  const matched =
    defaults[code] ??
    (code.includes("RATE")
      ? defaults.RATE_LIMITED
      : code.includes("TIMEOUT")
        ? defaults.TIMEOUT
      : code.includes("SIZE") || code.includes("LARGE")
        ? defaults.ARCHIVE_TOO_LARGE
        : undefined);

  return {
    title: matched?.title ?? "The audit could not be completed",
    message: matched?.message ?? error.message,
    action: matched?.action ?? error.action,
    retryable:
      error.retryable ??
      (code.includes("RATE") || code.includes("TIMEOUT")),
    code: error.code,
    requestId: error.requestId,
    resetAt: error.resetAt,
  };
}

function formatResetTime(resetAt: string) {
  const date = new Date(resetAt);
  if (Number.isNaN(date.getTime())) return resetAt;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function modelFailureMessage(
  failure: NonNullable<AuditSuccess["modelFailure"]>,
) {
  const messages: Record<
    NonNullable<AuditSuccess["modelFailure"]>["code"],
    { title: string; message: string; action: string }
  > = {
    auth: {
      title: "Check the GPT authentication",
      message: "The AI audit stopped because the server's OpenAI credentials were rejected.",
      action: "An administrator must verify the API key before running the audit again.",
    },
    quota: {
      title: "The GPT quota is unavailable",
      message: "The AI audit could not finish because the OpenAI account has insufficient quota.",
      action: "Check the account quota, then try again.",
    },
    rate_limit: {
      title: "GPT requests are temporarily limited",
      message: "Part of the AI audit could not finish because too many requests arrived at once.",
      action: "Wait briefly, then run the same files again.",
    },
    timeout: {
      title: "The GPT request timed out",
      message: "The AI stage did not finish in time, so the remaining results are shown without it.",
      action: "Reduce the file size or try again shortly.",
    },
    server: {
      title: "GPT is temporarily unavailable",
      message: "Part of the AI audit could not finish because the OpenAI service did not respond.",
      action: "Wait briefly, then run the same files again.",
    },
    refusal: {
      title: "GPT did not process this document",
      message: "The requested analysis was not produced because of an AI safety decision.",
      action: "Remove sensitive content or review the document manually.",
    },
    invalid_output: {
      title: "The GPT result could not be validated",
      message: "The AI response did not match the required format and was not used for automated findings.",
      action: "Run the audit again or review the flagged files manually.",
    },
    request: {
      title: "Check the content sent to GPT",
      message: "The AI audit could not start because of a request-format or content issue.",
      action: "Check the file formats and contents, then try again.",
    },
    unknown: {
      title: "The GPT audit could not be completed",
      message: "Part of the AI audit failed because of an unknown error.",
      action: "Try again shortly. If it continues, use the request ID to investigate.",
    },
  };

  return messages[failure.code];
}

function findingStatus(status: string) {
  const styles: Record<string, { label: string; className: string }> = {
    PROVEN: {
      label: "Proven",
      className: "bg-emerald-400/10 text-emerald-300 ring-emerald-300/20",
    },
    CONTRADICTED: {
      label: "Contradicted",
      className: "bg-rose-400/10 text-rose-300 ring-rose-300/20",
    },
    MISSING: {
      label: "Missing",
      className: "bg-amber-300/10 text-amber-200 ring-amber-200/20",
    },
    NEEDS_HUMAN: {
      label: "Needs review",
      className: "bg-sky-400/10 text-sky-300 ring-sky-300/20",
    },
  };

  return (
    styles[status] ?? {
      label: status,
      className: "bg-white/5 text-zinc-300 ring-white/10",
    }
  );
}

export default function AuditWorkspace() {
  const rulesInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const userCancelledRef = useRef(false);
  const timedOutRef = useRef(false);
  const findingTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [rulesFile, setRulesFile] = useState<File | null>(null);
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [submissionCopy, setSubmissionCopy] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<AuditSuccess | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [selectedFinding, setSelectedFinding] =
    useState<AuditFinding | null>(null);

  const selectedCount = Number(Boolean(rulesFile)) + Number(Boolean(archiveFile));

  useEffect(() => {
    if (result) resultHeadingRef.current?.focus();
  }, [result]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function selectRules(event: ChangeEvent<HTMLInputElement>) {
    setRulesFile(event.target.files?.[0] ?? null);
    setDemoMode(false);
    setResult(null);
    setError(null);
  }

  function selectArchive(event: ChangeEvent<HTMLInputElement>) {
    setArchiveFile(event.target.files?.[0] ?? null);
    setDemoMode(false);
    setResult(null);
    setError(null);
  }

  async function loadSample() {
    setIsLoadingSample(true);
    setError(null);
    setResult(null);

    try {
      const [rulesResponse, archiveResponse] = await Promise.all([
        fetch("/samples/challenge-rules.md"),
        fetch("/samples/CrossReady_Broken_Submission.zip"),
      ]);

      if (!rulesResponse.ok || !archiveResponse.ok) {
        throw new Error("The sample files could not be loaded.");
      }

      const [rulesBlob, archiveBlob] = await Promise.all([
        rulesResponse.blob(),
        archiveResponse.blob(),
      ]);

      setRulesFile(
        new File([rulesBlob], "challenge-rules.md", {
          type: "text/markdown",
        }),
      );
      setArchiveFile(
        new File([archiveBlob], "CrossReady_Broken_Submission.zip", {
          type: "application/zip",
        }),
      );
      setDemoMode(true);
      requestAnimationFrame(() => {
        runButtonRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        runButtonRef.current?.focus({ preventScroll: true });
      });

      if (rulesInputRef.current) rulesInputRef.current.value = "";
      if (archiveInputRef.current) archiveInputRef.current.value = "";
    } catch (sampleError) {
      setError({
        title: "The sample could not be loaded",
        message:
          sampleError instanceof Error
            ? sampleError.message
            : "Check your network connection and try again.",
        retryable: true,
      });
    } finally {
      setIsLoadingSample(false);
    }
  }

  async function runAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!rulesFile || !archiveFile) {
      setError({
        title: "Two files are required",
        message: "Select both a rules file and a submission ZIP.",
        retryable: false,
      });
      return;
    }

    const controller = new AbortController();
    if (!sessionIdRef.current) {
      sessionIdRef.current = crypto.randomUUID();
    }
    abortControllerRef.current = controller;
    userCancelledRef.current = false;
    timedOutRef.current = false;
    setIsRunning(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("rules", rulesFile);
    formData.append("archive", archiveFile);
    formData.append("demoMode", String(demoMode));
    formData.append("submissionCopy", submissionCopy);

    timeoutRef.current = setTimeout(() => {
      timedOutRef.current = true;
      controller.abort();
    }, CLIENT_AUDIT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        body: formData,
        signal: controller.signal,
        headers: {
          "x-crossready-session": sessionIdRef.current,
        },
      });
      const contentType = response.headers.get("content-type") ?? "";
      let payload: AuditResponse | null = null;
      if (contentType.toLowerCase().includes("application/json")) {
        try {
          const candidate: unknown = await response.json();
          payload = isAuditResponse(candidate) ? candidate : null;
        } catch {
          payload = null;
        }
      }

      if (!payload) {
        setError({
          title: "The audit server did not respond",
          message: "Try the same files again shortly.",
          action: "Check the connection, then run the audit again.",
          retryable: true,
        });
        return;
      }

      if (!response.ok || !payload.ok) {
        setError(
          payload.ok
            ? {
                title: "The audit server did not respond",
                message: "Try the same files again shortly.",
                retryable: true,
              }
            : failureMessage(payload.error),
        );
        return;
      }

      setResult(payload);
    } catch (auditError) {
      if (auditError instanceof Error && auditError.name === "AbortError") {
        setError(
          timedOutRef.current
            ? {
                title: "The audit took too long",
                message: "It did not finish within 125 seconds and was stopped safely.",
                action: "Reduce the ZIP size or try again shortly.",
                retryable: true,
                code: "CLIENT_TIMEOUT",
              }
            : {
                title: "The audit was cancelled",
                message: userCancelledRef.current
                  ? "Your files were not changed. Run the audit again when you are ready."
                  : "The connection ended before the audit could finish.",
                retryable: true,
                code: "CANCELLED",
              },
        );
      } else {
        setError({
          title: "Could not connect to the audit server",
          message:
            auditError instanceof Error
              ? auditError.message
              : "Check your network connection and try again.",
          action: "Check the connection, then run the audit again.",
          retryable: true,
        });
      }
    } finally {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      abortControllerRef.current = null;
      setIsRunning(false);
    }
  }

  function cancelAudit() {
    userCancelledRef.current = true;
    abortControllerRef.current?.abort();
  }

  function retryAudit() {
    setError(null);
    formRef.current?.requestSubmit();
  }

  function openFinding(
    finding: AuditFinding,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    findingTriggerRef.current = event.currentTarget;
    setSelectedFinding(finding);
  }

  function closeFinding() {
    setSelectedFinding(null);
    requestAnimationFrame(() => findingTriggerRef.current?.focus());
  }

  const badge = result ? modeLabel(result) : null;
  const manifestState = result
    ? manifestSummary(result.inventory.manifest)
    : null;
  const modelMetadata = result ? modelMetadataSummary(result) : null;
  const modelFailureCopy = result?.modelFailure
    ? modelFailureMessage(result.modelFailure)
    : null;

  return (
    <div className="space-y-5">
      <form
        ref={formRef}
        onSubmit={runAudit}
        aria-busy={isRunning}
        className="overflow-hidden rounded-2xl border border-white/9 bg-panel/90 shadow-2xl shadow-black/15"
      >
        <div className="border-b border-white/8 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-white">
                Start an evidence audit
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Upload the rules and final submission ZIP to inspect the
                packaged evidence.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">
              {selectedCount} / 2 added
            </span>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <input
                ref={rulesInputRef}
                id="rules-file"
                name="rules-file"
                type="file"
                accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
                className="peer sr-only"
                onChange={selectRules}
                disabled={isRunning || isLoadingSample}
              />
              <label
                htmlFor="rules-file"
                className="group flex min-h-28 cursor-pointer flex-col justify-between rounded-xl border border-dashed border-white/12 bg-white/[0.018] p-4 transition-colors hover:border-accent/35 hover:bg-accent/[0.025] peer-focus-visible:border-accent/50 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-white/8 bg-white/4 text-zinc-400 transition-colors group-hover:text-accent">
                    <UploadIcon kind="rules" />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    PDF · MD · TXT
                  </span>
                </span>
                <span className="mt-4 block min-w-0">
                  <span className="block text-xs font-medium text-zinc-200">
                    Rules
                    <span className="ml-2 rounded bg-accent/8 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-accent/80">
                      Required
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-zinc-400">
                    {rulesFile?.name ?? "Choose a rules file"}
                  </span>
                </span>
              </label>
            </div>

            <div>
              <input
                ref={archiveInputRef}
                id="archive-file"
                name="archive-file"
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                className="peer sr-only"
                onChange={selectArchive}
                disabled={isRunning || isLoadingSample}
              />
              <label
                htmlFor="archive-file"
                className="group flex min-h-28 cursor-pointer flex-col justify-between rounded-xl border border-dashed border-white/12 bg-white/[0.018] p-4 transition-colors hover:border-accent/35 hover:bg-accent/[0.025] peer-focus-visible:border-accent/50 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-white/8 bg-white/4 text-zinc-400 transition-colors group-hover:text-accent">
                    <UploadIcon kind="archive" />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                    ZIP
                  </span>
                </span>
                <span className="mt-4 block min-w-0">
                  <span className="block text-xs font-medium text-zinc-200">
                    Submission bundle
                    <span className="ml-2 rounded bg-accent/8 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-accent/80">
                      Required
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-zinc-400">
                    {archiveFile?.name ?? "Choose a submission ZIP"}
                  </span>
                </span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={loadSample}
            disabled={isLoadingSample || isRunning}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300/20 bg-sky-400/[0.055] px-4 py-3 text-xs font-medium text-sky-100 transition-colors hover:border-sky-300/35 hover:bg-sky-400/[0.085] disabled:cursor-wait disabled:opacity-60"
          >
            <UploadIcon kind="scan" />
            {isLoadingSample
              ? "Loading sample…"
              : demoMode
                ? "Sample ready · Reload files"
                : "Try the broken sample"}
          </button>

          <div className="rounded-xl border border-white/7 bg-black/15 p-4">
            <label
              htmlFor="submission-copy"
              className="mb-2 block text-[11px] font-medium text-zinc-400"
            >
              Submission copy{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <textarea
              id="submission-copy"
              value={submissionCopy}
              onChange={(event) => setSubmissionCopy(event.target.value)}
              disabled={isRunning}
              className="h-16 w-full resize-y rounded-lg border border-white/8 bg-black/20 px-3 py-2.5 text-xs leading-5 text-zinc-300 placeholder:text-zinc-500 focus-visible:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
              placeholder="Paste the description reviewers will read…"
            />
            <p className="mt-2 text-[11px] leading-5 text-zinc-400">
              In a live GPT audit, the rules, this copy, and limited text
              previews from the ZIP are sent to OpenAI. CrossReady does not
              store them separately or send binary files from the ZIP.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-300/20 bg-rose-400/[0.07] p-4 text-[11px] leading-5 text-rose-100"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-rose-100">{error.title}</p>
                  <p className="mt-1 text-rose-100/75">{error.message}</p>
                  {error.action && (
                    <p className="mt-2 text-rose-100/60">
                      Next step: {error.action}
                    </p>
                  )}
                  {error.resetAt && (
                    <p className="mt-2 font-medium text-rose-100/80">
                      Available again after {formatResetTime(error.resetAt)}
                    </p>
                  )}
                </div>
                {error.retryable && (
                  <button
                    type="button"
                    onClick={retryAudit}
                    disabled={isRunning}
                    className="shrink-0 rounded-lg border border-rose-200/20 bg-rose-100/5 px-3 py-2 text-[10px] font-medium text-rose-100 transition-colors hover:bg-rose-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/40"
                  >
                    Retry audit
                  </button>
                )}
              </div>
              {(error.code || error.requestId) && (
                <p className="mt-3 break-all font-mono text-[8px] uppercase tracking-wider text-rose-100/40">
                  {error.code && `code ${error.code}`}
                  {error.code && error.requestId && " · "}
                  {error.requestId && `request ${error.requestId}`}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-white/8 bg-black/10 p-4 sm:p-5">
          <div className={isRunning ? "grid grid-cols-[1fr_auto] gap-2" : ""}>
            <button
              ref={runButtonRef}
              type="submit"
              disabled={
                !rulesFile || !archiveFile || isRunning || isLoadingSample
              }
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-[#082116] shadow-[0_0_30px_rgba(98,215,154,0.08)] transition-colors hover:bg-[#b5ffd4] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isRunning
                ? "Reading files and checking evidence…"
                : demoMode
                  ? "Run sample audit"
                  : "Run evidence audit"}
              {!isRunning && <UploadIcon kind="upload" />}
            </button>
            {isRunning && (
              <button
                type="button"
                onClick={cancelAudit}
                className="h-11 rounded-xl border border-white/12 bg-white/5 px-4 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                Cancel
              </button>
            )}
          </div>
          <p
            className="mt-3 text-center text-[11px] leading-5 text-zinc-400"
            aria-live="polite"
          >
            {isRunning
              ? "Safely unpacking the ZIP, inventorying files, and checking hashes."
              : demoMode
                ? "Sample files are ready. This audit uses bundled answer data and does not call GPT-5.6."
                : "Without an API key, the file scan still runs and only GPT extraction is skipped."}
          </p>
        </div>
      </form>

      <p className="sr-only" role="status" aria-live="polite">
        {result
          ? `Audit complete. ${result.inventory.totalFiles} files were read.`
          : ""}
      </p>

      {result && badge && manifestState && (
        <section
          data-audit-result
          aria-labelledby="audit-result-heading"
          className="overflow-hidden rounded-2xl border border-white/9 bg-panel/90 shadow-2xl shadow-black/15"
        >
          <div className="border-b border-white/8 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2
                  ref={resultHeadingRef}
                  id="audit-result-heading"
                  tabIndex={-1}
                  className="text-sm font-medium text-white"
                >
                  Latest audit result
                </h2>
                <p className="mt-1 max-w-md truncate text-[11px] text-zinc-400">
                  {result.inventory.archiveName}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] ring-1 ring-inset ${badge.className}`}
                title={badge.detail}
              >
                {badge.title}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              {modelMetadata && modelMetadata.durationMs > 0 && (
                <span>{(modelMetadata.durationMs / 1000).toFixed(1)}s</span>
              )}
              {modelMetadata && modelMetadata.models.length > 0 && (
                <span>{modelMetadata.models.join(" + ")}</span>
              )}
              {modelMetadata && modelMetadata.totalTokens > 0 && (
                <span>
                  {modelMetadata.totalTokens.toLocaleString("en-US")} tokens
                </span>
              )}
              {result.limits && (
                <span
                  className={
                    result.limits.remaining === 0
                      ? "text-amber-200"
                      : "text-zinc-500"
                  }
                >
                  audits remaining {result.limits.remaining}/{result.limits.limit}
                  {result.limits.remaining === 0 &&
                    ` · resets ${formatResetTime(result.limits.resetAt)}`}
                </span>
              )}
            </div>
          </div>

          {result.modelFailure && modelFailureCopy && (
            <div
              role="status"
              className="border-b border-amber-200/15 bg-amber-200/[0.045] px-5 py-4 sm:px-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-amber-100">
                    {modelFailureCopy.title}
                  </p>
                  <p className="mt-1 text-[10px] leading-5 text-amber-100/70">
                    {modelFailureCopy.message}
                  </p>
                  <p className="mt-2 text-[10px] leading-5 text-amber-100/60">
                    Next step: {modelFailureCopy.action}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-200/15 bg-amber-100/5 px-2.5 py-1 font-mono text-[8px] uppercase tracking-wider text-amber-100/70">
                    {result.modelFailure.retryable
                      ? "retry available"
                      : "manual check"}
                  </span>
                  {result.modelFailure.retryable && (
                    <button
                      type="button"
                      onClick={retryAudit}
                      className="rounded-lg border border-amber-200/20 bg-amber-100/5 px-3 py-1.5 text-[9px] font-medium text-amber-100 transition-colors hover:bg-amber-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40"
                    >
                      Retry audit
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-3 break-all font-mono text-[8px] uppercase tracking-wider text-amber-100/40">
                code {result.modelFailure.code}
                {result.modelFailure.requestId &&
                  ` · request ${result.modelFailure.requestId}`}
              </p>
            </div>
          )}

          {result.report && (
            <>
              <div className="grid grid-cols-2 border-b border-white/8 sm:grid-cols-4">
                {[
                  {
                    label: "Proven",
                    value: result.report.summary.proven,
                    tone: "text-emerald-300",
                  },
                  {
                    label: "Contradicted",
                    value: result.report.summary.contradicted,
                    tone: "text-rose-300",
                  },
                  {
                    label: "Missing",
                    value: result.report.summary.missing,
                    tone: "text-amber-200",
                  },
                  {
                    label: "Needs review",
                    value: result.report.summary.needsHuman,
                    tone: "text-sky-300",
                  },
                ].map((item, index) => (
                  <div
                    key={item.label}
                    className={`border-white/8 px-4 py-4 ${
                      index % 2 === 0 ? "border-r" : ""
                    } ${index < 2 ? "border-b sm:border-b-0" : ""} ${
                      index === 1 ? "sm:border-r" : ""
                    }`}
                  >
                    <p className={`font-mono text-xl ${item.tone}`}>
                      {item.value}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-400">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-b border-white/8 p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-medium text-white">
                      {result.mode === "sample"
                        ? "Bundled sample findings"
                        : result.mode === "partial"
                          ? "Partially completed audit"
                          : "Live audit findings"}
                    </h3>
                    <p className="mt-1 text-[11px] leading-5 text-zinc-400">
                      Open a finding to review exact file locations and source
                      excerpts.
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-400">
                    {result.report.findings.length} findings
                  </span>
                </div>

                {result.report.findings.length > 0 ? (
                  <div className="space-y-2">
                    {result.report.findings.map((finding) => {
                      const status = findingStatus(finding.status);
                      return (
                        <button
                          key={finding.id}
                          type="button"
                          onClick={(event) => openFinding(finding, event)}
                          className="group w-full rounded-xl border border-white/8 bg-white/[0.018] p-4 text-left transition-colors hover:border-white/14 hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] ring-1 ring-inset ${status.className}`}
                                >
                                  {status.label}
                                </span>
                                <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-400">
                                  {finding.severity}
                                </span>
                              </div>
                              <p className="mt-2 text-xs font-medium leading-5 text-zinc-200">
                                {finding.title}
                              </p>
                              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-zinc-400">
                                {finding.explanation}
                              </p>
                            </div>
                            <span
                              aria-hidden="true"
                              className="mt-1 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                            >
                              →
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-zinc-400">
                    No findings to display.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="grid grid-cols-3 border-b border-white/8">
            <div className="border-r border-white/8 px-4 py-4">
              <p className="font-mono text-lg text-zinc-100">
                {result.inventory.totalFiles}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-400">
                Files read
              </p>
            </div>
            <div className="border-r border-white/8 px-4 py-4">
              <p className="font-mono text-lg text-zinc-100">
                {formatBytes(result.inventory.totalUncompressedBytes)}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-400">
                Unpacked
              </p>
            </div>
            <div className="px-4 py-4">
              <p className={`font-mono text-lg ${manifestState.tone}`}>
                {manifestState.value}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-400">
                {manifestState.label}
              </p>
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            {result.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200/15 bg-amber-200/[0.045] p-3">
                <p className="text-[11px] font-medium text-amber-100">
                  Review notes
                </p>
                <ul className="mt-2 space-y-1 text-[11px] leading-5 text-amber-100/80">
                  {result.warnings.map((warning) => (
                    <li key={warning}>· {warningLabel(warning)}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-400">
                  Files inside the ZIP
                </h3>
                <span
                  className="font-mono text-[9px] text-zinc-500"
                  title={result.inventory.archiveSha256}
                >
                  ZIP {shortHash(result.inventory.archiveSha256)}
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-white/7 bg-black/15">
                <ul className="divide-y divide-white/6">
                  {result.inventory.entries.map((entry) => (
                    <li
                      key={entry.path}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[10px] text-zinc-300">
                          {entry.path}
                        </p>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                          {entry.kind} · {formatBytes(entry.size)}
                        </p>
                      </div>
                      <code
                        className="shrink-0 text-[9px] text-zinc-400"
                        title={entry.sha256}
                      >
                        {shortHash(entry.sha256)}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {result.inventory.manifest.mismatches.length > 0 && (
              <div>
                <h3 className="mb-2 font-mono text-[9px] uppercase tracking-[0.15em] text-rose-300">
                  Manifest mismatches
                </h3>
                <div className="space-y-2">
                  {result.inventory.manifest.mismatches.map((mismatch) => (
                    <article
                      key={`${mismatch.path}-${mismatch.reason}`}
                      className="rounded-xl border border-rose-300/12 bg-rose-400/[0.035] p-3"
                    >
                      <p className="break-all text-[10px] text-zinc-200">
                        {mismatch.path}
                      </p>
                      <p className="mt-1 text-[9px] leading-4 text-rose-200/70">
                        {mismatchReasonLabel(mismatch.reason)}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-400">
                  {result.mode === "sample"
                    ? "Bundled sample requirements"
                    : "Extracted requirements"}
                </h3>
                <span className="font-mono text-[9px] text-accent">
                  {result.requirements?.requirements.length ?? 0}
                </span>
              </div>

              {result.requirements ? (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {result.requirements.requirements.map((requirement) => (
                    <article
                      key={requirement.id}
                      className="rounded-xl border border-white/7 bg-white/[0.018] p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[8px] text-accent">
                          {requirement.id}
                        </span>
                        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider text-zinc-400">
                          {requirement.modality}
                        </span>
                        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-wider text-zinc-400">
                          {requirement.criticality}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] leading-5 text-zinc-300">
                        {requirement.statement}
                      </p>
                      <p className="mt-2 border-l border-accent/20 pl-2 text-[11px] leading-5 text-zinc-400">
                        {requirement.source.locator}:{" "}
                        {requirement.source.excerpt}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-[11px] leading-5 text-zinc-400">
                  The file inventory is complete. Connect an OpenAI API key on
                  the server to include automatic requirement extraction.
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      {selectedFinding && (
        <FindingDetailDialog
          finding={selectedFinding}
          onClose={closeFinding}
        />
      )}
    </div>
  );
}
