# @MyBrain

**面向中国资深管理者的私人专业 Brain。** 它让 Agent 在新会话中找回有来源的工作上下文，并把未知、冲突与资料边界说清楚。

@MyBrain 以 GBrain 为引擎基线，增加中国职业语境、中文访谈问法、数据分级、Executive Schema、精选工作能力与多宿主接入。它不复制任何人的私人 Brain，也不维护一套平行于 GBrain 的身份系统。

## 生产架构

唯一安装与身份主链路是 GBrain 原生 Bootstrap：

`preflight → engine → interview → render → skills → wire → repo → verify`

@MyBrain 在原生 Interview 完整回读并确认、原生 Render 完成后，激活两类发行版资产：

- `mybrain-cn-executive` Schema Pack
- 8 个 Executive Skills

身份答案只保存在原生 `state/interview.json`；原生确认哈希是唯一确认凭证；`agent.json` 是唯一 workspace 身份清单。@MyBrain 不再提供自己的 `onboard / plan / init`，也不发布平行 Agent Profile。

## 中国职业适配

- 中文与中英混合检索：中文短名、英文别名、组织中英文名、正文短语与来源隔离。
- 五级数据边界：公开、个人私密、经授权工作资料、组织受限、客户或机密。
- Executive Schema：会议、决定、承诺、Brief 与信号。
- 8 个工作入口：有来源检索、会前准备、项目 Brief、决策记录、承诺跟踪、关系上下文、每周判断进化、纠正回路。
- 本地 PGLite、私有 Git workspace、校验和备份、隔离恢复与跨进程纠正读回。

## Agent 接入

| 宿主 | 部署 | 接线与验收 |
|---|---|---|
| Claude Code / Codex / opencode | Agent 自动驱动 GBrain 原生 Bootstrap | GBrain 原生 wire |
| Hermes Agent | 条件式自动；工具 cwd 须指向产品 checkout | MyBrain Adapter；目标机运行 `hermes mcp test mybrain` |
| WorkBuddy / CodeBuddy Code | Agent 自动驱动同一 Bootstrap | MyBrain Adapter；目标客户端必须回读 MCP |
| DeepSeek Harness | 引导式；先显式处理 workspace sandbox | Cordis patch；developer preview，需目标机 live round-trip |
| Feishu Aily | 手动 | 只生成无凭据登记包，不含远程部署、认证与租户配置 |
| 豆包桌面版 / 豆包工作 | 不支持 | 尚无已验证官方 extension / MCP 接口 |

不同宿主共享同一个 Brain 与同一份原生 Bootstrap 状态，不各自再做一次 Onboarding。

## 开始使用

最短入口：Clone 本仓库，用 Codex、Hermes 或 WorkBuddy / CodeBuddy Code 打开，然后说
“部署 MyBrain”。Agent 会读取
[`DEPLOY_FOR_AGENTS.md`](distributions/mybrain-cn/DEPLOY_FOR_AGENTS.md)，在独立目录创建用户实例；
不会把身份、资料或数据库写进产品源码。DeepSeek Harness 需先按该文档处理 sandbox 前置。

1. 产品源码与用户实例分开：本仓库只提供程序和发行版资产。
2. 用户实例走 GBrain 原生 Bootstrap，并生成自己拥有的私人 Git 仓库。
3. 原生 Render 后激活 MyBrain CN；原生 verify 成功后才允许接入其他宿主。
4. 已有用户实例换电脑时，Clone 用户自己的仓库并运行原生 `gbrain bootstrap attach`，不重做 Onboarding。

详细说明：

- [中国版说明](distributions/mybrain-cn/README.md)
- [Agent 部署入口](distributions/mybrain-cn/DEPLOY_FOR_AGENTS.md)
- [宿主支持矩阵](distributions/mybrain-cn/AGENT_HOSTS.md)
- [Operator Runbook](distributions/mybrain-cn/OPERATOR_RUNBOOK.md)
- [验收合同](distributions/mybrain-cn/MVP_ACCEPTANCE.md)

## 项目边界

- **GBrain Core**：数据库、检索、图谱、MCP、原生 Bootstrap 与通用协议。
- **@MyBrain CN Distribution**：中国职业认知产品层，位于 `distributions/mybrain-cn/`。
- **User Brain**：每位用户自己拥有的身份、关系、资料、记忆与判断记录，不进入公开发行仓库。

## 上游与许可证

@MyBrain 使用 [GBrain](https://github.com/garrytan/gbrain) 作为引擎基线，保留原项目的 MIT License、贡献历史与技术文档。@MyBrain 的产品问题请提交到本仓库 Issues。

## 当前状态

这是 **release candidate**。自动化证据覆盖原生 Bootstrap、发行版激活、Schema、Skillpack、MCP 协议、资料阻断、会前准备、纠正与恢复。真实 Executive 的 Day 1 / Day 7 使用，以及 Hermes、WorkBuddy、DeepSeek Harness 的目标机 live round-trip，仍需真人验收。
