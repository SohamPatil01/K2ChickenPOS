export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, 'NOT_FOUND', what);
export const badRequest = (code: string, message: string, extra?: Record<string, unknown>) =>
  new HttpError(400, code, message, extra);
