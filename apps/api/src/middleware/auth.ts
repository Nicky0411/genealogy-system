import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AuthUser {
  userId: number;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.jwtSecret, { expiresIn: "7d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) {
    res.status(401).json({ message: "Missing authorization token" });
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthUser;
    req.user = { userId: Number(payload.userId), username: payload.username };
    next();
  } catch {
    res.status(401).json({ message: "Invalid authorization token" });
  }
}
