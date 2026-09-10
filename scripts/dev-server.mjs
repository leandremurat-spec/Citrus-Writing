/**
 * Starts the Next.js dev server from the project root, independent of the caller's
 * working directory or PATH. Used by .claude/launch.json so the in-app preview works even
 * when the app's environment has no `node` on PATH (this file is run with an absolute path
 * to node.exe). `npm run dev` remains the normal way to start the server from a terminal.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const port = process.env.PORT || "3000";

const child = spawn(process.execPath, [nextBin, "dev", "--port", port], {
  cwd: root,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill());
}
