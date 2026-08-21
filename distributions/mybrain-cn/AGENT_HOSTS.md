# Agent 接入矩阵

更新日期：2026-08-21。

本文件只声明已经做出的配置变化和证据边界。能生成配置，不等于目标客户端已经在真实用户电脑上跑通。

## Hermes Agent

**形态：本地 Profile + stdio MCP。**

- `hermes-profile/` 提供无用户数据的公开 Profile。
- `src/hermes-adapter.ts` 只改 `mcp_servers.mybrain`，保留其他配置，写入前备份。
- MCP 启动面固定为 `serve --surface verbs --source-guard`。
- 已验证：隔离 Profile 安装、8 Skills 一致性、stdio 七动词协议。
- 未验证：全新非 Builder 电脑、真人 Day 7。

参考：<https://hermes-agent.nousresearch.com/docs/>

## WorkBuddy

**形态：本地 JSONC MCP 配置。**

`src/workbuddy-adapter.ts` 写入用户或项目 `.mcp.json` 的 `mcpServers.mybrain`：

- transport：`stdio`
- command：`bun`
- args：bounded GBrain verbs server
- env：用户明确给出的 state root 与 source ID

Adapter 使用 JSONC 文本编辑，保留注释与无关 server；目标 entry 已存在时默认拒绝，只有显式 `--force` 才替换该 entry。写入前保留备份。

```bash
bun src/cli.ts runtime workbuddy \
  --config /absolute/path/to/.mcp.json \
  --state-root /absolute/path/to/private-state
```

已验证：配置合并、注释保留、冲突拒绝、备份、bounded command。

未验证：当前机器没有 WorkBuddy / CodeBuddy CLI，因此未声称 live client round-trip。

官方依据：

- <https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Connector>
- <https://www.workbuddy.ai/docs/zh/cli/mcp>
- <https://www.workbuddy.ai/docs/zh/cli/plugins-reference>

## DeepSeek Harness

**形态：本地 Cordis patch + 官方 MCP client plugin。**

`src/deepseek-harness-adapter.ts` 向明确给出的 `cordis.patch.yml` 添加 `mybrain-mcp` operation：

- plugin：`@deepseek-ai/dsh-mcp-client`
- transport：`stdio`
- command：`bun`
- failOnStartupError：`true`
- toolCallTimeoutMs：`120000`

Adapter 保留无关 operation；同 ID 已存在时默认拒绝；写入前保留备份。

```bash
bun src/cli.ts runtime deepseek-harness \
  --patch /absolute/path/to/cordis.patch.yml \
  --workspace /absolute/path/to/private-workspace \
  --state-root /absolute/path/to/private-state
```

已验证：patch 合并、冲突拒绝、备份与 bounded stdio command。

未验证：本机没有 DSH；DeepSeek Harness 官方仍标为 developer preview，兼容性可能变化。

官方依据：

- <https://github.com/deepseek-ai/deepseek-harness>
- <https://deepseek-harness.github.io/deepseek-harness/reference/config-catalog>
- <https://github.com/deepseek-ai/deepseek-harness/tree/master/examples/mcp-memory>

## 豆包工作伙伴

**形态：云端 Streamable HTTP MCP 登记交接。**

豆包工作伙伴不是另一份本地 stdio 配置。`src/doubao-work-handoff.ts` 只为已经存在的 HTTPS MCP endpoint 生成登记包：

```bash
bun src/cli.ts runtime doubao-work \
  --url https://brain.example.com/mcp \
  --output /absolute/path/to/doubao-work-registration.json
```

安全默认：

- 拒绝 HTTP、localhost、私网地址和 URL 内嵌凭据。
- 只记录 header 名和 secret placeholder，不接收或写出 token。
- 默认 visibility 为 self-only。
- 明确标记“不部署远程服务、不暴露本地 PGLite”。

已验证：登记包结构与安全拒绝规则。

未验证：远程 MCP 托管、OAuth/密钥轮换、企业权限、真人账号登记与中国境内数据驻留。没有这些 proof 前，状态只能是 `registration-handoff-only`。

官方依据：

- <https://aily.feishu.cn/hc/1u7kleqg/4q7o7as7>
- <https://aily.feishu.cn/hc/1u7kleqg/fiogabrc>

## 选择规则

- 想先证明个人 Agent 跨会话使用：Hermes。
- 已经在国内桌面办公 Agent 中工作：WorkBuddy。
- 想验证开发者可组合 Harness：DeepSeek Harness，但接受 preview 风险。
- 想进入飞书云端工作入口：豆包工作伙伴，但先完成远程托管、认证、权限与驻留评估。

接入顺序不能替代产品验收。任何 host 都必须重新跑一次“记住一条纠正 → 新会话读回 → 备份恢复后再读回”。
