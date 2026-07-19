export interface AuditCopyModeState {
  submissionCopy: string;
  demoMode: boolean;
  sampleFilesLoaded: boolean;
}

export type AuditCopyModeAction =
  | { type: "demo_disabled" }
  | { type: "sample_loaded" }
  | { type: "submission_copy_changed"; value: string };

export const INITIAL_AUDIT_COPY_MODE_STATE: AuditCopyModeState = {
  submissionCopy: "",
  demoMode: false,
  sampleFilesLoaded: false,
};

export function auditCopyModeReducer(
  state: AuditCopyModeState,
  action: AuditCopyModeAction,
): AuditCopyModeState {
  switch (action.type) {
    case "demo_disabled":
      return { ...state, demoMode: false, sampleFilesLoaded: false };
    case "sample_loaded":
      return {
        ...state,
        demoMode: state.submissionCopy.trim() === "",
        sampleFilesLoaded: true,
      };
    case "submission_copy_changed":
      return {
        ...state,
        submissionCopy: action.value,
        demoMode:
          state.sampleFilesLoaded && action.value.trim() === "",
      };
  }
}
