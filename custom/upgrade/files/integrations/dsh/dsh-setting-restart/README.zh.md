# dsh-setting-restart

在 **设置 → 通用设置** 页面一键重启 DSH 服务。「一键重启」这一行固定在通用设置页面的最底部——之后无论通用设置里新增多少功能，它始终显示在页面最下方。重启后页面自动重连，按钮会显示绿色「连接成功」，确认服务已恢复。

[![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-blue)](https://github.com/topics/dsh-plugin)

## 功能

- 通用设置页面最底部新增「**一键重启**」一行（固定在最下方，不依赖与其他设置项的相对位置）。
- 使用最大插槽 `order` 值固定行位置：之后无论通用设置里加了多少东西，它总在页面最下方。
- 真正的进程级重启：宿主进程先派生出独立的 relaunch 辅助进程，然后自身退出；辅助进程等旧进程完全退出后，用完全相同的命令（可执行文件、参数、工作目录、环境变量）重新拉起 DSH。新实例绑定同一端口后，浏览器页面自动重连。
- 界面文案中英双语，遵循 DSH 客户端约定。
- 通过 DSH Typert RPC 注册表提供类型化的宿主调用（`settingRestart/restart`）。

## 环境要求

- DeepSeek Harness `dsh` ≥ 0.1.0-rc.6（`web` profile）。
- Node.js ≥ 20。

## 安装

1. 把插件安装到 `web` profile（该命令会在 profile 目录内执行 `pnpm add`）：

   ```sh
   dsh plugin --profile web add dsh-setting-restart
   ```

2. 在 profile 的用户 patch 层 `$DSH_HOME/profiles/web/cordis.patch.yml`（`$DSH_HOME` 默认为 `~/.dsh`）追加一个 `insert` patch，把插件挂载为 loader entry：

   ```yaml
   # $DSH_HOME/profiles/web/cordis.patch.yml
   - insert:
       - id: setting-restart
         name: dsh-setting-restart
   ```

3. 启动（或重启）服务：

   ```sh
   dsh web
   ```

4. 打开 **设置 → 通用设置**，最底部即是「一键重启」；点击「重启」即可重启服务，页面会自动重连。

> 把同样的 patch 加到全局层 `$DSH_HOME/cordis.patch.yml`，即可为所有 profile 启用该插件。

## 配置项

loader entry 支持可选的 `config` 配置：

```yaml
- insert:
    - id: setting-restart
      name: dsh-setting-restart
      config:
        exitDelayMs: 1500    # 点击响应后到进程退出之间的延迟（默认 1200 毫秒）
        waitForExitMs: 30000 # 辅助进程等待旧进程退出的最长时间（默认 30000 毫秒）
        respawn: true        # 若由 systemd/pm2 等守护进程负责拉起，可设为 false
```

## 工作原理

```
浏览器设置行（client.js）
  └─ connection.rpc.call("/api", "settingRestart/restart", { args: {} })
       └─ api-gateway 按 typert 严格调用定义分发
            └─ SettingRestartService.restart()（index.js）
                 ├─ 以 detached 方式派生 relaunch.js ── 等待旧进程退出 ── 用相同命令重新拉起
                 └─ 延迟 exitDelayMs 后 process.exit(0)
```

- `client.js` — 浏览器端 bundle（`dsh.client` / `exports["./client"]`），注册设置行。
- `typert.host.js` — TYPERT 宿主 manifest（`exports["./typert"]`），声明严格的 `settingRestart/restart` 调用。
- `index.js` — 宿主插件（`SettingRestartService`），执行重启。
- `relaunch.js` — 独立辅助进程，旧进程退出后重新拉起同一命令。

## 发布

本包发布到 npm，并以 GitHub 仓库托管，打上 [`dsh-plugin` topic](https://github.com/topics/dsh-plugin)：

```sh
npm publish
# 然后在 GitHub 仓库页面：Settings → Manage topics → 添加 "dsh-plugin"
```

## License

MIT
