import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  void _next;
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
};
