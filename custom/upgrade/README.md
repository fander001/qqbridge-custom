# qqbridge 本地定制补丁包

此目录可以单独复制到其他本地位置。需要 Node.js 22.13+ 和 Git，不需要安装本工具的 npm 依赖。

先准备新版 qq-bridge 的独立源码副本，然后在本目录运行：

```sh
node apply.mjs check --target <新版源码目录>
node apply.mjs apply --target <新版源码目录>
```

检查成功后才会应用。配置、人格卡、聊天状态、凭据和 Git 目录不会被覆盖；不会启动机器人、连接主机或推送远程。文件写入前会备份，冲突时停止。

应用后在新版源码目录运行 `node scripts/test-custom-regression.mjs`。文字补丁无冲突仍不等于新版本语义一定兼容；相关接口变化时，需要按说明手动适配。

- 核心接入补丁：`core.patch`
- 文件与来源清单：`manifest.json`
- 独立模块及材料：`files/`
- 详细升级说明：`files/docs/UPSTREAM_UPGRADE.md`
- 仍需接入的部分：`files/docs/CUSTOMIZATIONS.md`

此目录是生成产物。维护时请修改原项目的 `custom/` 与接入点，再重新生成；不要只改本目录里的副本。原作者及第三方声明见 LICENSE、NOTICE 和随附文档。
