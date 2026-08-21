# P0 / P1 / P1.1 验收

## P0：方向与边界

| ID | 验收项 | 状态 | 证据 |
|---|---|---|---|
| P0-01 | 用户、承诺、非目标与反转条件明确 | PASS | `PRODUCT_CONTRACT.md` |
| P0-02 | 上游基线与 fork 差异可追溯 | PASS | `UPSTREAM_DELTA.md` + Git ancestry |
| P0-03 | overlay/core 边界可执行 | PASS | changed-path validator |
| P0-04 | 数据分级与禁入规则明确 | PASS | `DATA_CLASSIFICATION.md` + `data-policy.json` |
| P0-05 | 中文/双语检索基线真实运行 | PASS | `tests/chinese-retrieval-baseline.test.ts` |
| P0-06 | P0 合同可机器验证 | PASS | `scripts/validate-p0.ts` |

## P1：单用户可安装 MVP

| ID | 必须为真 | 状态 | 真实 proof |
|---|---|---|---|
| P1-01 | 全新环境能建 PGLite、Schema、8 Skills 与 Hermes adapter | PASS | isolated fresh install |
| P1-02 | Hermes 接到的不是假配置，而是可启动的 MCP | PASS | 真实 stdio endpoint，MEMORY_VERBS conformance 通过 |
| P1-03 | 明确选择的中文材料能支撑第一条会前回路 | PASS | intake → sync → meeting-prep |
| P1-04 | 受限组织资料与客户机密在落盘前被阻断 | PASS | fail-closed intake test |
| P1-05 | correction 能跨新进程读回 | PASS | remember → fresh process recall |
| P1-06 | 恢复不是“有备份文件就算了” | PASS | checksum verify → isolated restore → 页面与 correction 回读 |

P1 的 Accountable Owner 已在私有项目控制面明确；MK 是 Builder / Operator。产品发起人不成为默认 helpdesk。非创始人 support owner 要在 P2 多用户 pilot 前落实。

## P1.1：可交互交付候选

| ID | 必须为真 | 状态 | 自动化证据 |
|---|---|---|---|
| P1.1-01 | 三轮问题各自回读确认，最终完整回读再确认 | PASS | injectable interaction tests |
| P1.1-02 | answers/plan/hash 先生成，独立 `INSTALL` 后才初始化 | PASS | exact-token gate tests |
| P1.1-03 | 非交互、必答缺失、非法选择、未确认全部 fail closed | PASS | unit + spawned CLI tests |
| P1.1-04 | Hermes nested package 无用户数据、无凭据、无机器路径并含现有 8 Skills | PASS | P1.1 validator |
| P1.1-05 | 当前 Hermes 接受 `profile install <local-dir> --name <name> -y` | PASS | isolated local install test |
| P1.1-06 | 操作与真人验收协议可执行且不虚报 | PASS | runbook + four-scenario blank evidence template |

真人 Day 1 / Day 7、非 Builder 独立恢复和 clean-machine 安装仍未证明。`acceptance/p1.1-evidence-template.json` 的四项状态均为 `not-run`，不能用合成自动化结果替代。

## 还没有被证明的事

- 两条以上 Hero Loops 在真实工作中出现重复使用。
- 非产品发起人可以不依赖 Builder，独立完成安装、恢复和常见故障处理。
- 飞书、微信、远程 Postgres、企业权限与数据驻留已经解决。
- 合成验收等于产品市场成立。

因此当前状态是 **P1 candidate**，不是“通用 Brain 已经可以大规模交付”。下一阶段的真正工作不是继续加 Skill，而是拿真实用户证明迁移性与重复使用。
