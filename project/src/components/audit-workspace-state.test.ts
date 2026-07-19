import { describe, expect, it } from "vitest";

import {
  auditCopyModeReducer,
  type AuditCopyModeState,
} from "./audit-workspace-state";

describe("auditCopyModeReducer", () => {
  it("enters sample mode when sample files load with empty copy", () => {
    const initial: AuditCopyModeState = {
      submissionCopy: "",
      demoMode: false,
      sampleFilesLoaded: false,
    };

    expect(
      auditCopyModeReducer(initial, { type: "sample_loaded" }),
    ).toEqual({
      submissionCopy: "",
      demoMode: true,
      sampleFilesLoaded: true,
    });
  });

  it("preserves existing submission copy and keeps fixed answers off when sample files load", () => {
    const previous: AuditCopyModeState = {
      submissionCopy: "Old reviewer copy",
      demoMode: false,
      sampleFilesLoaded: false,
    };

    expect(
      auditCopyModeReducer(previous, { type: "sample_loaded" }),
    ).toEqual({
      submissionCopy: "Old reviewer copy",
      demoMode: false,
      sampleFilesLoaded: true,
    });
  });

  it("leaves sample mode immediately when submission copy is edited", () => {
    const sampleReady: AuditCopyModeState = {
      submissionCopy: "",
      demoMode: true,
      sampleFilesLoaded: true,
    };

    expect(
      auditCopyModeReducer(sampleReady, {
        type: "submission_copy_changed",
        value: "Edited claim",
      }),
    ).toEqual({
      submissionCopy: "Edited claim",
      demoMode: false,
      sampleFilesLoaded: true,
    });
  });

  it("treats whitespace-only copy as empty for the sample UI", () => {
    const sampleReady: AuditCopyModeState = {
      submissionCopy: "Edited claim",
      demoMode: false,
      sampleFilesLoaded: true,
    };

    expect(
      auditCopyModeReducer(sampleReady, {
        type: "submission_copy_changed",
        value: " \n\t ",
      }),
    ).toEqual({
      submissionCopy: " \n\t ",
      demoMode: true,
      sampleFilesLoaded: true,
    });
  });

  it("re-enters sample mode when edited copy is cleared", () => {
    const editedSample: AuditCopyModeState = {
      submissionCopy: "Edited claim",
      demoMode: false,
      sampleFilesLoaded: true,
    };

    expect(
      auditCopyModeReducer(editedSample, {
        type: "submission_copy_changed",
        value: "",
      }),
    ).toEqual({
      submissionCopy: "",
      demoMode: true,
      sampleFilesLoaded: true,
    });
  });

  it("forgets sample provenance when either file is selected manually", () => {
    const sampleReady: AuditCopyModeState = {
      submissionCopy: "",
      demoMode: true,
      sampleFilesLoaded: true,
    };

    expect(
      auditCopyModeReducer(sampleReady, { type: "demo_disabled" }),
    ).toEqual({
      submissionCopy: "",
      demoMode: false,
      sampleFilesLoaded: false,
    });
  });
});
