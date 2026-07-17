# Controlled Self-Improvement / 受控自我改进

WorkBuddy can improve its local planning context without retraining the selected AI model or silently modifying application code. Learned data is stored in the local WebView data store. Relevant enabled memories and task context are included in requests to the API provider selected by the user so the model can apply them.

WorkBuddy 可以在本地积累规划上下文，但不会重新训练所选模型，也不会静默修改应用源码。学习数据保存在本机 WebView 数据目录中；为了让模型使用这些内容，启用且相关的记忆和任务上下文会随请求发送给用户选择的 API 服务商。

## 中文使用说明

### 打开功能

1. 打开 WorkBuddy 设置。
2. 进入 `Agent`。
3. 打开 `受控自我改进`。
4. 分别选择长期记忆、经验库、失败反思、技能候选、自动评测和显式偏好学习。

### 长期记忆

WorkBuddy 只自动提取明确表达的偏好。例如：

```text
请记住，我写文档时默认使用 WPS。
我更喜欢用 Bing 搜索。
以后创建文件前先告诉我保存位置。
不要再默认打开微信。
```

普通问题和一次性任务不会因为出现某个词就自动成为偏好。你可以在设置中单独停用某条记忆。

同一个应用成功使用至少三次后，WorkBuddy 可以把它记录为低置信度的常用应用；后续使用次数增加时置信度会逐步提高。

启用的记忆会作为普通聊天的系统上下文发送给当前 API 服务商。任务经验和已批准技能只在本地 Agent 规划电脑任务时按相关性选取。

### 经验和反思

任务到达明确终态后，WorkBuddy 会记录：

- 用户原始任务。
- 成功、失败、需要用户或取消状态。
- 实际执行过的工具步骤和结果。
- 模型复核结论或失败信息。
- 下一次应验证什么、怎样缩小操作范围。

等待敏感操作确认不算成功。日志参数会截断并扫描 API Key、令牌、密码等凭证模式。

### 技能候选

成功的 Agent 工具任务可以生成一个声明式工作流候选。候选只包含已注册工具、脱敏参数、权限和风险等级，不包含可直接运行的任意源码。

自动评测检查：

1. 步骤数量必须有界。
2. 每个工具必须存在于当前工具注册表。
3. 必填参数必须满足工具 schema。
4. 不得包含疑似 API Key、Token、密码或 Secret。
5. 不允许把 `critical` 工具学习为技能。
6. `terminal.run` 命令必须通过危险命令静态检查。
7. 无副作用 dry-run 必须确认每一步的工具、权限和风险元数据与当前注册表一致。

评测通过后，仍需在设置中点击批准并确认。批准后的技能只会加入模型规划上下文；真正执行时仍会重新经过工具注册、风险判断和授权确认。

同一技能的步骤或参数发生变化时会生成待批准版本。新版本评测失败会自动丢弃挂起状态并继续使用旧的已批准版本；评测通过后也必须由用户批准才会替换当前版本。旧版本会保留在本地版本记录中。

### 回滚和清空

每次新增记忆、记录任务、生成技能、批准技能、拒绝技能或清空数据之前，WorkBuddy 都会创建恢复点。设置页会显示最近的改进原因和时间。

- `回滚`：恢复最近一次改动前的完整学习状态。
- `清空学习数据`：清空记忆、经验、反思和技能，但先创建恢复点，因此可以立即回滚。
- 恢复点最多保留 12 个，避免本地存储无限增长。

## English Guide

### Enable the feature

Open Settings -> Agent -> Controlled self-improvement, then choose the individual memory, experience, reflection, skill generation, evaluation, and preference-learning switches.

### Long-term memory

Only explicit statements are captured automatically:

```text
Please remember that I use WPS for documents.
I prefer Bing search.
Always tell me the destination before creating a file.
Never open WeChat by default.
```

Individual memories can be disabled in Agent settings.

### Experience and reflection

A task is recorded only after it reaches a clear outcome. Waiting for sensitive-action confirmation is not considered success. Stored tool arguments are bounded and scanned for credential-like data.

### Skill candidates

A successful tool task may create a declarative workflow candidate. The candidate cannot run by itself. It must pass bounded-step, known-tool, schema, credential, critical-risk, terminal-command, and no-side-effect permission/risk dry-run checks before the approval button becomes available.

Approval only makes the workflow available as advisory planning context. Tool validation, authorization mode, and sensitive-operation confirmation continue to apply to every real execution.

Changed workflows create a pending version. Failed evaluation keeps the currently approved version active; a passing version still requires explicit approval before promotion.

### Rollback

Every learning mutation creates a restore point first. The settings page shows recent change reasons and timestamps. Rollback restores the complete previous learning state. The latest 12 restore points are retained.

## Storage Limits

To keep the desktop data store bounded, WorkBuddy retains at most:

- 120 memories.
- 80 task experiences.
- 80 reflections.
- 40 learned skills.
- 10 versions per learned skill.
- 12 full restore points.

These limits apply only to controlled-learning data and do not change chat-history retention.
