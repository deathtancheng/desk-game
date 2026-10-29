import { execSync } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiDir = path.join(root, "app", "api");
const backupDir = path.join(root, ".static-api-backup");
const outDir = path.join(root, "out");

if (existsSync(backupDir)) rmSync(backupDir, { recursive: true, force: true });
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
if (!existsSync(apiDir)) throw new Error("app/api not found; cannot build static export");

// Next static export cannot include API routes. The deployed site uses the
// Qoder Sites Function under /functions/v1/app instead.
renameSync(apiDir, backupDir);

try {
  execSync("npx next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      STATIC_EXPORT: "1",
      NEXT_PUBLIC_CLOUD_BASE: "/functions/v1/app",
    },
  });
} finally {
  if (existsSync(apiDir)) rmSync(apiDir, { recursive: true, force: true });
  renameSync(backupDir, apiDir);
}

if (!existsSync(path.join(outDir, "index.html"))) {
  throw new Error("static build finished without out/index.html");
}

console.log("static build ready: out/");
