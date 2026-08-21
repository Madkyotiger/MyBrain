# @MyBrain CN｜中国职业认知发行版

@MyBrain CN 位于 `distributions/mybrain-cn/`。它沿用 GBrain 的 Bootstrap、存储、检索、协议与升级路径，只增加中国职业语境所需的 Schema、Skills、数据边界和宿主 Adapter。

当前状态是 **engineering release candidate**。工程门禁已闭合；真人 Day 1 / Day 7 与非 Codex 目标客户端验收仍是下一阶段。

## 1. 生命周期归属

生产安装只认 GBrain 原生 Bootstrap：

`preflight → engine → interview → render → skills → wire → repo → verify`

发行版不拥有以下事项：

- 第二套 Interview 或 answers 文件
- 第二个 confirmation hash
- 第二份身份清单
- 第二次数据库初始化
- 第二个 repo 初始化入口

中文问法写入原生 Interview 键。原生 Render 完成后，发行版激活 `mybrain-cn-executive` Schema Pack 与 8 个 Skills；原生 verify 成功后，非原生宿主才允许运行 MyBrain Adapter。

```bash
mybrain-cn activate \
  --workspace "$MYBRAIN_WORKSPACE" \
  --state-root "${GBRAIN_HOME:-$HOME}"
```

激活回执写入 `state/mybrain-cn.json`。原生 `agent.json` 仍是 User Brain 的唯一身份清单。

## 2. 产品源码与 User Brain

当前仓库是 **MyBrain 产品源码**，不是任何用户的私人 Brain。身份 Interview、Render、资料导入与 `gbrain bootstrap repo` 必须在另一处独立 workspace 运行。

每位用户拥有自己的：

- workspace
- `agent.json`
- 本地 PGLite
- 私人 Git 仓库
- 资料、关系、纠正与判断记录

已有实例换机器时走 `gbrain bootstrap attach`，不重做身份。

## 3. Agent 部署与宿主接线

完整步骤、人工前置与停止条件由 [`DEPLOY_FOR_AGENTS.md`](./DEPLOY_FOR_AGENTS.md) 持有。宿主能力分两层判断：

1. 能否读取项目指令、运行命令并在本人确认处停下；
2. 能否在原生 verify 后安全接入同一个 User Brain。

| 宿主 | 驱动原生 Bootstrap | 接线方式 | 当前状态 |
|---|---|---|---|
| Claude Code / Codex / opencode | 是 | GBrain 原生 wire | 支持 |
| Hermes Agent | 条件式 | YAML stdio Adapter | 需确认真实 cwd 与 `hermes mcp test` |
| WorkBuddy / CodeBuddy Code | 是 | JSONC stdio Adapter | 自动候选，需目标客户端回读 |
| DeepSeek Harness | 条件式 | Cordis patch Adapter | sandbox 人工前置；developer preview |
| Feishu Aily | 否 | HTTPS MCP 登记交接 | 手动登记，不含远程部署与租户配置 |
| 豆包桌面版 / 豆包工作 | 否 | 无 | 不支持，等待官方 extension / MCP 接口 |

机器可读状态见 [`host-support.json`](./host-support.json)。配置文件写入不等于目标客户端已完成 live round-trip。

## 4. 宿主命令

所有 Adapter 都要求最新的 GBrain 原生 verify 成功证据、已激活的 MyBrain CN，以及与 `agent.json.source_id` 一致的 workspace。

### Hermes

```bash
HERMES_CONFIG="$(hermes config path)"
mybrain-cn runtime hermes \
  --config "$HERMES_CONFIG" \
  --workspace "$MYBRAIN_WORKSPACE" \
  --state-root "${GBRAIN_HOME:-$HOME}"
hermes mcp test mybrain
```

若活动 Profile 把 `terminal.cwd` 固定到其他路径，需手动改到产品 checkout、关闭旧会话并重新进入。terminal 工具返回的 `pwd` 必须与产品 checkout 一致。

### WorkBuddy / CodeBuddy Code

```bash
mybrain-cn runtime workbuddy \
  --config "${WORKBUDDY_MCP_CONFIG:-$HOME/.codebuddy/.mcp.json}" \
  --workspace "$MYBRAIN_WORKSPACE" \
  --state-root "${GBRAIN_HOME:-$HOME}"
codebuddy mcp get mybrain
```

目标版本没有 `mcp get` 时，使用 `codebuddy mcp list` 并重载客户端。没有配置回读或真实工具发现，只能报告 Adapter 已写入。

### DeepSeek Harness

```bash
mybrain-cn runtime deepseek-harness \
  --patch <absolute-cordis-patch-yaml> \
  --workspace "$MYBRAIN_WORKSPACE" \
  --state-root "${GBRAIN_HOME:-$HOME}"
dsh --profile web --dump-config
```

产品 checkout 与 User Brain workspace 需位于本人批准的部署父目录中。sandbox 拒绝状态路径时必须停下，不能改在产品源码内初始化。配置回读后还需一次真实 MCP 工具调用。

### Feishu Aily

```bash
mybrain-cn runtime feishu-aily \
  --url https://brain.example.com/mcp \
  --output <absolute-registration-json>
```

该命令只生成无凭据登记包。远程 server、认证、租户权限、审计与数据驻留由独立上线门禁处理。

## 5. 已落地能力

- Executive Schema：meeting、decision、commitment、brief、signal。
- 8 个 Skills：source-grounded-recall、meeting-prep、project-brief、decision-journal、commitment-tracker、relationship-context、weekly-evolution、correction-loop。
- 中文与中英混合检索基线。
- 五级数据分类与 fail-closed intake。
- 会前准备、跨进程纠正、校验和备份与隔离恢复。
- Hermes、WorkBuddy、DeepSeek Harness 的 bounded stdio MCP Adapter。
- Feishu Aily 无凭据远程登记包。

## 6. 资料与工作回路

自动个人 workspace intake 只接受用户明确选择的 `.md`、`.txt`、`.json`：

```bash
mybrain-cn intake \
  --file <abs> \
  --workspace <abs> \
  --class personal_private \
  --sync \
  --state-root <abs>
```

未传 `--source-id` 时读取原生 `agent.json.source_id`。`work_authorized` 必须进入独立注册的 GBrain source；`org_restricted` 与 `client_or_secret` 默认阻断。

```bash
mybrain-cn meeting-prep \
  --query "项目名 关键人 未完成承诺" \
  --state-root <abs>

mybrain-cn correct \
  --fact "需要长期保留的纠正" \
  --provenance "纠正来源" \
  --state-root <abs>
```

## 7. 备份与恢复

备份前停止 GBrain / MCP server。发现 live PGLite lock 时命令会拒绝复制。

```bash
mybrain-cn backup --workspace <abs> --state-root <abs> --output <abs>
mybrain-cn backup-verify --backup <abs>
mybrain-cn restore --backup <abs> --target-workspace <abs> --target-state-root <abs>
```

## 8. 发布门禁

```bash
# 仓库根目录
bun run typecheck
bun run verify

# 发行版目录
bun run release
```

发布前还要在 full-history clean clone 中重跑安装与 `bun run release`。浅克隆缺少上游基线历史，不能充当发布证明。

当前自动化证据：P0 9/9、native E2E 7/7、host adapters 5/5、GBrain verify 54/54。真人验收清单见 [`MVP_ACCEPTANCE.md`](./MVP_ACCEPTANCE.md) 与 `acceptance/HUMAN_ACCEPTANCE.md`。

## 9. 当前边界

工程 RC 不等于用户价值或商业成立。当前不再增加 Connector；下一步是干净 MacBook + Codex 的真实首装、Day 1 工作回路、纠正与恢复、Day 7 重复使用，以及同一 User Brain 的一个非 Codex 目标客户端回路。
