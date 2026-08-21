# @MyBrain CN Agent Host Support

## 判断规则

MyBrain 只认一条身份与安装主链：GBrain 原生 Bootstrap。宿主支持分两件事判断：

1. **部署能力**：该 Agent 能否读取项目指令、运行命令、写独立用户 workspace，并在 Interview 中等待本人确认。
2. **接线能力**：GBrain 是否原生支持该宿主；若不原生支持，MyBrain Adapter 能否在原生 verify 后安全接入。

“Agent 能执行 Shell”不自动等于“目标机端到端已验证”。发布口径由下面的证据状态决定。

| 宿主 | 驱动原生 Bootstrap | 接线 | 当前自动化等级 | 发布口径 |
|---|---|---|---|---|
| Claude Code | 是 | GBrain 原生 wire | 自动；上游原生合同 | 支持 |
| Codex | 是 | GBrain 原生 wire | 自动；clean-room 已验证 | 支持 |
| opencode | 是 | GBrain 原生 wire | 自动；上游原生合同 | 支持 |
| Hermes Agent | 条件式 | MyBrain YAML stdio Adapter | Profile 工具 cwd 指向产品 checkout 后自动；固定 cwd 的手动修正步骤已登记 | 条件式支持，目标机验收 |
| WorkBuddy / CodeBuddy Code | 是 | MyBrain JSONC stdio Adapter | 自动；配置保真已验证；真客户端尚未在本机测试 | 支持候选，目标机验收 |
| DeepSeek Harness | 条件式 | MyBrain Cordis patch Adapter | 引导式；sandbox 前置需人工确认；产品仍属 developer preview | 引导部署 |
| Feishu Aily | 否 | Streamable HTTP 登记交接 | 手动；不含远程 MCP 部署、认证和租户配置 | 登记交接 |
| 豆包桌面版 / 豆包工作 | 否 | 无 | 未找到已验证官方 extension / MCP 接口 | 不支持 |

完整命令与停止条件见 [`DEPLOY_FOR_AGENTS.md`](./DEPLOY_FOR_AGENTS.md)。机器里恰好存在某个 CLI，不等于当前会话就在那个宿主中。

## 统一部署合同

可自动驱动的 Agent 都执行同一顺序：

1. 在 MyBrain 产品 checkout 读取根 `AGENTS.md`。
2. 创建独立的用户 workspace；不得在产品源码里初始化私人 Brain。
3. 以 `gbrain bootstrap status --json` 作为唯一 resume 状态。
4. 执行原生 `preflight → engine → interview → render`。
5. Render 后运行 `mybrain-cn activate`，再回到原生 `skills → wire → repo → verify`。
6. 原生 verify 成功后才运行宿主 Adapter。
7. 原生 verify、MyBrain verify、宿主 live check 都成功后才报告部署完成。

中文问法只能写入原生 `state/interview.json`；不得另建身份状态、确认 hash、数据库或 repo。

## Hermes Agent

启动入口：

```bash
cd <MyBrain product checkout>
hermes
```

先运行 `hermes config get terminal.cwd`。若 Profile 返回另一个固定绝对路径，手动执行：

```bash
hermes config set terminal.cwd <MyBrain product checkout>
```

关闭旧会话，从产品 checkout 开新会话，并让 terminal 工具执行 `pwd`。只有真实 cwd 等于产品 checkout，才能认定 `AGENTS.md` 自动入口已加载。这一限制已在本机探针中复现；仅传 `hermes --in` 不能覆盖所有固定 Profile 配置。

随后在会话里说“部署 MyBrain”。Hermes 可以自动完成 Bootstrap 与 Adapter。接线使用活动配置，而不是猜路径：

```bash
HERMES_CONFIG="$(hermes config path)"
mybrain-cn runtime hermes \
  --config "$HERMES_CONFIG" \
  --workspace <absolute-workspace> \
  --state-root <absolute-gbrain-state-root>
hermes mcp test mybrain
```

Adapter 只增加一个 source-guarded、verbs-only 的 stdio MCP server；保留无关配置；已有同名 server 时拒绝静默替换。它不创建第二份身份，也不重跑 Interview。

## WorkBuddy / CodeBuddy Code

启动入口：

```bash
cd <MyBrain product checkout>
codebuddy
```

在会话里说“部署 MyBrain”。没有 `CODEBUDDY.md` 时，CodeBuddy Code 读取根 `AGENTS.md`。接线：

```bash
mybrain-cn runtime workbuddy \
  --config "${WORKBUDDY_MCP_CONFIG:-$HOME/.codebuddy/.mcp.json}" \
  --workspace <absolute-workspace> \
  --state-root <absolute-gbrain-state-root>
codebuddy mcp get mybrain
```

Adapter 保留 JSONC 注释与其他 server，遇到同名配置默认拒绝。若目标版本没有 `mcp get`，使用 `codebuddy mcp list` 并重载客户端。真客户端工具发现仍需在目标 Mac 验收。

## DeepSeek Harness

DeepSeek Harness 能读取项目指令和执行命令，但默认 workspace sandbox 可能禁止同时写产品目录之外的用户 workspace 与状态目录。因此当前不标“全自动”。

手动前置：

1. 把产品 checkout 与空用户 workspace 放在同一个部署父目录下。
2. 从该父目录运行 `dsh web`。
3. 指示 DSH 读取产品目录内的 `AGENTS.md`，目标写入用户 workspace。
4. 对 sandbox 之外的状态路径由本人显式批准；不得改在产品源码内初始化。

原生 verify 后：

```bash
mybrain-cn runtime deepseek-harness \
  --patch <absolute-cordis-patch-yaml> \
  --workspace <absolute-workspace> \
  --state-root <absolute-gbrain-state-root>
dsh --profile web --dump-config
```

Adapter 写入官方 `@deepseek-ai/dsh-mcp-client` stdio 结构，保留无关 patch operation。需要重启 profile 并完成一次真实工具调用；配置文件生成不能代替 live round-trip。

## Feishu Aily

```bash
mybrain-cn runtime feishu-aily \
  --url https://brain.example.com/mcp \
  --output <absolute-registration-json>
```

该命令只生成登记包，不部署远程 server，不保存凭据，也不把本地 PGLite 暴露到公网。认证、租户权限、审计与数据驻留属于独立上线门禁。

## 豆包桌面版

当前不提供 Adapter。下载页证明桌面产品存在，不能证明它公开了可安装 extension、stdio MCP 或 Streamable HTTP MCP 接口。发现官方接口后，要先完成最小连接、权限边界和断线恢复验证，再进入支持矩阵。

## Source 规则

宿主默认 source 必须与原生 `agent.json.source_id` 一致。显式指定其他 source 前，先在 GBrain 注册并验证权限；不得用 Adapter 绕过 source 隔离。
