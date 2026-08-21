# @MyBrain｜中国管理者的私人专业 Brain

@MyBrain 不是另造一个 GBrain，也不是把某个人的私有 Brain 复制给别人。它做的是更难但更有用的一层：把上游引擎收束成中国管理者能安全上手、能跨会话用、出了问题能恢复的个人专业 Brain。

## P1.1 现在能做什么

- 从一份经过确认的 onboarding answers，建立本地私有 workspace 与 PGLite Brain。
- 安装 `mybrain-cn-executive` Schema Pack 和 8 个工作入口，不向新用户倾倒 70 个 Skill。
- 生成 Hermes MCP adapter；GBrain 仍通过标准 MCP 保持 runtime-neutral。
- 只导入用户明确选择的 `.md`、`.txt`、`.json`；每份材料保留 hash、来源和数据分级。
- 在导入前阻断 `org_restricted` 与 `client_or_secret`。
- 跑通第一条会前准备回路，并在中文组合词过严时做有边界的分词回退。
- 把 correction 写入 Brain，并在新进程中读回。
- 在 PGLite 停止运行时做 checksum backup；隔离恢复后，页面和 correction 仍可检索。
- 用一个交互式命令完成三轮 onboarding；每轮回读并确认，最终完整回读后先保存 answers/生成计划，再用独立的 `INSTALL` 确认初始化。
- 安装公开、无用户数据的 Hermes profile distribution；包内只有安全占位配置、SOUL 与现有 8 个 Skill。

## 快速开始

所有路径都必须显式给出。安装器不会猜测用户的 Home、Hermes profile 或资料目录。

交互式路径（推荐）：

```bash
cd distributions/mybrain-cn
bun src/cli.ts onboard
```

命令分三轮询问“用途/运行时”“数据边界/来源”“首个回路/运行细节”。必答题为空或选择非法会直接停止；每轮和最终回读都必须输入 `确认`。Answers 保存并显示 plan/hash 后，还必须另行输入大写 `INSTALL` 才初始化。非交互环境会拒绝此命令，可继续使用下面原有的显式 `plan` / `init` 流程。

```bash
cd distributions/mybrain-cn

# 1. 先看计划和 confirmation_hash；不会写入
bun src/cli.ts plan \
  --answers /absolute/path/to/answers.json \
  --workspace /absolute/path/to/private-workspace \
  --state-root /absolute/path/to/private-state

# 2. 用户确认后初始化
bun src/cli.ts init \
  --answers /absolute/path/to/answers.json \
  --workspace /absolute/path/to/private-workspace \
  --state-root /absolute/path/to/private-state \
  --confirm-hash <hash-from-plan> \
  --hermes-config /absolute/path/to/hermes/config.yaml
```

初始化不会打开 embedding，也不会索取 API Key。先让本地 keyword/CJK 路径跑起来；需要外部模型时，再按数据边界单独决定。

## 公开 Hermes Profile

`hermes-profile/` 是可直接安装的嵌套分发包，不含用户记忆、会话、凭据或机器路径。安装前在私有环境中设置 `MYBRAIN_GBRAIN_CLI` 与 `MYBRAIN_GBRAIN_HOME`：

```bash
hermes profile install /path/to/distributions/mybrain-cn/hermes-profile --name mybrain-cn -y
```

操作细节、停止条件、导出/删除与恢复见 `OPERATOR_RUNBOOK.md`。真人验收协议与空白证据字段见 `acceptance/HUMAN_ACCEPTANCE.md` 和 `acceptance/p1.1-evidence-template.json`；其中 Day 7 状态仍为 `not-run`。

## 第一份材料

```bash
bun src/cli.ts intake \
  --file /absolute/path/to/selected-note.md \
  --workspace /absolute/path/to/private-workspace \
  --class personal_private \
  --source-id default \
  --sync \
  --state-root /absolute/path/to/private-state

bun src/cli.ts meeting-prep \
  --query "项目名 关键人 未完成承诺" \
  --state-root /absolute/path/to/private-state
```

`work_authorized` 不能混进默认个人 source。P1 自动 intake 会直接拒绝这类材料；必须先建立并注册独立 GBrain source，再走 source-specific workflow。受限组织资料与客户机密默认阻断，不提供便利性绕过。

## 备份与恢复

备份必须在 GBrain/MCP server 停止后执行。发现 live PGLite lock 会直接拒绝，避免复制一个正在写入的数据库。

```bash
bun src/cli.ts backup --workspace <abs> --state-root <abs> --output <abs>
bun src/cli.ts backup-verify --backup <abs>
bun src/cli.ts restore --backup <abs> --target-workspace <abs> --target-state-root <abs>
```

备份包含私有内容，必须按敏感资产保护。导出的配置会递归剔除 API Key、token、password 等字段；但 PGLite 数据库本身可能包含运行时授权记录，因此不能把备份当成“无秘密文件”。恢复后外部模型凭据需要重新接入。

## 验证

```bash
bun run p0
bun run p1
bun run p1.1
```

P1 会真实执行 fresh install、Schema validation、stdio MCP conformance、中文会前检索、阻断测试、跨进程 correction 回读，以及 backup → isolated restore。P1.1 追加交互门控、public-profile privacy/config/8-skill 验证，以及当前 Hermes 的隔离本地目录安装。全部自动化测试使用合成材料，不读取任何人的真实 Brain。

## 当前边界

**这是单用户、可安装的 P1.1 candidate，不是多人产品已经成立。** 没有声称 clean-machine proof，也没有声称真人 Day 7 已通过。两条 Hero Loop 的真实重复使用、非产品发起人的独立安装/恢复、以及非创始人 support owner，仍是进入 P2 多用户 pilot 前必须补的证据。

远程 Postgres、企业权限、飞书/微信连接器、SSO、审计和境内数据驻留不在 P1 的已解决范围内。
