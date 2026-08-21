# MyBrain CN｜Executive Personal Agent OS Overlay

MyBrain CN 不是另造一个 GBrain，也不是把某个人的私有 Brain 复制给别人。它做的是更难但更有用的一层：把上游引擎收束成中国管理者能安全上手、能跨会话用、出了问题能恢复的个人专业 Brain。

## P1 现在能做什么

- 从一份经过确认的 onboarding answers，建立本地私有 workspace 与 PGLite Brain。
- 安装 `mybrain-cn-executive` Schema Pack 和 8 个工作入口，不向新用户倾倒 70 个 Skill。
- 生成 Hermes MCP adapter；GBrain 仍通过标准 MCP 保持 runtime-neutral。
- 只导入用户明确选择的 `.md`、`.txt`、`.json`；每份材料保留 hash、来源和数据分级。
- 在导入前阻断 `org_restricted` 与 `client_or_secret`。
- 跑通第一条会前准备回路，并在中文组合词过严时做有边界的分词回退。
- 把 correction 写入 Brain，并在新进程中读回。
- 在 PGLite 停止运行时做 checksum backup；隔离恢复后，页面和 correction 仍可检索。

## 快速开始

所有路径都必须显式给出。安装器不会猜测用户的 Home、Hermes profile 或资料目录。

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
```

P1 会真实执行 fresh install、Schema validation、stdio MCP conformance、中文会前检索、阻断测试、跨进程 correction 回读，以及 backup → isolated restore。全部使用合成材料，不读取任何人的真实 Brain。

## 当前边界

**这是单用户、可安装的 P1 candidate，不是多人产品已经成立。** 两条 Hero Loop 的真实重复使用、非产品发起人的独立安装/恢复、以及非创始人 support owner，仍是进入 P2 多用户 pilot 前必须补的证据。

远程 Postgres、企业权限、飞书/微信连接器、SSO、审计和境内数据驻留不在 P1 的已解决范围内。
