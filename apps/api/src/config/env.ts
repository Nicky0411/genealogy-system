import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.API_PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL ?? "postgres://genealogy:genealogy@localhost:5432/genealogy",
  jwtSecret: process.env.JWT_SECRET ?? "development-only-change-me"
};
