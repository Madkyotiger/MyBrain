# MyBrain CN｜Executive Personal Agent OS Overlay

这是 MyBrain 的中国本土化分发层。它不复制 GBrain，也不把某个人的私有 Brain 做成模板；它负责把上游能力收束成中国高级管理者能真正用起来的产品合同、数据边界、知识结构和验收基线。

## P0 已锁定什么

- **目标用户**：中国的品牌、市场与专业服务管理者，工作材料中中英文混用，主要协作面是飞书、微信、会议、文档与本地知识库。
- **首个价值**：跨会话保留上下文，在会前准备、项目判断和每周复盘中给出有来源的答案，并明确不知道什么。
- **产品边界**：个人专业 Brain，不是 Company Brain，不默认接入客户机密，不模仿某位创始人的人格。
- **技术边界**：GBrain 继续做引擎；本目录只做可拆卸 overlay。没有可复现红灯，不改核心。
- **P0 证据**：中文短姓名、英文别名、中英混合、中文正文、source 隔离和负向控制均由本地 PGLite 测试真实执行。

## 目录

- `PRODUCT_CONTRACT.md`：用户、承诺、Hero Loops 与非目标。
- `ARCHITECTURE.md`：上游、分发层与用户私有 Brain 的边界。
- `DATA_CLASSIFICATION.md`：数据分级、模型调用和禁入规则。
- `UPSTREAM_DELTA.md`：fork 与上游差异，以及 core patch gate。
- `MVP_ACCEPTANCE.md`：P0 出口与 MVP 验收状态。
- `schema-packs/mybrain-cn-executive/pack.yaml`：Executive 知识结构。
- `evals/retrieval-baseline.json`：合成的中文/双语检索语料与断言。
- `tests/`：合同与检索的可执行测试。

## 真实验证

从仓库根目录执行：

```bash
cd distributions/mybrain-cn
bun run p0
```

`p0` 会先校验合同、边界、schema 和上游基线，再启动隔离的 PGLite，跑中文/双语检索。它不读取用户的真实 Brain，也不需要 API Key。

## 当前状态

**P0 candidate 已落地；尚不是可安装产品。** 进入 P1 前必须指定技术 owner。飞书/微信接入、8 个 MVP Skill、真实用户 onboarding 与商业化均不在 P0 内。
