# qqbridge 魔改版

基于 [Derpyu520/qq-bridge](https://github.com/Derpyu520/qq-bridge) 的个人定制版。连接 QQ / OneBot v11 与 DeepSeek Harness（DSH），把群聊控制、峰谷策略、续聊和网页控制台定制拆成独立模块，并提供带预检的上游升级补丁包。

原项目已经提供网页控制台、角色卡与仿真模式；本仓库在此基础上扩展，不代表 QQ、DeepSeek、NapCat 或 SnowLuma 官方产品。

## 主要定制

- 群聊总开关：关闭时停止所有群聊，包括管理员在群里的艾特，保留管理员私聊。
- 每日定时开关：北京时间，支持跨午夜；手动切换会停用定时。
- 高峰／闲时权限矩阵：分别控制主人艾特、普通艾特、文字召唤、引用、续聊、聊天抽样及冷场检查。
- 选择性续聊：相关接话可延长观察窗口，支持冷却、抽样概率与分条预算，不要求每句都回。
- 独立“开关控制”页面：保留原控制台，上游 HTML 与定制片段分开维护。
- 局域网反向代理的入口校验，以及 DSH bundle 预设同步适配。

管理员身份始终来自可信配置的 `ownerQQ` 和真实发言账号。实际白名单、时段、概率、人格和模型配置由使用者设置。本仓库不包含个人 QQ 号、实际配置、凭据、聊天记录或运行依赖。

## 模块与升级

| 位置 | 内容 |
| --- | --- |
| `custom/policy/` | 峰谷、群聊策略、定时与参数校验 |
| `custom/runtime/` | 群聊运行时、控制接口、网关校验、预设同步 |
| `custom/console/` | 控制台片段与严格锚点组合器 |
| `custom/upgrade/` | 可单独携带的补丁包 |
| `src/` | 上游桥接及必要接入点 |
| `integrations/dsh/` | 相关插件源码副本与第三方许可证 |

[分离情况与剩余接入点](docs/CUSTOMIZATIONS.md) 列出不能彻底独立的部分。上游尚无覆盖事件、等待和发送全链路的通用插件接口，相关接入保留为补丁。

在新版本的独立源码目录上先预检，再应用：

```sh
node custom/upgrade/apply.mjs check --target <新版源码目录>
node custom/upgrade/apply.mjs apply --target <新版源码目录>
```

工具校验文件、试打补丁、检查控制台锚点并备份将被修改的文件。冲突时停止，不修改 Git 历史，不启动 QQ/DSH，不部署防火墙或证书，不覆盖真实配置、人格和聊天状态。上游接口语义变化时仍需要人工适配及回归。

完整步骤见 [升级说明](docs/UPSTREAM_UPGRADE.md)。

## 安装与使用

需要 Node.js **22.13+**、兼容的 DSH 和 OneBot v11 服务。本地定制原基线为 qq-bridge `0.2.1-r1`，已适配的原部署 DSH 为 `0.2.1-rc.3`。

```sh
npm ci
cp config.example.json config.json
```

Windows 可使用 `Copy-Item config.example.json config.json`。随后填写自己的 DSH/OneBot 端点、令牌、管理员和白名单，再按上游说明接入 DSH 预设与插件，最后运行 `npm start`。

示例配置没有管理员和白名单；空白名单默认不放行。不要覆盖已有实际配置，也不要用同一生产配置启动第二个机器人实例。上游 postinstall 会修补本地 SnowLuma SDK 的导入路径；请先阅读脚本及第三方许可。

安装参考：[原版 README](docs/upstream/README.md)、[安全规则](RULES.md)。一些历史迁移或诊断脚本包含原部署路径，不是通用的一键安装工具；不要盲目重复运行。

如需跨网段局域网访问，应在反向代理及防火墙中明确允许所需的内网网段，后端继续绑定回环，使用 HTTPS 与登录保护。源码中的网关校验不能替代主机防火墙。

## 验证

```sh
node scripts/test-custom-regression.mjs
```

18 组本地隔离回归覆盖群聊策略、定时、续聊、控制台、网关及权限边界。使用临时配置和模拟 QQ/DSH，不调用模型或向真实 QQ 发消息。补丁包还在干净基线、兼容的上游改动及 Windows 换行场景下验证。

这些检查证明测试覆盖范围内的行为；不代替你部署后对真实 DSH、OneBot 及网络访问的验证。

## 当前边界

没有新增跨时段待回复队列、群内按成员屏蔽的黑名单或完整长期记忆管理界面。已有轻量会话记忆不等同于永久记忆。独立语音工具不在此仓库内。此源码公开版不是原机器的完整运行快照。

## 来源、发布与许可

本仓库是从本地定制版本生成的**脱敏公开副本**，不继承包含个人标识的原始私有 Git 历史。真实配置、角色卡、状态、完整备份、OAuth/SSH 凭据和 node_modules 均未发布。

- 上游：[Derpyu520/qq-bridge](https://github.com/Derpyu520/qq-bridge)，基线提交 `a49877f4e58d04e47532d44b803360d0f001160d`。
- 原作者：Copyright (c) 2026 Derpyu520 and qq-bridge / QSH contributors。
- 本地定制：Copyright (c) 2026 fander001，沿用 MIT 条款。
- 根目录 [LICENSE](LICENSE) 保留上游原文；另见 [NOTICE](NOTICE) 与 [第三方说明](THIRD_PARTY_NOTICES.md)。
- dsh-setting-restart 保留 [独立 MIT 许可证](integrations/dsh/dsh-setting-restart/LICENSE)。

依赖、外部服务、角色素材及商标仍受各自条款约束，不能将全部依赖概括为 MIT。尤其 SnowLuma 相关包的许可声明需单独核实。这里不分发已安装的依赖或 SnowLuma/NapCat/QQ 本体。

QQ 消息与上下文可能发送给 DSH 和配置的模型服务；启用搜索、网页抓取后，相关请求还会发送给相应服务。请按自己的数据和访问边界配置。
