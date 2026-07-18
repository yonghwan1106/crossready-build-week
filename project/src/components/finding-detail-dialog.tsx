"use client";

import { useEffect, useRef } from "react";
import type { AuditFinding } from "@/lib/audit/types";

function factTypeLabel(factType: AuditFinding["evidence"][number]["factType"]) {
  const labels = {
    deterministic: "파일에서 직접 계산",
    model_extracted: "GPT가 찾고 서버가 인용 확인",
    user_supplied: "사용자 제공",
  };
  return labels[factType];
}

type FindingDetailDialogProps = {
  finding: AuditFinding;
  onClose: () => void;
};

function statusDetails(status: string) {
  const details: Record<string, { label: string; className: string }> = {
    PROVEN: {
      label: "확인됨",
      className: "bg-emerald-400/10 text-emerald-300 ring-emerald-300/20",
    },
    MISSING: {
      label: "근거 없음",
      className: "bg-amber-300/10 text-amber-200 ring-amber-200/20",
    },
    CONTRADICTED: {
      label: "서로 모순",
      className: "bg-rose-400/10 text-rose-300 ring-rose-300/20",
    },
    NEEDS_HUMAN: {
      label: "사람 확인 필요",
      className: "bg-sky-400/10 text-sky-300 ring-sky-300/20",
    },
  };

  return (
    details[status] ?? {
      label: status,
      className: "bg-white/5 text-zinc-300 ring-white/10",
    }
  );
}

export function FindingDetailDialog({
  finding,
  onClose,
}: FindingDetailDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const status = statusDetails(finding.status);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="finding-dialog-title"
        aria-describedby="finding-dialog-description"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-white/12 bg-[#11141a] shadow-2xl shadow-black/50 sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/8 bg-[#11141a]/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] ring-1 ring-inset ${status.className}`}
              >
                {status.label}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                {finding.severity} · {finding.id}
              </span>
            </div>
            <h2
              id="finding-dialog-title"
              className="text-base font-medium leading-6 text-white"
            >
              {finding.title}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-lg text-zinc-300 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            aria-label="판정 상세 닫기"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <h3 className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-500">
              확인한 주장
            </h3>
            <p
              id="finding-dialog-description"
              className="mt-2 text-sm leading-6 text-zinc-200"
            >
              {finding.claim}
            </p>
            <p className="mt-2 text-xs leading-6 text-zinc-400">
              {finding.explanation}
            </p>
          </div>

          {finding.requirementIds.length > 0 && (
            <div>
              <h3 className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-500">
                연결된 요구사항
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {finding.requirementIds.map((requirementId) => (
                  <span
                    key={requirementId}
                    className="rounded-md bg-accent/8 px-2 py-1 font-mono text-[9px] text-accent"
                  >
                    {requirementId}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="font-mono text-[9px] uppercase tracking-[0.15em] text-zinc-500">
                정확한 근거
              </h3>
              <span className="text-[10px] text-zinc-500">
                {finding.evidence.length}개
              </span>
            </div>
            {finding.evidence.length > 0 ? (
              <div className="space-y-2">
                {finding.evidence.map((evidence, index) => (
                  <article
                    key={`${evidence.artifactId}-${evidence.locator}-${index}`}
                    className="rounded-xl border border-white/8 bg-black/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="break-all font-mono text-[10px] text-accent">
                        {evidence.artifactId}
                      </p>
                      <span className="rounded bg-white/5 px-1.5 py-1 text-[9px] text-zinc-400">
                        {factTypeLabel(evidence.factType)}
                      </span>
                    </div>
                    <p className="mt-2 break-all text-[10px] text-zinc-400">
                      {evidence.locatorType} · {evidence.locator}
                    </p>
                    <blockquote className="mt-3 border-l-2 border-accent/25 pl-3 text-[11px] leading-5 text-zinc-300">
                      {evidence.excerpt}
                    </blockquote>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-4 text-[11px] text-zinc-500">
                이 판정에 연결된 직접 근거가 없습니다.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-accent/15 bg-accent/[0.045] p-4">
            <h3 className="text-[10px] font-medium text-accent">다음에 할 일</h3>
            <p className="mt-2 text-xs leading-6 text-zinc-300">
              {finding.recommendedAction}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
