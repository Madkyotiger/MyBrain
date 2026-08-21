# @MyBrain

**面向中国资深管理者的私人专业 Brain。** 它让 Agent 在新会话里找回有来源的工作上下文，同时把未知、冲突与资料边界说清楚。

@MyBrain 基于 GBrain 引擎，以独立 distribution 承载中国职业语境、中文 onboarding、数据分级、Executive Schema、精选工作能力与多 Agent 接入。它不复制任何人的私人 Brain，也不把 70 个通用 Skill 一次倒给新用户。

## 目前适合谁

首个版本服务在中国工作的资深品牌、市场、广告、咨询与专业服务管理者。第一个真实任务应是一场重要会议或一个正在发生的项目判断，而不是先导入全部人生资料。

## 已落地的中国适配

- 三轮中文 onboarding：用途与运行时、数据边界与来源、首个工作回路与运行细节；逐轮回读，最终另行确认安装。
- 中国 Executive Schema：人物、关系、会议、项目、决定、承诺、Brief、市场信号与纠正。
- 中文与中英混合检索基线：短中文名、英文别名、组织中英文名、正文短语与 source 隔离。
- 五级数据分类：公开、个人私密、经授权工作资料、组织受限、客户或机密；后两类默认阻断。
- 8 个工作入口：有来源检索、会前准备、项目 Brief、决策记录、承诺跟踪、关系上下文、每周判断进化、纠正回路。
- 本地 PGLite、私有 workspace、checksum 备份、隔离恢复与跨进程 correction 回读。

## Agent 接入状态

| Agent | 当前接入 | 证据边界 |
|---|---|---|
| Hermes Agent | 本地 Profile + stdio MCP adapter | 已有自动化安装、配置与 MCP 协议验证；真人 Day 7 仍未完成 |
| WorkBuddy | JSONC `.mcp.json` adapter | 能保留已有配置并写入 bounded stdio MCP；本机未安装客户端，live check 未运行 |
| DeepSeek Harness | `cordis.patch.yml` adapter | 按官方 MCP client 结构生成配置；产品仍是 developer preview，本机 live check 未运行 |
| 豆包工作伙伴 | Streamable HTTP 登记交接 | 只生成远程 MCP 登记包；不部署远程服务，不把本地 PGLite 直接暴露到公网 |

三种国内产品的运行形态不同，所以不做一张假装通用的配置。WorkBuddy 与 DeepSeek Harness 可直接拉起本地 stdio MCP；豆包工作伙伴是云端登记，需要另行解决 HTTPS 托管、认证、权限与数据驻留。

## 开始使用

产品入口、命令、验收状态与停止条件见：

- [@MyBrain 中国版说明](distributions/mybrain-cn/README.md)
- [Agent 接入矩阵](distributions/mybrain-cn/AGENT_HOSTS.md)
- [操作手册](distributions/mybrain-cn/OPERATOR_RUNBOOK.md)
- [验收合同](distributions/mybrain-cn/MVP_ACCEPTANCE.md)

```bash
cd distributions/mybrain-cn
bun src/cli.ts onboard
```

## 项目结构

- **GBrain Core**：数据库、检索、图谱、MCP 与通用协议。
- **@MyBrain Distribution**：本仓库的中国职业认知产品层，位于 `distributions/mybrain-cn/`。
- **User Brain**：每位用户自己拥有的身份、关系、资料、记忆与判断记录，不进入公开分发仓库。

根 README 与 GitHub description 由 @MyBrain 持有；引擎代码、历史与技术文档仍保留上游来源。当前产品差异只允许出现在根 README 与 `distributions/mybrain-cn/`，避免把 fork 养成另一套不可同步的引擎。

## 上游与许可

@MyBrain 使用 [GBrain](https://github.com/garrytan/gbrain) 作为引擎基线，并保留原项目的 MIT License、贡献历史与技术文档。问题与产品反馈请提交到本仓库 Issues；README 不再使用上游作者的个人身份或联系方式作为 @MyBrain 的项目说明。

## 当前状态

这是 **P1.2 candidate**。自动化 proof 能证明安装路径、边界与配置生成没有撒谎；它不能替代真实 Executive 的 Day 1 / Day 7 使用，也不能证明豆包工作伙伴的远程部署、企业权限或境内数据驻留已经完成。
