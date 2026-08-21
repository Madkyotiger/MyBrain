# @MyBrain CN｜中国管理者的私人专业 Brain

@MyBrain CN 是 GBrain 的中国职业认知发行版。它保留 GBrain 原生 Bootstrap、存储、检索、协议与升级路径，只增加中国职业语境所需的 Schema、Skills、数据边界和宿主 Adapter。

## 唯一主入口

生产入口是仓库根目录的 GBrain 原生 Bootstrap：

`preflight → engine → interview → render → skills → wire → repo → verify`

发行版说明见 `BOOTSTRAP_FOR_AGENTS.md`。它把中文问法和中国职业边界映射到原生 Interview 键，不创建第二份 answers、第二个确认哈希或第二套身份文件。

原生 Render 完成后运行：

```bash
mybrain-cn activate \
  --workspace "$PWD" \
  --state-root "${GBRAIN_HOME:-$HOME}"
```

激活只安装并启用 `mybrain-cn-executive` Schema Pack、用原生 Skillpack 接口安装 8 个 Skills，并写入 `state/mybrain-cn.json`。数据库初始化、身份、Git repo 与宿主 wiring 仍归原生 Bootstrap。

## 自动 Bootstrap 与后接入宿主

可直接执行 GBrain 原生自动 Bootstrap：

- Claude Code
- Codex
- opencode

原生 Bootstrap 完成后再接入：

```bash
# Hermes
mybrain-cn runtime hermes --config <abs> --workspace <abs> --state-root <abs>

# WorkBuddy
mybrain-cn runtime workbuddy --config <abs> --workspace <abs> --state-root <abs>

# DeepSeek Harness
mybrain-cn runtime deepseek-harness \
  --patch <abs> --workspace <abs> --state-root <abs>

# Feishu Aily：只生成远程 MCP 登记交接
mybrain-cn runtime feishu-aily \
  --url https://brain.example.com/mcp --output <abs>
```

豆包桌面版目前没有已验证的官方 extension / MCP 接口，发行版不宣称支持。Feishu Aily 的远程登记不能替代豆包桌面端接入。

## 已落地能力

- 中国 Executive Schema：meeting、decision、commitment、brief、signal。
- 8 个 Skills：source-grounded-recall、meeting-prep、project-brief、decision-journal、commitment-tracker、relationship-context、weekly-evolution、correction-loop。
- 中文与中英混合检索基线。
- 五级数据分类与 fail-closed intake。
- 会前准备、跨进程纠正、校验和备份与隔离恢复。
- Hermes、WorkBuddy、DeepSeek Harness 的 bounded stdio MCP Adapter。
- Feishu Aily 的无凭据远程登记包。

## 资料导入

自动个人 workspace intake 只接受用户明确选择的 `.md`、`.txt`、`.json`：

```bash
mybrain-cn intake \
  --file <abs> \
  --workspace <abs> \
  --class personal_private \
  --sync \
  --state-root <abs>
```

未传 `--source-id` 时，命令读取原生 `agent.json.source_id`。`work_authorized` 必须进入独立注册的 GBrain source；`org_restricted` 与 `client_or_secret` 默认阻断。

## 工作回路

```bash
mybrain-cn meeting-prep \
  --query "项目名 关键人 未完成承诺" \
  --state-root <abs>

mybrain-cn correct \
  --fact "需要长期保留的纠正" \
  --provenance "纠正来源" \
  --state-root <abs>
```

## 备份与恢复

备份前停止 GBrain / MCP server。发现 live PGLite lock 时命令会拒绝复制。

```bash
mybrain-cn backup --workspace <abs> --state-root <abs> --output <abs>
mybrain-cn backup-verify --backup <abs>
mybrain-cn restore --backup <abs> --target-workspace <abs> --target-state-root <abs>
```

## 上线门禁

```bash
# 仓库根目录
bun run typecheck
bun run verify

# 发行版目录
bun run release
```

随后在全新 full-history clone 中重跑安装和 `bun run release`。浅克隆缺少上游基线历史，不能作为发布证明。

## 当前边界

这是单用户 release candidate。自动化测试不读取真实私人资料。真人 Day 1 / Day 7、非 Hermes 国内客户端账号回路、远程 MCP 部署、企业权限与境内数据驻留仍需独立验收。
