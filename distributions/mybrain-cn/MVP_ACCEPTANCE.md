# P0 与 MVP 验收

## P0 出口

| ID | 验收项 | 状态 | 证据 |
|---|---|---|---|
| P0-01 | 产品合同明确用户、承诺、非目标与反转条件 | PASS | `PRODUCT_CONTRACT.md` |
| P0-02 | 上游基线与 fork 差异可追溯 | PASS | `UPSTREAM_DELTA.md` + Git ancestry check |
| P0-03 | overlay/core 边界可执行 | PASS | 变更只允许在本目录；validator 会检查 |
| P0-04 | 数据分级与禁入规则明确 | PASS | `DATA_CLASSIFICATION.md` + `data-policy.json` |
| P0-05 | 中文/双语检索基线真实运行 | PASS | `tests/chinese-retrieval-baseline.test.ts` |
| P0-06 | P0 合同可机器验证 | PASS | `bun run validate` |

## 进入 P1 前的阻塞

- **技术 owner：未指定。** 没有 owner，不开始接飞书/微信、不做远程部署、不把维护责任落到产品发起人身上。
- **首批真实 pilot：未指定。** 至少需要两名目标用户；一人不能证明可迁移性。
- **runtime 默认：未决定。** P1 需在 Codex/Claude Code 本地路径与 Hermes 常驻路径之间锁一个首选，不同时做两套 onboarding。

## MVP 最终验收

1. 新用户不用理解 70 个 Skill，也能完成一次跨会话记忆回读。
2. 三条 Hero Loops 至少两条出现重复使用，不只在演示中成立。
3. 中文姓名、英文别名、中英混合查询稳定通过。
4. 每个重要结论带来源；缺口和过期信息可见。
5. 用户纠正后，新会话不再重复同一错误。
6. `org_restricted` 与 `client_or_secret` 不进入个人 P0 数据面。
7. 非产品发起人可以完成安装、恢复和常见故障处理。
8. 上游更新后，overlay 仍可通过完整 P0 gate。

MVP 的成功不是“安装人数”或“Skill 数量”，而是高价值回路被重复使用，且纠正、来源和边界都成立。
