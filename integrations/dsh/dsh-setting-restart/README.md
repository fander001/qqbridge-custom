# dsh-setting-restart

One-click restart of the DSH service, from **Settings → General**. The "一键重启" row is pinned at the very bottom of the General settings page — no matter how many rows are added above it later, it always stays the last one. After the restart the page reconnects automatically and the row confirms it with a green "Connected" state, so you always know the service is back.

[![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-blue)](https://github.com/topics/dsh-plugin)

## Features

- A **one-click restart** row at the bottom of **Settings → General** (below "繁忙时 Enter 键行为" / whatever comes last).
- The row is pinned with the maximum slot `order`, so it always renders at the bottom of the page.
- Restart is a real process restart: the host spawns a detached helper, exits, and the helper re-spawns the exact same `dsh` command (same executable, arguments, cwd and environment). The browser tab reconnects automatically once the new instance binds the same port.
- Bilingual UI copy (简体中文 / English), following the DSH client conventions.
- Fully typed host invocation through the DSH Typert RPC registry (`settingRestart/restart`).

## Requirements

- DeepSeek Harness `dsh` ≥ 0.1.0-rc.6 (the `web` profile).
- Node.js ≥ 20.

## Installation

1. Install the package into the `web` profile (this runs `pnpm add` inside the profile directory):

   ```sh
   dsh plugin --profile web add dsh-setting-restart
   ```

2. Mount it as a loader entry by appending an `insert` patch to the profile's user patch layer — `$DSH_HOME/profiles/web/cordis.patch.yml` (`$DSH_HOME` defaults to `~/.dsh`):

   ```yaml
   # $DSH_HOME/profiles/web/cordis.patch.yml
   - insert:
       - id: setting-restart
         name: dsh-setting-restart
   ```

3. Start (or restart) the service:

   ```sh
   dsh web
   ```

4. Open **Settings → General** — the "一键重启" row is at the very bottom. Click **重启** to restart the service; the page reconnects automatically.

> The same patch can be added to the home-level `$DSH_HOME/cordis.patch.yml` to enable the plugin for every profile.

## Configuration

The loader entry accepts an optional `config` block:

```yaml
- insert:
    - id: setting-restart
      name: dsh-setting-restart
      config:
        exitDelayMs: 1500    # delay between the click response and process exit (default 1200)
        waitForExitMs: 30000 # how long the helper waits for the old process to exit (default 30000)
        respawn: true        # set false when a supervisor (systemd/pm2) already restarts the service
```

## How it works

```
browser row (client.js)
  └─ connection.rpc.call("/api", "settingRestart/restart", { args: {} })
       └─ api-gateway dispatches the strict typert invocation
            └─ SettingRestartService.restart() (index.js)
                 ├─ spawns relaunch.js detached  ── waits for pid to die ── re-spawns the same command
                 └─ process.exit(0) after exitDelayMs
```

- `client.js` — the browser bundle (`dsh.client` / `exports["./client"]`) that registers the settings row.
- `typert.host.js` — the TYPERT host manifest (`exports["./typert"]`) declaring the strict `settingRestart/restart` invocation.
- `index.js` — the host plugin (`SettingRestartService`) that performs the restart.
- `relaunch.js` — the detached helper that re-spawns the command after the old process exits.

## Publishing

This package is published to npm and hosted on GitHub under the [`dsh-plugin` topic](https://github.com/topics/dsh-plugin):

```sh
npm publish
# then, on the GitHub repository page:
# Settings → Manage topics → add "dsh-plugin"
```

## License

MIT
