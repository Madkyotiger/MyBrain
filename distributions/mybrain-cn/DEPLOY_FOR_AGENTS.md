# @MyBrain Deployment for Agents

## 你在操作什么

当前 checkout 是 **MyBrain 产品源码**，不是任何用户的 Brain。不得在本仓库运行身份 Interview、Render、资料导入或 `gbrain bootstrap repo`。

部署结果必须落到另一处独立 workspace。每位用户拥有自己的 workspace、`agent.json`、本地 PGLite 与私人 Git 仓库；这些内容不得回写产品源码。

## 用户入口

当用户在这个仓库里说“部署 MyBrain”“安装 MyBrain”或“开始测试”时，当前 Agent 直接按本文件执行。不要要求用户先理解 GBrain、distribution overlay 或宿主接线。

只在目标路径冲突、权限不足或 GBrain 原生 Bootstrap 要求本人确认时停下来提问。默认用户 workspace：

```bash
$HOME/MyBrain-Workspace
```

## 0. 识别当前宿主

当前会话宿主决定末端的接线方式，不改变前面的 Bootstrap：

| 宿主 | 部署方式 | Bootstrap 后接线 |
|---|---|---|
| Claude Code / Codex / opencode | Agent 自动驱动 | GBrain 原生 wire |
| Hermes Agent | 条件式自动；活动 Profile 的工具 cwd 必须指向产品 checkout | MyBrain Hermes Adapter + `hermes mcp test` |
| WorkBuddy / CodeBuddy Code | Agent 自动驱动 | MyBrain WorkBuddy Adapter +客户端配置回读 |
| DeepSeek Harness | 引导式；需先处理 workspace sandbox | MyBrain Cordis patch Adapter + profile 配置回读 |
| Feishu Aily | 手动；需远程 MCP 服务与租户配置 | HTTPS 登记交接 |
| 豆包桌面版 | 不支持 | 等待官方扩展或 MCP 接口 |

机器里装了某个 CLI，不代表当前会话就在该宿主中。不能确定宿主时只问一次。

## 1. 锁定产品源码

在当前 MyBrain 产品仓库：

```bash
git status --porcelain
git pull --ff-only
bun install --frozen-lockfile
```

源码不干净时停止，不得 stash、覆盖或把用户资料写进来。

记录：

```bash
MYBRAIN_SOURCE="$(pwd -P)"
MYBRAIN_REVISION="$(git rev-parse HEAD)"
```

## 2. 准备独立用户 workspace

```bash
MYBRAIN_WORKSPACE="${MYBRAIN_WORKSPACE:-$HOME/MyBrain-Workspace}"
```

- 路径不存在：创建空目录。
- 路径为空：作为第一次部署继续。
- 路径里有 `agent.json` 且 `initialized: true`：这是已有用户实例，走原生 `gbrain bootstrap attach`。
- 其他非空目录：停止并让用户选择新目录；不得清空或覆盖。

进入该目录后再运行所有 Bootstrap 命令：

```bash
cd "$MYBRAIN_WORKSPACE"
```

## 3. 使用 GBrain 原生 Bootstrap

按产品源码中的两个 runbook 执行：

1. `$MYBRAIN_SOURCE/BOOTSTRAP_FOR_AGENTS.md`：唯一原生状态机。
2. `$MYBRAIN_SOURCE/distributions/mybrain-cn/BOOTSTRAP_FOR_AGENTS.md`：中文问题、数据边界和 overlay 激活时点。

安装 GBrain 必须沿用原生命令：

```bash
bun install -g github:garrytan/gbrain#latest-stable
gbrain bootstrap status --json
```

严格跟随 `status` 返回的 `preflight → engine → interview → render → skills → wire → repo → verify`。不要在产品源码目录执行这些阶段。

第一次部署在原生 Render 后，用当前 checkout 激活 MyBrain CN：

```bash
bun run "$MYBRAIN_SOURCE/distributions/mybrain-cn/src/cli.ts" activate \
  --workspace "$MYBRAIN_WORKSPACE" \
  --state-root "${GBRAIN_HOME:-$HOME}"
```

随后回到原生 skills、wire、repo、verify。Claude Code、Codex、opencode 使用 GBrain 原生 wiring。其他宿主不得伪装成原生 wire；完成原生 verify 后再执行第 4 节的 Adapter。

## 4. 宿主接线

所有 Adapter 都要求：原生 `gbrain bootstrap verify` 已有最新成功证据，MyBrain 已激活，workspace 与 `agent.json.source_id` 一致。

### Hermes Agent｜满足 cwd 前置后自动

Hermes 只有在工具工作目录落到产品 checkout 时，才会加载这里的 `AGENTS.md` 并自动驱动第 1–3 节。启动前先检查：

```bash
hermes config get terminal.cwd
```

- 返回 `.` 或当前产品 checkout：从产品目录启动新 Hermes 会话。
- 返回另一个固定绝对路径：`hermes --in` 在部分 Profile 上仍可能被该配置覆盖。手动执行 `hermes config set terminal.cwd "$MYBRAIN_SOURCE"`，关闭旧会话，再开新会话。部署后如需恢复，改回原值。

不要依靠模型口头报告 cwd。让 Hermes 的 terminal 工具执行 `pwd`，必须等于产品 checkout，才算自动入口生效。

接线时用 Hermes 自己报告的活动配置路径：

```bash
HERMES_CONFIG="$(hermes config path)"
bun run "$MYBRAIN_SOURCE/distributions/mybrain-cn/src/cli.ts" runtime hermes \
  --config "$HERMES_CONFIG" \
  --workspace "$MYBRAIN_WORKSPACE" \
  --state-root "${GBRAIN_HOME:-$HOME}"
hermes mcp test mybrain
```

`hermes mcp test mybrain` 失败即部署未完成。不得用 `--yolo` 跳过身份确认或写入审批。

### WorkBuddy / CodeBuddy Code｜自动，目标机需回读

CodeBuddy Code 在没有 `CODEBUDDY.md` 时读取 `AGENTS.md`，可在交互会话驱动第 1–3 节。默认 MCP 配置：

```bash
WORKBUDDY_MCP_CONFIG="${WORKBUDDY_MCP_CONFIG:-$HOME/.codebuddy/.mcp.json}"
bun run "$MYBRAIN_SOURCE/distributions/mybrain-cn/src/cli.ts" runtime workbuddy \
  --config "$WORKBUDDY_MCP_CONFIG" \
  --workspace "$MYBRAIN_WORKSPACE" \
  --state-root "${GBRAIN_HOME:-$HOME}"
codebuddy mcp get mybrain
```

如果目标版本没有 `codebuddy mcp get`，改用 `codebuddy mcp list` 并在客户端重载 MCP。配置回读或真实工具发现失败时，必须报告“Adapter 已写入，客户端未验证”，不能称为部署完成。

### DeepSeek Harness｜引导式，含手动前置

DeepSeek Harness 默认 `workspace-write` sandbox 可能禁止同时写产品仓库之外的用户 workspace 与状态目录。不要静默放宽权限。

手动前置：

1. 建一个仅用于部署的父目录，把产品 checkout 与空用户 workspace 放成两个子目录。
2. 从父目录启动 `dsh web`，让该会话能看到两个子目录。
3. 明确要求 DSH 读取 `<产品目录>/AGENTS.md`，目标写入 `<用户 workspace>`。
4. 如果 sandbox 仍拒绝状态目录，停止，让用户显式批准该路径；不得改在产品源码内初始化。

原生 verify 后接线：

```bash
DSH_PATCH="<当前 DeepSeek Harness profile 的 cordis.patch.yml 绝对路径>"
bun run "$MYBRAIN_SOURCE/distributions/mybrain-cn/src/cli.ts" runtime deepseek-harness \
  --patch "$DSH_PATCH" \
  --workspace "$MYBRAIN_WORKSPACE" \
  --state-root "${GBRAIN_HOME:-$HOME}"
dsh --profile web --dump-config
```

必须在 `--dump-config` 中看到 `mybrain-mcp`，重启 Web profile 后完成一次真实 MCP 工具调用。DeepSeek Harness 仍属 developer preview；未完成目标机 live round-trip 时只可报告“引导部署完成，宿主调用待验”。

### Feishu Aily 与豆包桌面版｜手动或不支持

Feishu Aily 需要一套可审计的 HTTPS MCP 服务、认证、租户权限与数据驻留方案。当前命令只生成无凭据登记包：

```bash
bun run "$MYBRAIN_SOURCE/distributions/mybrain-cn/src/cli.ts" runtime feishu-aily \
  --url https://brain.example.com/mcp \
  --output <absolute-registration-json>
```

豆包桌面版当前没有已验证的第三方 extension、stdio MCP 或 Streamable HTTP MCP 接口，不提供自动部署，也不提供 GUI 自动化绕行。

## 5. 上线验证

```bash
gbrain bootstrap verify
bun run "$MYBRAIN_SOURCE/distributions/mybrain-cn/src/cli.ts" verify \
  --workspace "$MYBRAIN_WORKSPACE" \
  --state-root "${GBRAIN_HOME:-$HOME}"
```

两条命令和对应宿主接线验证都成功，才能称为部署完成。最终向用户报告：

- 用户 workspace 绝对路径
- 私人仓库 URL 或诚实的 local-only 状态
- MyBrain 产品 revision
- 原生 verify 与 MyBrain verify 结果
- 宿主 Adapter 与 live check 结果
- 任何仍需人工配置的准确步骤

## 6. 已有用户实例接入新机器

Clone 用户自己的私人 Brain 仓库并用目标 Agent 打开。若 `agent.json.initialized=true`：

```bash
gbrain bootstrap attach
gbrain bootstrap verify
bunx --bun -p "github:Madkyotiger/MyBrain#$MYBRAIN_REVISION" mybrain-cn verify \
  --workspace "$PWD" \
  --state-root "${GBRAIN_HOME:-$HOME}"
```

随后只运行本机宿主 Adapter。不得重跑 Interview、Render 或 repo，不得生成第二份身份。
