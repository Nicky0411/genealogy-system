import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { pool } from "./db/pool";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { routes } from "./routes";

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  const result = await pool.query("SELECT NOW() AS now");
  res.json({ ok: true, databaseTime: result.rows[0].now });
});

app.use("/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
