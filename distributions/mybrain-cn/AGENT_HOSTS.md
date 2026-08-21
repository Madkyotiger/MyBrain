# @MyBrain CN Agent Host Support

## 判断规则

“能接入 Brain”不等于“能自动 Onboarding”。完整自动 Onboarding 需要宿主能执行 GBrain 原生 Bootstrap 的全部阶段，并能读写本地文件、运行命令、等待用户确认。

| 宿主 | 原生自动 Bootstrap | Bootstrap 后接入 | 当前证据 | 发布口径 |
|---|---|---|---|---|
| Claude Code | 是 | 原生 wiring | GBrain 原生支持 | 支持 |
| Codex | 是 | 原生 wiring | GBrain 原生支持 | 支持 |
| opencode | 是 | 原生 wiring | GBrain 原生支持 | 支持 |
| Hermes Agent | 否 | YAML stdio MCP Adapter | 配置保真与 verbs 协议自动化已验证；真人聊天回路待验 | 接入候选 |
| WorkBuddy | 否 | JSONC stdio MCP Adapter | 注释与其他 server 保真、拒绝静默覆盖；客户端现场测试待验 | 接入候选 |
| DeepSeek Harness | 否 | Cordis patch stdio MCP Adapter | patch 合并与 bounded verbs 自动化已验证；产品仍属 developer preview | 接入候选 |
| Feishu Aily | 否 | Streamable HTTP 登记交接 | HTTPS、无内嵌凭据、私网拒绝均已验证；不含远程部署 | 登记交接 |
| 豆包桌面版 / 豆包工作 | 否 | 无 | 未找到已验证官方 extension / MCP 接口 | 不支持 |

## 自动 Bootstrap 宿主

Claude Code、Codex、opencode 读取仓库根目录 `BOOTSTRAP_FOR_AGENTS.md`，执行 GBrain 原生生命周期。@MyBrain 的中文问法与职业边界写入同一个原生 Interview 状态。原生 Render 后运行 `mybrain-cn activate`，然后回到原生 repo 与 verify。

## Hermes Agent

```bash
mybrain-cn runtime hermes \
  --config <absolute-config-yaml> \
  --workspace <absolute-workspace> \
  --state-root <absolute-gbrain-state-root>
```

Adapter 只增加一个 source-guarded、verbs-only 的 stdio MCP server；保留无关配置；已有同名 server 时拒绝静默替换。它不安装 Hermes，不创建 Profile，不重跑 Interview。

## WorkBuddy

```bash
mybrain-cn runtime workbuddy \
  --config <absolute-mcp-jsonc> \
  --workspace <absolute-workspace> \
  --state-root <absolute-gbrain-state-root>
```

Adapter 保留 JSONC 注释与其他 server。真实客户端账号回路尚未完成，不能把配置生成当作现场可用证明。

## DeepSeek Harness

```bash
mybrain-cn runtime deepseek-harness \
  --patch <absolute-cordis-patch-yaml> \
  --workspace <absolute-workspace> \
  --state-root <absolute-gbrain-state-root>
```

Adapter 写入官方 MCP client 结构并保留无关 patch operation。DeepSeek Harness 仍属 developer preview；版本变化可能要求重验。

## Feishu Aily

```bash
mybrain-cn runtime feishu-aily \
  --url https://brain.example.com/mcp \
  --output <absolute-registration-json>
```

该命令只生成登记包，不部署远程 server，不保存凭据，也不把本地 PGLite 直接暴露到公网。认证、租户权限、审计与数据驻留属于独立上线门禁。

## 豆包桌面版

当前不提供 Adapter。下载页证明桌面产品存在，不能证明它公开了可安装 extension、stdio MCP 或 Streamable HTTP MCP 接口。发现官方接口后，要先完成最小连接、权限边界和断线恢复验证，再进入支持矩阵。

## Source 规则

宿主默认 source 应与原生 `agent.json.source_id` 一致。显式指定其他 source 前，必须先在 GBrain 注册并验证权限；不得用 Adapter 绕过 source 隔离。
