/**
 * dsh-setting-restart — host face.
 *
 * Registers the `settingRestart` Cordis service. The Typert gateway
 * (dsh-api-gateway) dispatches the `settingRestart/restart` endpoint to this
 * service using the strict invocation declared in `./typert.host.js`.
 *
 * The restart is a self-relaunch: a detached helper process (`relaunch.js`)
 * is spawned first, this process exits after a short delay, and the helper
 * re-spawns the exact same command once this process is gone. The browser
 * tab reconnects automatically when the new instance binds the same port.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import s from "@deepseek-ai/schemastery";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

/** Absolute path of the detached relaunch helper shipped with this package. */
const RELAUNCH_HELPER = fileURLToPath(new URL("./relaunch.js", import.meta.url));

/** Business failure when a restart request arrives while one is already in flight. */
const ALREADY_RESTARTING = "already-restarting";

/**
 * Restart the DSH host process.
 *
 * Extends TypertRemoteService so the gateway's binding check
 * (`typertRemote.service/serviceKey/namespace`) passes; the strict
 * invocation from `typert.host.js` is what actually routes the endpoint.
 */
class SettingRestartService extends TypertRemoteService {
  /** Deployment policy: how long to wait before exiting, and whether to relaunch. */
  static Config = s.object({
    /** Milliseconds between the RPC response and `process.exit(0)`. */
    exitDelayMs: s.number().step(1).min(100).max(10000).default(1200),
    /** How long the detached helper waits for this process to exit before giving up. */
    waitForExitMs: s.number().step(1).min(1000).max(120000).default(30000),
    /**
     * When true the helper re-spawns this command after the process exits.
     * Set to false when a supervisor (systemd / pm2 / a wrapper script)
     * already restarts the service.
     */
    respawn: s.boolean().default(true)
  });

  constructor(ctx, config) {
    super(ctx, "settingRestart");
    this.exitDelayMs = config.exitDelayMs;
    this.waitForExitMs = config.waitForExitMs;
    this.respawn = config.respawn;
    this.restarting = false;
    this.exitTimer = null;
  }

  /**
   * Schedule a host process restart and exit.
   * @returns `{ ok: true, value: { scheduled: true } }` once the relaunch
   * helper is running, or an explicit failure.
   */
  async restart() {
    if (this.restarting) {
      return {
        ok: false,
        error: {
          code: ALREADY_RESTARTING,
          message: "a restart is already scheduled"
        }
      };
    }
    this.restarting = true;
    try {
      if (this.respawn) {
        const payload = {
          pid: process.pid,
          execPath: process.execPath,
          argv: process.argv.slice(1),
          cwd: process.cwd(),
          timeoutMs: this.waitForExitMs,
          pollMs: 250
        };
        const helper = spawn(process.execPath, [RELAUNCH_HELPER, JSON.stringify(payload)], {
          detached: true,
          stdio: "ignore",
          windowsHide: true
        });
        helper.unref();
        helper.on("error", (error) => {
          console.error("[dsh-setting-restart] relaunch helper failed to start:", error);
          if (this.exitTimer !== null) {
            clearTimeout(this.exitTimer);
            this.exitTimer = null;
          }
          this.restarting = false;
        });
      }
      console.log(
        `[dsh-setting-restart] scheduling restart (pid ${process.pid}, respawn=${String(this.respawn)}) — exiting in ${String(this.exitDelayMs)}ms`
      );
      this.exitTimer = setTimeout(() => process.exit(0), this.exitDelayMs);
      return { ok: true, value: { scheduled: true } };
    } catch (error) {
      this.restarting = false;
      return {
        ok: false,
        error: {
          code: "restart-failed",
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
}

export { SettingRestartService };
export default SettingRestartService;
