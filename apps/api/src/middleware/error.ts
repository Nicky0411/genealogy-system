import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export interface HttpError extends Error {
  status?: number;
}

export function httpError(status: number, message: string) {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: "Route not found" });
}

export function errorHandler(error: HttpError, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    res.status(400).json({ message: "Invalid request", issues: error.issues });
    return;
  }

  const status = error.status ?? 500;
  res.status(status).json({
    message: status === 500 ? "Internal server error" : error.message
  });
}
