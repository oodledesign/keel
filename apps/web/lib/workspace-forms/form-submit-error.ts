export class FormSubmitError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'FormSubmitError';
    this.statusCode = statusCode;
  }
}
