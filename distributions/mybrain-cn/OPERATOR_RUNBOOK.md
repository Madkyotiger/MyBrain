# @MyBrain CN Operator Runbook

## 目的

把一台新机器带到可验证的 @MyBrain CN 单用户状态。此手册服从 GBrain 原生 Bootstrap，不另开实验入口。

MyBrain checkout 是产品源码，用户 workspace 必须使用另一条绝对路径。Codex 直接部署的入口见 `DEPLOY_FOR_AGENTS.md`；不得在产品源码仓库生成身份、数据库或用户资料。

## 1. Preflight

- 使用 full-history clone；浅克隆不能证明上游基线关系。
- 安装仓库要求的 Bun 与依赖。
- Brain workspace、GBrain state root、备份目录使用绝对路径。
- 首次只使用合成资料或用户明确选择的少量 `personal_private` 资料。
- 不导入组织受限或客户机密。

## 2. 执行原生 Bootstrap

让 Claude Code、Codex 或 opencode 完整阅读：

- 仓库根目录 `BOOTSTRAP_FOR_AGENTS.md`
- `distributions/mybrain-cn/BOOTSTRAP_FOR_AGENTS.md`

运行：

```bash
gbrain bootstrap status --json
```

按 CLI 返回的阶段执行，不跳过原生 Interview 完整回读与 confirmation hash。中文职业边界写入同一份 `state/interview.json`。

## 3. 原生 Render 后激活发行版

```bash
mybrain-cn activate \
  --workspace <absolute-workspace> \
  --state-root <absolute-gbrain-state-root>
```

检查输出：

- `native_confirmation_hash` 与原生 Interview 一致
- Schema 为 `mybrain-cn-executive`
- Skills 恰好 8 个
- `state/mybrain-cn.json` 已生成
- 没有 `MYBRAIN.md`、自建 answers 或静态 Profile

## 4. 返回原生 repo 与 verify

继续执行 GBrain 原生 wire、repo、verify 阶段。最终运行：

```bash
gbrain bootstrap verify
mybrain-cn verify \
  --workspace <absolute-workspace> \
  --state-root <absolute-gbrain-state-root>
```

两条命令都退出 0 才能进入真实资料测试。

## 5. 接入用户选择的宿主

- Claude Code、Codex、opencode：使用原生 wiring。
- Hermes：`mybrain-cn runtime hermes ...`
- WorkBuddy：`mybrain-cn runtime workbuddy ...`
- DeepSeek Harness：`mybrain-cn runtime deepseek-harness ...`
- Feishu Aily：只生成远程登记交接。
- 豆包桌面版：当前不接入。

Adapter 只在原生 verify 与 MyBrain verify 都成功后执行；CLI 会拒绝较早接入。它不能创建用户身份，也不能触发另一套 Onboarding。

## 6. 资料与第一条回路

选择 3–5 份低风险资料：

```bash
mybrain-cn intake \
  --file <absolute-file> \
  --workspace <absolute-workspace> \
  --class personal_private \
  --sync \
  --state-root <absolute-gbrain-state-root>
```

然后运行真实会前准备：

```bash
mybrain-cn meeting-prep \
  --query "会议对象 项目 关键决定 未完成承诺" \
  --state-root <absolute-gbrain-state-root>
```

记录四件事：找回了什么、缺什么、哪条来源支撑结论、输出改变了哪个下一步。

## 7. 纠正回路

```bash
mybrain-cn correct \
  --fact "用户明确纠正的事实" \
  --provenance "纠正发生的会话或材料" \
  --state-root <absolute-gbrain-state-root>
```

关闭当前会话，在新会话重问同一事实。只有纠正能被正确读回，才算跨会话成立。

## 8. 备份恢复

停止 GBrain / MCP server 后执行：

```bash
mybrain-cn backup --workspace <abs> --state-root <abs> --output <abs>
mybrain-cn backup-verify --backup <abs>
mybrain-cn restore --backup <abs> --target-workspace <abs> --target-state-root <abs>
```

在隔离恢复目录重新检索页面与纠正。不得在原目录上做恢复演练。

## 9. 停止条件

出现以下任一情况，停止并修复：

- 原生 Interview 未确认
- `agent.json` 未初始化
- Schema 或 Skillpack 漂移
- source 与 `agent.json.source_id` 不一致
- 受限资料进入默认个人 source
- Adapter 覆盖已有配置
- 两条 verify 任一失败
- 备份校验失败

## 10. 上线证据

自动化发布门禁：仓库根 `bun run typecheck && bun run verify`，发行版目录 `bun run release`，再在全新 full-history clone 重跑。

真人门禁：Day 1 会前准备、跨会话纠正、Day 7 重复使用、非开发者独立安装或恢复、国内宿主现场账号回路。
