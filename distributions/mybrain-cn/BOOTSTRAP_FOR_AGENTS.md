# @MyBrain CN Bootstrap for Agents

这不是另一套安装器。它是 GBrain 原生 Bootstrap 的中国职业语境扩展。

**唯一主链路由仓库根目录 `BOOTSTRAP_FOR_AGENTS.md` 与 `gbrain bootstrap status` 持有。** 本文只说明中文提问、数据边界、Executive Schema 与 Skillpack 何时进入原生链路。原生命令与本文冲突时，以已安装的 GBrain CLI 为准。

## 适用宿主

能完整执行原生自动 Bootstrap：

- Claude Code
- Codex
- opencode

这些宿主可以完成原生的 preflight、engine、interview、render、skills、wire、repo、verify。

下列宿主目前只做 **Bootstrap 后接入**，不能冒充完整自动 Onboarding：

- Hermes Agent：本地 stdio MCP 接入
- WorkBuddy：本地 JSONC MCP 配置接入
- DeepSeek Harness：Cordis patch 接入，仍属 developer preview
- Feishu Aily：远程 MCP 登记交接，不包含远程部署

豆包桌面版目前没有已验证的官方 extension / MCP 接口，@MyBrain 不宣称支持。Feishu Aily 的远程 MCP 登记也不等于豆包桌面版支持。

## 安装原则

1. 不创建第二份 answers 文件。
2. 不生成第二个确认哈希。
3. 不另写 SOUL、USER、IDENTITY 或并行 Profile。
4. 所有身份与边界答案写入原生 `state/interview.json`。
5. 原生完整回读和确认完成前，不执行 render。
6. MyBrain CN 只在原生 render 后激活 Schema 与 8 个 Skills。
7. 最终要同时跑完 `gbrain bootstrap verify` 与 `mybrain-cn verify`，且两者都退出 0。

## 执行方式

### 1. 进入原生 Bootstrap

完整阅读仓库根目录 `BOOTSTRAP_FOR_AGENTS.md`。运行：

```bash
gbrain bootstrap status --json
```

严格跟随 CLI 返回的阶段。不要自己增加、跳过或重排阶段。

### 2. 用中文完成原生 Interview

运行：

```bash
gbrain bootstrap interview --init
```

按原生 question bank 分三轮询问，答案保持原话。中文问法如下，键名不变。

**第 1 轮：身份与工作**

- `AGENT_NAME`：你希望这个 Agent 叫什么？请给名字，不要给岗位名。
- `PRINCIPAL_NAME`：你叫什么？Agent 应该怎么称呼你？
- `AGENT_PURPOSE`：六个月后，它做到什么才算真正有价值？
- `AGENT_TOP_JOBS`：按优先级列出 3–5 个反复发生的工作。

**第 2 轮：工作语境与关系**

- `PRINCIPAL_CONTEXT`：你做什么、正在建设什么、在意什么、通常怎么工作？
- `PRINCIPAL_TIMEZONE`：你的 IANA 时区是什么，例如 `Asia/Shanghai`？必须询问并记录；只有用户明确确认时才使用 `Asia/Shanghai`，不得静默采用上游默认值。
- `SOUL_RELATIONSHIP`：它相对你是什么角色？可跳过。
- `SOUL_MODE_DEFAULT`：模糊请求时，默认先行动还是先问？可跳过。

**第 3 轮：表达与判断**

- `VOICE_REGISTER`：它默认应该怎么说话？请给一句示例。
- `SOUL_WINCE`：什么样的 Agent 回复会让你不舒服？可跳过。
- `SOUL_WORLDVIEW`：你的领域里，什么事实应影响它的判断？可跳过。
- `SOUL_GOOD_OUTPUT`：好输出应改变你的什么？可跳过。

每个答案用原生命令写入：

```bash
gbrain bootstrap interview --set KEY "用户原话"
```

### 3. 在同一原生答案集里加入中国职业边界

在完整回读前，继续使用原生 `--set` 写入以下键。它们会进入同一个 read-back hash，不形成第二套状态。

```bash
gbrain bootstrap interview --set PRINCIPAL_BOUNDARIES "用户确认的数据与行动边界"
gbrain bootstrap interview --set ACCESS_TIERS "谁能访问哪些个人、公司与客户资料"
gbrain bootstrap interview --set MEMORY_WHAT_MATTERS "需要长期保留的纠正、承诺、关系与决定依据"
gbrain bootstrap interview --set SURFACE_PRIMARY "当前主要使用宿主与设备边界"
```

默认政策必须向用户说清楚：

- `public`、`personal_private` 可在明确选择后进入。
- `work_authorized` 需要独立工作来源与明确授权。
- `org_restricted`、`client_or_secret` 默认阻断。
- 不批量扫描整台电脑，不把个人私密资料默认发给外部模型。

不要替用户编答案。默认政策只说明产品边界，用户的身份、关系和工作偏好仍由用户本人决定。

### 4. 原生完整回读与确认

运行：

```bash
gbrain bootstrap interview --show
```

把全部答案紧凑回读给用户，明确询问是否准确。用户确认后，使用输出中的原生 hash：

```bash
gbrain bootstrap interview --confirm <native-read-back-hash>
```

修改任何答案后，旧确认自动失效；必须重新完整回读和确认。

### 5. 原生 Render

```bash
gbrain bootstrap render
```

原生 render 负责身份文件。@MyBrain 不再生成 `MYBRAIN.md`、自定义 answers 或第二套身份文件。

### 6. 激活 MyBrain CN Overlay

普通本地安装中，GBrain 状态根通常是 `$HOME`；若设置了 `GBRAIN_HOME`，使用同一个值。

```bash
GBRAIN_STATE_ROOT="${GBRAIN_HOME:-$HOME}"
mybrain-cn activate \
  --workspace "$PWD" \
  --state-root "$GBRAIN_STATE_ROOT"
```

这一步只做四件事：

- 读取并验证原生 Interview confirmation hash
- 安装并启用 `mybrain-cn-executive` Schema Pack
- 使用原生 `gbrain skillpack scaffold` 安装 8 个 Executive Skills
- 写入 `state/mybrain-cn.json` 激活回执

它不初始化数据库、不创建 Git 仓库、不接管身份、不连接宿主。

### 7. 回到原生链路

继续运行根目录原生 Bootstrap 要求的 wire、repo、verify 阶段。Claude Code、Codex 与 opencode 使用原生 wire。Hermes、WorkBuddy 或 DeepSeek Harness 不伪装成原生 harness；等 `gbrain bootstrap verify` 与 `mybrain-cn verify` 都成功后，才使用对应的 `mybrain-cn runtime ...` 接入。

### 8. 上线验收

```bash
gbrain bootstrap verify
mybrain-cn verify \
  --workspace "$PWD" \
  --state-root "${GBRAIN_HOME:-$HOME}"
```

两条命令都退出 0 才能称为完成。任何一个失败，都回到它指出的原生阶段或 MyBrain 激活问题，不得手工伪造 PASS。

## 机器二

已有初始化完成的用户实例仓库，按原生 `gbrain bootstrap attach` 接入新机器；随后运行 `mybrain-cn verify`。只有 Schema 或 Skills 缺失、版本变化时才重新执行 `mybrain-cn activate`，再重跑原生 verify。不要重跑 Interview，也不要创建第二份身份。
