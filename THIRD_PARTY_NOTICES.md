# 第三方许可与来源说明

本文件补充来源信息，不替代各项目的许可证，也不代表对第三方商业使用权限的保证。[LICENSE](LICENSE) 保留了上游完整 MIT 文本及其第三方说明。

## qq-bridge 与定制部分

- 上游：[Derpyu520/qq-bridge](https://github.com/Derpyu520/qq-bridge)。
- 上游署名：Copyright (c) 2026 Derpyu520 and qq-bridge / QSH contributors。
- 本地改动及新增文档：Copyright (c) 2026 fander001，沿用 MIT 条款。
- 根目录 LICENSE 未替换、删减；原 README 另存于 `docs/upstream/`。
- `plugins/`、`dsh/` 及 `integrations/dsh/qq-agent-presets`、`integrations/dsh/qq-mode-console` 来自 qq-bridge 及其本地定制，适用同一上游声明。

## 直接依赖

以下版本和声明读取自本次快照内已安装包的 package.json，并非对整个传递依赖树的独立法律审计。安装范围仍以 package-lock.json 为准。

| 包 | 快照中的已安装版本 | 包元数据的许可声明 |
| --- | --- | --- |
| @deepseek-ai/dsh-host-apiproxy | 0.1.1-rc.2 | MIT |
| @deepseek-ai/schemastery | 3.18.1 | MIT |
| @modelcontextprotocol/sdk | 1.30.0 | MIT |
| @snowluma/mcp | 1.14.20 | SEE LICENSE IN LICENSE |
| @snowluma/sdk | 1.14.20 | SEE LICENSE IN LICENSE |
| js-yaml | 4.3.2 | MIT |
| zod | 4.4.3 | MIT |

来源包括 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)、[MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)、[SnowLuma](https://github.com/SnowLuma/SnowLuma)、[js-yaml](https://github.com/nodeca/js-yaml) 和 [Zod](https://github.com/colinhacks/zod)。

上游 LICENSE 对 SnowLuma 的限制和许可材料缺失有专门说明。不能仅因 qq-bridge 自身采用 MIT，就推定 SnowLuma SDK、MCP 包及 SnowLuma 本体也采用 MIT，或已经获得再次分发、商业使用许可。重新分发前应核实当时适用的原始条款。

本地完整归档包含已有的已安装 npm 依赖，仅用于本机私有备份；Git 不纳入 node_modules、依赖二进制及生成的 `_snowluma-catalog.json`。该归档不是对外提供的安装包。上游 postinstall 会修补本地 SDK 导入路径，源脚本已保留。

## dsh-setting-restart

- 来源：[893413974-bit/dsh-setting-restart](https://github.com/893413974-bit/dsh-setting-restart)。
- 版本：1.0.0。
- 位置：`integrations/dsh/dsh-setting-restart/`。
- 许可证：[独立 LICENSE](integrations/dsh/dsh-setting-restart/LICENSE)，保留原始署名。
- 本地包含 DSH 0.2.1-rc.3 兼容适配；`local-compat.patch` 随源码保留。

## 外部程序、媒体与服务

- 当前部署复用现有 NapCat OneBot 端点；本仓库不打包 NapCat、QQ 客户端、其登录凭据或 AstrBot 本体。
- 本仓库不打包 DSH 全部程序、模型账户授权或系统完整镜像。
- 上游图片、演示素材和名称不因本地修改而转移所有权；没有独立许可声明的第三方媒体不得擅自认定为可任意再分发。
- 用户人格卡、消息记录及个人媒体保留在本地忽略目录中，不随源码许可授权。
- QQ、模型服务、搜索服务的使用还须遵守各自服务协议。源代码许可证不授予商标、账户、模型服务或角色作品的额外权利。
