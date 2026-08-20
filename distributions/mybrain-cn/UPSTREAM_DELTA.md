# 上游差异与 Fork 策略

基线时间：2026-08-21 CST。

## 本次 P0 前的事实

- Fork：`Madkyotiger/MyBrain`，分支 `master`。
- Upstream：`garrytan/gbrain`，分支 `master`。
- P0 开始时 fork HEAD：`649ffe5f8baf3ff7f979c77f4de3975904cfe029`。
- 当时差异：fork ahead `0`，behind `4`。
- 已 fast-forward 到 upstream：`b99f4c8b07780d2469608b03c7c301bd2beef271`。
- 同步后、写入 P0 前：ahead `0`，behind `0`。

## P0 的唯一预期差异

```text
distributions/mybrain-cn/**
```

P0 不修改 `src/`、根级 Skill、数据库 migration、CLI 或 MCP。中国版能力先通过 schema、产品合同、数据策略和独立评测表达。

## 复查命令

```bash
git fetch upstream --prune
git rev-list --left-right --count HEAD...upstream/master
git diff --name-status upstream/master...HEAD
cd distributions/mybrain-cn && bun run p0
```

## 何时接受 core divergence

只有 `ARCHITECTURE.md` 的 Core Patch Gate 全部满足，才允许在 overlay 之外产生差异。否则修配置、修 schema、修 Skill 或修 onboarding，不在 fork 里养一套隐形引擎。
