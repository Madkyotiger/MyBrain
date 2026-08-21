# @MyBrain CN Release Acceptance

## 发布判断

当前状态：**release candidate**。工程门禁证明主入口、边界和恢复机制一致；它不替代真人使用证明。

## 自动化门禁

| ID | 要求 | 当前状态 |
|---|---|---|
| RC-01 | GBrain 原生 Bootstrap 是唯一身份与安装主链路 | PASS |
| RC-02 | 原生 Interview 状态与 confirmation hash 被发行版复用 | PASS |
| RC-03 | 原生 Render 后才能激活 Executive Schema 与 8 Skills | PASS |
| RC-04 | 旧 `onboard / plan / init`、自建 answers 与静态 Hermes Profile 不存在 | PASS |
| RC-05 | 资料导入服从 `agent.json.source_id`，高风险数据 fail-closed | PASS |
| RC-06 | stdio MCP 七动词合同、会前准备与跨进程纠正 | PASS |
| RC-07 | 备份校验与隔离恢复 | PASS |
| RC-08 | WorkBuddy、DeepSeek Harness、Feishu Aily Adapter 边界 | PASS |
| RC-09 | Core 未被中国发行版逻辑污染，发行版差异留在 overlay | PASS |
| RC-10 | typecheck、root verify、发行版 release gate 与 full-history fresh clone | PASS |

## 宿主声明

- Claude Code、Codex、opencode：GBrain 原生自动 Bootstrap。
- Hermes、WorkBuddy、DeepSeek Harness：Bootstrap 后接入，不声称能单独触发自动 Onboarding。
- Feishu Aily：只生成远程 MCP 登记交接。
- 豆包桌面版 / 豆包工作：尚无已验证官方接入接口，不宣称支持。

## 真人验收

| ID | 场景 | PASS 标准 | 状态 |
|---|---|---|---|
| HA-01 | Day 1 会前准备 | 来源准确，未知清楚，改变一个真实下一步 | NOT RUN |
| HA-02 | 跨会话纠正 | 新会话正确读回用户纠正，不复述旧错误 | NOT RUN |
| HA-03 | Day 7 重复使用 | 同一工作回路再次被主动使用并仍有价值 | NOT RUN |
| HA-04 | 非开发者安装或恢复 | 非产品发起人可按 Runbook 完成，未依赖临时口头知识 | NOT RUN |
| HA-05 | 国内宿主现场回路 | 在真实客户端和账号中完成连接、调用、断线恢复 | NOT RUN |

## 进入多人 Pilot 前

- 两条 Hero Loop 有真人重复使用证据。
- 非发起人能独立安装和恢复。
- 有非发起人的 support owner。
- 工作资料 source、企业权限、审计与数据驻留方案另行验收。

任何自动化 PASS 都不能替代以上真人门禁。
