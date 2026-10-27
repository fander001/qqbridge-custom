/**
 * dsh-setting-restart — detached relaunch helper.
 *
 * Spawned by the host service with `detached: true` before the DSH process
 * exits. It waits until the old process is gone (so the port and other
 * resources are released), then re-spawns the exact same command
 * (`process.execPath` + the original argv, in the original cwd) detached,
 * and exits itself. The new DSH instance therefore binds the same port and
 * the browser tab reconnects automatically.
 *
 * Usage: node relaunch.js <json-payload> | node relaunch.js - (payload on
 * stdin) | node relaunch.js b64:<base64-payload>
 * Payload: { pid, execPath, argv, cwd, timeoutMs?, pollMs? }
 */
import { spawn } from "node:child_process";

let raw;
if (process.argv[2] === "-") {
  raw = await new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
  });
} else if (typeof process.argv[2] === "string" && process.argv[2].startsWith("b64:")) {
  raw = Buffer.from(process.argv[2].slice(4), "base64").toString("utf8");
} else {
  raw = process.argv[2];
}

let payload;
try {
  payload = JSON.parse(raw);
} catch (error) {
  console.error("[dsh-setting-restart] relaunch helper: invalid payload:", error);
  process.exit(1);
}

const { pid, execPath, argv, cwd } = payload;
if (
  !Number.isInteger(pid) ||
  typeof execPath !== "string" ||
  !Array.isArray(argv) ||
  argv.length === 0 ||
  typeof cwd !== "string"
) {
  console.error("[dsh-setting-restart] relaunch helper: malformed payload");
  process.exit(1);
}

const timeoutMs = Number.isFinite(payload.timeoutMs) ? payload.timeoutMs : 30000;
const pollMs = Number.isFinite(payload.pollMs) && payload.pollMs > 0 ? payload.pollMs : 250;
const deadline = Date.now() + timeoutMs;

/** Whether a process with the given pid still exists (Windows-safe). */
function alive(target) {
  try {
    process.kill(target, 0);
    return true;
  } catch {
    return false;
  }
}

// Wait for the old process to exit, or give up at the deadline.
await new Promise((resolve) => {
  const timer = setInterval(() => {
    if (!alive(pid) || Date.now() >= deadline) {
      clearInterval(timer);
      resolve();
    }
  }, pollMs);
});

const child = spawn(execPath, argv, {
  cwd,
  detached: true,
  stdio: "ignore",
  windowsHide: true,
  env: process.env
});
child.unref();
process.exit(0);
