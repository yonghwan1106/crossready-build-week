export class AuditInputError extends Error {
  readonly code: string;
  readonly status: 400 | 413;

  constructor(code: string, message: string, status: 400 | 413 = 400) {
    super(message);
    this.name = "AuditInputError";
    this.code = code;
    this.status = status;
  }
}
