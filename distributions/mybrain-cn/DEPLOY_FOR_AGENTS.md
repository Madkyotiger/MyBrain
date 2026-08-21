# @MyBrain Deployment for Codex

## 你在操作什么

当前 checkout 是 **MyBrain 产品源码**，不是任何用户的 Brain。不得在本仓库运行身份 Interview、Render、资料导入或 `gbrain bootstrap repo`。

部署结果必须落到另一处独立 workspace。每位用户拥有自己的 workspace、`agent.json`、本地 PGLite 与私人 Git 仓库；这些内容不得回写产品源码。

## 用户入口

当用户在这个仓库里说“部署 MyBrain”“安装 MyBrain”或“开始测试”时，按本文件执行。不要要求用户先理解 GBrain、distribution overlay 或机器一/机器二。

只在目标路径冲突时提问。默认用户 workspace：

```bash
$HOME/MyBrain-Workspace
```

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

随后回到原生 wire、repo、verify。Codex 使用原生 Codex wiring。

## 4. 上线验证

```bash
gbrain bootstrap verify
bun run "$MYBRAIN_SOURCE/distributions/mybrain-cn/src/cli.ts" verify \
  --workspace "$MYBRAIN_WORKSPACE" \
  --state-root "${GBRAIN_HOME:-$HOME}"
```

两条命令都退出 0 才能称为部署完成。最终向用户报告：

- 用户 workspace 绝对路径
- 私人仓库 URL 或诚实的 local-only 状态
- MyBrain 产品 revision
- 原生 verify 与 MyBrain verify 结果
- Codex MCP 是 user-global：这台电脑上的其他 Codex workspace 也能调用该 Brain

## 5. 已有用户实例接入新 Mac

Clone 用户自己的私人 Brain 仓库并用 Codex 打开。若 `agent.json.initialized=true`：

```bash
gbrain bootstrap attach
gbrain bootstrap verify
bunx --bun -p "github:Madkyotiger/MyBrain#$MYBRAIN_REVISION" mybrain-cn verify \
  --workspace "$PWD" \
  --state-root "${GBRAIN_HOME:-$HOME}"
```

不得重跑 Interview、Render 或 repo，不得生成第二份身份。
