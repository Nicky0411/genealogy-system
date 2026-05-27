import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const node = process.execPath;

function readEnvFile() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return {};

  const env = {};
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    env[key] = value;
  }

  return env;
}

const env = {
  ...process.env,
  ...readEnvFile()
};

function start(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false
  });

  child.stdout.on("data", (data) => {
    process.stdout.write(`[${name}] ${data}`);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(`[${name}] ${data}`);
  });

  child.on("exit", (code) => {
    if (!shuttingDown) {
      console.log(`[${name}] exited with code ${code}`);
    }
  });

  return child;
}

let shuttingDown = false;

const api = start(
  "api",
  node,
  [join(root, "node_modules", "tsx", "dist", "cli.mjs"), "watch", join(root, "apps", "api", "src", "main.ts")],
  root
);

const web = start(
  "web",
  node,
  [join(root, "node_modules", "vite", "bin", "vite.js"), "--host", "0.0.0.0"],
  join(root, "apps", "web")
);

console.log("");
console.log("Genealogy manager is starting...");
console.log("Web: http://localhost:5173/");
console.log("API: http://localhost:4000");
console.log("Press Ctrl+C to stop both services.");
console.log("");

function stop() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nStopping services...");
  api.kill("SIGTERM");
  web.kill("SIGTERM");
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
