# @MyBrain

**面向中国资深管理者的私人专业 Brain。** 它让 Agent 在新会话中找回有来源的工作上下文，记住明确纠正，并把未知、冲突与资料边界说清楚。

> 当前状态：**engineering release candidate**。安装、身份、发行版激活、宿主 Adapter 与恢复机制已有自动化证据；真人 Day 1 / Day 7 价值验收尚未开始。

## 产品模型

MyBrain 是可拉取、可升级的产品源码与中国职业认知发行版。它不是任何用户的私人资料库。部署后，每位用户会得到自己拥有的独立 **User Brain**：独立 workspace、`agent.json`、本地 PGLite 与私人 Git 仓库。

唯一安装与身份主链路是 GBrain 原生 Bootstrap：

`preflight → engine → interview → render → skills → wire → repo → verify`

MyBrain 只在原生扩展点增加：

- `mybrain-cn-executive` Schema Pack
- 8 个 Executive Skills
- 中文与中英混合检索
- 五级数据边界与 fail-closed intake
- 多宿主 Adapter、备份、校验与隔离恢复

身份答案只保存在原生 `state/interview.json`；原生确认哈希是唯一确认凭证；`agent.json` 是唯一 workspace 身份清单。MyBrain 不维护平行的 Onboarding、数据库、身份文件或 repo 初始化流程。

## Agent 部署支持

| 宿主 | 部署方式 | 接线 | 当前口径 |
|---|---|---|---|
| Claude Code / Codex / opencode | Agent 驱动 GBrain 原生 Bootstrap | GBrain 原生 wire | 支持 |
| Hermes Agent | 条件式自动；固定 `terminal.cwd` 时需手动修正一次 | MyBrain YAML stdio Adapter | 目标机验收 |
| WorkBuddy / CodeBuddy Code | Agent 自动驱动 | MyBrain JSONC stdio Adapter | 支持候选，需客户端回读 |
| DeepSeek Harness | 引导部署；sandbox 需本人确认 | MyBrain Cordis patch Adapter | developer preview |
| Feishu Aily | 手动 | HTTPS MCP 登记交接 | 只生成登记包 |
| 豆包桌面版 / 豆包工作 | 不支持 | 无已验证官方接口 | 等待官方 extension / MCP 能力 |

不同宿主共享同一个 Brain 与同一份原生 Bootstrap 状态，不各自重做 Onboarding。完整自动步骤、手动前置与停止条件见 [`distributions/mybrain-cn/DEPLOY_FOR_AGENTS.md`](distributions/mybrain-cn/DEPLOY_FOR_AGENTS.md)。

## 首次部署

当前推荐验收路径是一台装有 Codex 的干净 MacBook：

```bash
git clone https://github.com/Madkyotiger/MyBrain.git
cd MyBrain
```

用 Codex 打开产品 checkout，然后说：

> 部署 MyBrain

Codex 会读取仓库内 `AGENTS.md` 与部署合同，在默认的 `$HOME/MyBrain-Workspace` 或用户指定的独立目录运行 GBrain 原生 Bootstrap。它不得把身份访谈、资料或数据库写进产品源码。

其他宿主的最短入口：

- **Hermes**：先确认活动 Profile 的工具 cwd 真正指向产品 checkout；固定到其他路径时，按部署文档修正并重启会话。
- **WorkBuddy / CodeBuddy Code**：在产品 checkout 启动 Agent 并说“部署 MyBrain”；结束前必须回读 MCP 配置。
- **DeepSeek Harness**：把产品 checkout 与空 User Brain workspace 放进本人批准的同一部署父目录，再按文档完成 sandbox 前置。
- **Feishu Aily**：先具备可审计的远程 HTTPS MCP、认证、租户权限与数据驻留方案；当前仓库只生成登记交接。

已有 User Brain 换机器时，Clone 用户自己的私人仓库并运行原生 `gbrain bootstrap attach`。不要重做 Interview、Render 或 repo。

## 中国职业适配

- **Executive Schema**：meeting、decision、commitment、brief、signal。
- **8 个工作入口**：有来源检索、会前准备、项目 Brief、决策记录、承诺跟踪、关系上下文、每周判断进化、纠正回路。
- **资料边界**：公开、个人私密、经授权工作资料、组织受限、客户或机密。
- **可恢复性**：校验和备份、备份验证、隔离恢复、跨进程纠正读回。
- **可升级性**：中国发行版差异留在 `distributions/mybrain-cn/`，GBrain Core 保持原生升级路径。

## 当前证据与未决问题

工程门禁目前覆盖：

- GBrain 原生 Bootstrap 为唯一身份与安装路径
- MyBrain CN 激活、Schema 与原生 Skillpack
- P0 9/9、native E2E 7/7、host adapters 5/5、GBrain verify 54/54
- full-history clean clone、资料阻断、会前准备、纠正、备份与恢复

这些绿灯只证明工程路径一致，不证明用户价值或商业成立。下一阶段只验证：

1. 干净 MacBook + Codex 的真实首次部署；
2. Day 1 真实会前准备或判断任务；
3. 一次纠正在新会话改变答案；
4. 备份与隔离恢复；
5. Day 7 自愿重复使用；
6. 同一 User Brain 在一个非 Codex 宿主完成目标客户端回路。

## 文档地图

- [MyBrain CN 发行版说明](distributions/mybrain-cn/README.md)
- [Agent 部署合同](distributions/mybrain-cn/DEPLOY_FOR_AGENTS.md)
- [宿主支持矩阵](distributions/mybrain-cn/AGENT_HOSTS.md)
- [Operator Runbook](distributions/mybrain-cn/OPERATOR_RUNBOOK.md)
- [发布与真人验收合同](distributions/mybrain-cn/MVP_ACCEPTANCE.md)
- [机器可读宿主状态](distributions/mybrain-cn/host-support.json)

## 治理与贡献

默认分支是 `master`，用于贴近 GBrain 上游并减少同步摩擦。`master` 受保护：不允许直接写入、force push 或删除；改动必须经 PR、发布门禁与 owner 合并。外部贡献者可以 fork、提交分支并发起 PR，最终产品取舍由维护者 `@Madkyotiger` 决定。

## 上游与许可证

MyBrain 使用 [GBrain](https://github.com/garrytan/gbrain) 作为引擎基线，保留原项目的 MIT License、贡献历史与技术文档。MyBrain 产品问题请提交到本仓库 Issues。
