# 架构与所有权边界

## 三层，不多一层

### 1. GBrain Core

上游 `garrytan/gbrain` 继续拥有数据库、检索、图谱、MCP、同步、权限基础和通用 Skillpack/Schema Pack 机制。@MyBrain 不复制这些能力。

### 2. @MyBrain Distribution

本目录拥有中国场景的产品合同、默认数据边界、Executive schema、精选 Skill 入口和中文/双语验收。它是 overlay，可独立删除，不应阻塞上游更新。

### 3. User Brain

每个用户的身份、关系、会议、项目、判断和资料都在自己的私有 Brain。分发仓库只放合成语料和通用规则，不承载任何真实用户内容。

## Core Patch Gate

只有同时满足以下条件，才允许修改 GBrain Core：

1. 目标用户的关键回路出现可复现阻断；
2. 有最小红灯测试，且 overlay 配置无法修复；
3. 改动保持通用，不写入中国品牌、个人身份或私有路径；
4. PGLite 与 Postgres 的行为边界被说明；
5. 有回滚方案，并优先形成可上游贡献的补丁。

“感觉中国用户可能需要”不构成 core patch 理由。

## 上游同步

- `upstream/master` 是引擎基线。
- `origin/master` 只保留上游提交加 `distributions/mybrain-cn/**` 差异。
- 每次 P0/P1 发布前先 fetch 上游，记录 ahead/behind，再跑 `bun run p0`。
- 如果未来必须改 core，改动要与 overlay 分开提交，便于上游吸收或回退。

## 配置变化原则

每个功能必须落到至少一种真实变化：配置、输出或工作流。只增加概念命名、不改变使用方式的功能，不进入 MVP。

- Executive schema 改变页面类型和 filing。
- 数据分级改变可导入范围和模型调用方式。
- Hero Loop 改变输出结构与下一步。
- 检索基线改变发布门槛。

## 部署边界

P1 验证本地 PGLite + 私有 Git 的单用户安装路径，并以 Hermes 作为首选 runtime，通过 GBrain stdio MCP 的 `verbs` surface 接入。Hermes adapter 是 overlay；GBrain 协议本身保持 runtime-neutral。

远程 Postgres、多人权限、飞书/微信连接器、企业 SSO、审计和中国境内数据驻留仍需要独立技术与法律评估；本 overlay 不声称已经解决。

## P1.1 交互与公开 Profile

`src/interactive-onboarding.ts` 只编排 overlay 已有的 answers validator、plan/hash 与 initializer。终端 I/O 可注入；公开 CLI 只接受 TTY，非法或缺失输入停止。三轮确认和最终确认发生在写入前，answers 保存和 plan/hash 生成发生在独立 `INSTALL` 安装确认之前，因此拒绝安装仍可保留一份可审阅计划。

`hermes-profile/` 是独立的 Hermes profile distribution package。它复制现有 8 个薄 Skill 入口，通过环境占位符指向用户私有 GBrain，不内嵌状态、凭据或机器路径。安装测试隔离 `HERMES_HOME`，证明当前本地目录安装语义；它不是 clean-machine proof。
