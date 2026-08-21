# @MyBrain CN Architecture

## 架构判断

@MyBrain CN 不维护自己的安装与身份状态机。GBrain 原生 Bootstrap 是唯一生产主链路；发行版只在原生生命周期的明确扩展点增加中国职业能力。

## 权限边界

### GBrain Core 持有

- preflight、engine、interview、render、skills、wire、repo、verify
- `state/interview.json` 与原生完整回读哈希
- `agent.json` workspace manifest
- 数据库、source、检索、MCP verbs 与 attach
- 升级、恢复与 machine-local install receipt

### @MyBrain CN 持有

- 中文 Interview 问法与职业边界说明
- `mybrain-cn-executive` Schema Pack
- 第三方原生 Skillpack 中的 8 个 Executive Skills
- `state/mybrain-cn.json` 激活回执
- 数据分级与个人 workspace intake 约束
- 会前准备、纠正、备份恢复等薄工作回路
- 原生 Bootstrap 后的宿主 Adapter

## 单一状态路径

身份与安装只允许以下状态：

- `workspace/state/interview.json`：原生答案与确认
- `workspace/agent.json`：原生 workspace 身份
- `${GBRAIN_HOME}/.gbrain/`：原生数据库、配置与 Schema Pack
- `workspace/state/mybrain-cn.json`：发行版激活回执，只引用原生 confirmation hash

禁止重新引入：

- 自建 answers 文件
- 自建 onboarding hash
- `MYBRAIN.md` 身份文件
- `mybrain-cn onboard / plan / init`
- 静态 Hermes Profile 作为另一套身份入口

## 生命周期

1. GBrain 原生 Bootstrap 完成 Interview 完整回读与确认。
2. 原生 Render 生成 `agent.json` 与身份文件。
3. `mybrain-cn activate` 校验原生状态。
4. 发行版使用原生 `schema validate / schema use` 安装 Executive Schema。
5. 发行版使用原生 `skillpack scaffold` 安装 8 个 Skills。
6. 流程返回 GBrain 原生 wire、repo、verify。
7. 需要时再接入 Hermes、WorkBuddy、DeepSeek Harness 或 Feishu Aily。
8. `gbrain bootstrap verify` 与 `mybrain-cn verify` 必须同时退出 0。

## 宿主边界

Claude Code、Codex、opencode 可执行完整原生自动 Bootstrap。

Hermes、WorkBuddy、DeepSeek Harness 目前是 Bootstrap 后 Adapter。它们共享同一个 Brain 和 source，不生成宿主专属身份状态。Feishu Aily 只有远程 MCP 登记交接。豆包桌面版尚无已验证官方 extension / MCP 接口。

## 数据边界

自动个人 workspace intake 允许 `public` 与 `personal_private`。`work_authorized` 需要独立 GBrain source 和明确授权。`org_restricted`、`client_or_secret` 默认阻断。

来源 ID 默认读取 `agent.json.source_id`。资料导入不再依赖发行版自建 workspace config。

## Upstream 策略

Core 保持可跟随上游。中国适配留在 `distributions/mybrain-cn/`，只调用 GBrain 已公开的 Bootstrap、Schema、Skillpack、MCP 与 source 合同。若未来必须偏离原生，需要给出失败证据、替代方案、迁移成本与回退条件。
