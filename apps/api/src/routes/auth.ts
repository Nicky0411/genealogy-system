import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { query } from "../db/query";
import { asyncHandler } from "../middleware/asyncHandler";
import { httpError } from "../middleware/error";
import { signToken } from "../middleware/auth";

export const authRouter = Router();

const registerSchema = z.object({
  username: z.string().min(2).max(64).regex(/^\S+$/, "Username cannot contain spaces"),
  password: z.string().min(6),
  confirmPassword: z.string().min(6)
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string().min(1)
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, 10);
    const email = `${input.username.toLowerCase()}@genealogy.local`;

    const existing = await query<{ user_id: string }>(
      "SELECT user_id FROM users WHERE username = $1 OR email = $2 LIMIT 1",
      [input.username, email]
    );

    if (existing.rows.length > 0) {
      throw httpError(409, "Username already exists");
    }

    const result = await query<{ user_id: string; username: string; email: string }>(
      `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING user_id, username, email
      `,
      [input.username, email, passwordHash]
    );

    const user = result.rows[0];
    const token = signToken({ userId: Number(user.user_id), username: user.username });
    res.status(201).json({ token, user: { userId: Number(user.user_id), username: user.username, email: user.email } });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);

    const result = await query<{ user_id: string; username: string; email: string; password_hash: string }>(
      `
      SELECT user_id, username, email, password_hash
      FROM users
      WHERE username = $1 OR email = $1
      LIMIT 1
      `,
      [input.usernameOrEmail]
    );

    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
      throw httpError(401, "Invalid username or password");
    }

    const token = signToken({ userId: Number(user.user_id), username: user.username });
    res.json({ token, user: { userId: Number(user.user_id), username: user.username, email: user.email } });
  })
);
