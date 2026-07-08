# WorkBuddy

WorkBuddy 是一个开源 AI 桌面宠物项目。它不是网页玩具，也不是 Electron 应用，而是基于 Tauri + Rust 的真实桌面应用：宠物常驻桌面，用户自备 API Key，可以聊天、执行快捷指令、处理简单电脑任务，并支持替换 3D 宠物模型。

WorkBuddy is an open-source AI desktop pet built with Tauri, Rust, React, and TypeScript. Users bring their own API keys, configure model IDs locally, install custom pet packs, and use the pet as a small desktop companion for chat, quick commands, and confirmed local computer-control tasks.

> WorkBuddy is not affiliated with Tencent, WeChat, OpenAI, Anthropic, DeepSeek, Kenney, or any other third-party brand mentioned in this repository.

## Highlights

- Desktop-first: Tauri + Rust, no Electron.
- Transparent draggable pet window with edge tuck and hover peek behavior.
- 3D GLB/GLTF pet packs with custom animations and event mapping.
- Chat input below the pet, AI replies and task prompts shown as pet bubbles.
- Global shortcuts and user-defined quick commands.
- Configurable providers: ChatGPT/OpenAI-compatible API, Claude, and DeepSeek/OpenAI-compatible API.
- Configurable model IDs, base URLs, temperature, token limits, and system prompts.
- API keys are stored only on the user's local machine through the OS keychain.
- Local computer-control Agent with structured actions, execution review, and authorization modes.
- Launch-on-startup toggle, bilingual UI, and independent settings window.

## Table Of Contents

- [Chinese](#chinese)
- [English](#english)
- [License](#license)

## Chinese

### 项目定位

WorkBuddy 的目标是做一个开源的 AI 桌面伙伴：它既有类似桌面宠物的陪伴感，也能在用户授权后执行一些本地电脑任务。它更接近“桌面 Agent + 宠物界面”，不是单纯聊天窗口，也不是固定命令玩具。

当前项目重点：

- 桌面体验：透明窗口、拖动、贴边隐藏、宠物气泡、系统托盘。
- AI 聊天：用户自己配置 API Key 和模型 ID。
- 桌面任务：通过本地 Rust 工具执行打开应用、搜索网页、整理文件、复制粘贴、创建文档等操作。
- 安全控制：敏感操作必须经过授权，执行结果会回传给 Agent 复盘。
- 可扩展宠物：用户可以替换自己的 GLB/GLTF 模型和动画映射。

### 功能

#### 桌面宠物

- 透明、可拖动、可置顶的桌面宠物窗口。
- 拖到屏幕边缘后缩进屏幕，只露出一部分宠物，鼠标移过去会探出。
- 宠物本体可拖动，右上角小球单独控制旋转。
- 点击宠物会随机触发不同动作和气泡台词。
- 长时间未互动后，宠物会在屏幕内随机走动。
- 可隐藏操作栏，可调节宠物大小。
- 支持中英文界面切换。

#### 聊天与快捷指令

- 宠物下方只显示输入框。
- AI 回复显示为宠物上方气泡。
- 支持自定义快捷指令和全局快捷键。
- 设置窗口独立打开，不会把宠物移动到屏幕中央。
- 聊天记录可在设置里按日期查看，带时间戳。

#### 模型服务

内置三类 Provider：

| Provider | 默认名称 | 默认模型 ID | 说明 |
| --- | --- | --- | --- |
| OpenAI-compatible | ChatGPT | `gpt-4.1-mini` | 支持 OpenAI 兼容 Chat Completions API |
| Anthropic | Claude | `claude-sonnet-4` | 使用 Anthropic Messages API |
| OpenAI-compatible | DeepSeek | `deepseek-v4-pro` | 支持 DeepSeek/OpenAI 兼容 API |

所有模型 ID 都可以在设置里修改。WorkBuddy 不提供内置商业 API Key，用户需要自己配置。

#### 电脑任务 Agent

WorkBuddy 可以把自然语言任务转换为结构化本地动作，并交给 Rust 后端执行。执行后，WorkBuddy 会把每一步结果回传给 Agent 复盘；如果无法确认完成，会继续规划补救动作、要求用户接手，或者报告失败，不会只因为动作已经发出就标记完成。

当前支持的本地动作：

- 打开应用：微信、WPS、Word、资源管理器、记事本、计算器、画图、系统设置、截图工具。
- 打开文件夹：桌面、下载、文档、图片、音乐、视频、用户目录。
- 打开网页和搜索网页。
- 复制文字到剪贴板。
- 向当前光标位置粘贴文字。
- 新建记事本笔记。
- 创建 Word 兼容文档并用 WPS/Word 打开。
- 整理常用文件夹，把第一层文件按类型移动到 `WorkBuddy Organized`。
- 设置本地提醒/倒计时。
- 准备微信消息：打开微信、搜索联系人、填入消息，发送前再次确认。
- 执行 PowerShell 命令，默认视为敏感操作。

示例：

```text
帮我打开微信
帮我给张三发微信：今晚七点吃饭
打开浏览器进入百度，然后搜索 csdn
打开下载文件夹
复制：这段文字放到剪贴板
帮我输入：这是一段测试文字
新建笔记：今天要检查打包流程
整理文档
提醒我 10 分钟后喝水
打开截图工具
打开系统设置
```

### 授权模式

WorkBuddy 提供三档电脑任务授权：

| 模式 | 行为 |
| --- | --- |
| 完全授权 | 普通和敏感任务都会自动执行，包括整理文件、shell 命令、发送前最后一步等。只建议在完全信任当前环境时开启。 |
| 敏感操作询问 | 普通任务自动执行，整理文件、发送消息、shell 命令等敏感任务会等待用户确认。 |
| 拒绝敏感操作 | 普通任务可以执行，敏感任务直接拦截。 |

默认推荐使用“敏感操作询问”。

### 安全边界

- WorkBuddy 不接入微信官方 API。
- 微信相关任务使用本地桌面自动化，不会绕过登录、验证码或平台风控。
- WorkBuddy 不会偷取凭证、绕过权限弹窗、隐藏执行过程或上传本地隐私文件。
- 整理文件夹会移动文件，请确认任务计划后再执行。
- shell 命令属于敏感操作，默认需要确认。
- 打开网页只能确认系统已请求默认浏览器打开，不能证明页面已加载完成；这种情况会提示用户检查。
- 本地提醒只在 WorkBuddy 当前运行期间有效。

### 快速开始

#### 环境要求

- Windows 10/11
- Node.js 20+
- pnpm 9+
- Rust
- Windows MSVC Build Tools

#### 安装依赖

```powershell
pnpm install
```

#### 本地运行桌面版

```powershell
pnpm desktop
```

前端预览：

```powershell
pnpm dev
```

Vite 开发服务器默认使用 `127.0.0.1:5175`。

#### 打包安装包

```powershell
pnpm desktop:pack
```

打包产物会生成在：

```text
apps/desktop/src-tauri/target/release/bundle/
```

Windows 用户也可以直接运行：

- `dev.bat`: 启动桌面开发环境。
- `build.bat`: 打包桌面应用。
- `update.bat`: 拉取最新代码、安装依赖并构建。

PowerShell 脚本位于 `scripts/`。

### 宠物包

默认宠物包位于：

```text
pet-packs/
apps/desktop/public/pet-packs/
```

每个宠物包通常包含：

```text
pet.json
model.glb
preview.png
Textures/
LICENSE-KENNEY.txt
```

`pet.json` 用来描述模型文件、预览图、默认动作、动画映射和事件动作。示例：

```json
{
  "id": "my-pet",
  "name": "My Pet",
  "type": "gltf",
  "model": "model.glb",
  "preview": "preview.png",
  "scale": 1,
  "defaultAnimation": "idle",
  "animations": {
    "idle": { "clip": "idle", "loop": true },
    "walk": { "clip": "walk", "loop": true },
    "happy": { "clip": "dance", "loop": false }
  },
  "events": {
    "onClick": "happy",
    "onChatOpen": "idle"
  }
}
```

把新的宠物包加入 `apps/desktop/public/pet-packs/manifest.json` 后，即可在设置里选择。

默认宠物资源来自 Kenney Cube Pets，资源为 CC0。详情见 `THIRD_PARTY_NOTICES.md`。

### 项目结构

```text
apps/desktop              Tauri + React 桌面应用
apps/desktop/src          React 前端
apps/desktop/src-tauri    Rust/Tauri 后端
apps/desktop/public       前端静态资源和宠物包
docs                      开发文档
packages                  共享包边界
pet-packs                 可分发宠物包源文件
scripts                   Windows/PowerShell 辅助脚本
```

### 常用命令

```powershell
pnpm install
pnpm desktop
pnpm build
pnpm desktop:pack
pnpm typecheck
```

开发细节见 [docs/development.md](docs/development.md)。

### 贡献

欢迎提交 Issue 和 Pull Request。比较适合贡献的方向：

- 新宠物包和动画映射。
- 更可靠的桌面操作工具。
- 更细粒度的安全授权策略。
- 更好的设置页和快捷键体验。
- 多平台适配。
- 文档和示例任务。

提交前建议运行：

```powershell
pnpm build
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## English

### What Is WorkBuddy?

WorkBuddy is an open-source AI desktop pet. It runs as a real desktop application powered by Tauri and Rust. Users bring their own API keys, configure model providers locally, and use a small animated pet for chat, quick prompts, and approved local computer-control tasks.

It is not a web demo and not an Electron app. The desktop target is Tauri/Rust only.

### Features

- Transparent draggable desktop pet window.
- Edge tuck: move the pet to a screen edge and it hides partly off-screen; hover to peek it back out.
- Separate drag and rotate controls.
- Pet speech bubbles for AI replies and computer-task confirmations.
- Global shortcuts and custom quick commands.
- Independent settings window.
- Chinese and English UI.
- Launch-on-startup toggle.
- GLB/GLTF pet packs with animation and event mapping.
- Local API key storage through the operating system keychain.
- Configurable provider base URLs, model IDs, temperatures, token limits, and system prompts.
- Computer-control Agent with structured actions, execution review, and configurable authorization modes.

### Supported Providers

| Provider | Default display name | Default model ID | Notes |
| --- | --- | --- | --- |
| OpenAI-compatible | ChatGPT | `gpt-4.1-mini` | Uses Chat Completions-compatible API |
| Anthropic | Claude | `claude-sonnet-4` | Uses Anthropic Messages API |
| OpenAI-compatible | DeepSeek | `deepseek-v4-pro` | Uses DeepSeek/OpenAI-compatible API |

All model IDs are configurable in settings. WorkBuddy does not ship with commercial API keys.

### Computer Control

WorkBuddy can turn a natural-language task into a structured action plan and execute it through local Rust tools. After execution, the result of each step is passed back to the Agent supervisor. WorkBuddy marks a task complete only when the result can support that conclusion; otherwise it continues, asks the user to take over, or reports failure.

Supported local actions include:

- Open whitelisted apps.
- Open common user folders.
- Open websites and web searches.
- Copy and paste text.
- Create Notepad notes.
- Create Word-compatible documents and open them with WPS/Word.
- Organize common folders into `WorkBuddy Organized`.
- Set local reminders.
- Prepare WeChat messages with final confirmation before sending.
- Run PowerShell commands as sensitive actions.

Authorization modes:

| Mode | Behavior |
| --- | --- |
| Full access | Normal and sensitive tasks run automatically. Use only in trusted environments. |
| Ask for sensitive actions | Normal tasks run automatically; sensitive tasks wait for approval. |
| Deny sensitive actions | Normal tasks run; sensitive tasks are blocked. |

### Safety Boundaries

- WorkBuddy is not a WeChat API integration.
- WeChat tasks use local desktop automation and do not bypass login, verification, or platform controls.
- WorkBuddy does not steal credentials, bypass permission prompts, hide execution, or upload local private files.
- Folder organization moves files, so review the task plan before approving.
- Shell commands are sensitive and require confirmation by default.
- Opening a URL only proves the OS accepted an open request; it does not prove the page loaded successfully.
- Local reminders only live while WorkBuddy is running.

### Requirements

- Windows 10/11
- Node.js 20+
- pnpm 9+
- Rust
- Windows MSVC Build Tools

### Install

```powershell
pnpm install
```

### Run

Run the desktop app:

```powershell
pnpm desktop
```

Run the frontend preview:

```powershell
pnpm dev
```

The Vite dev server uses `127.0.0.1:5175`.

### Package

Build Windows installers:

```powershell
pnpm desktop:pack
```

Generated bundles are written to:

```text
apps/desktop/src-tauri/target/release/bundle/
```

Windows helper files:

- `dev.bat`: start desktop development.
- `build.bat`: package the desktop app.
- `update.bat`: pull updates, install dependencies, and build.

PowerShell equivalents are in `scripts/`.

### Pet Packs

Default pet packs live in:

```text
pet-packs/
apps/desktop/public/pet-packs/
```

A pet pack usually contains:

```text
pet.json
model.glb
preview.png
Textures/
LICENSE-KENNEY.txt
```

Add a new pack to `apps/desktop/public/pet-packs/manifest.json` to make it selectable in settings.

### Project Layout

```text
apps/desktop              Tauri + React desktop app
apps/desktop/src          React frontend
apps/desktop/src-tauri    Rust/Tauri backend
apps/desktop/public       Static assets and pet packs
docs                      Development docs
packages                  Shared package boundary
pet-packs                 Redistributable pet pack sources
scripts                   Windows/PowerShell helper scripts
```

### Useful Commands

```powershell
pnpm install
pnpm desktop
pnpm build
pnpm desktop:pack
pnpm typecheck
```

See [docs/development.md](docs/development.md) for development details.

### Contributing

Issues and pull requests are welcome. Good contribution areas include:

- New pet packs and animation mappings.
- More reliable desktop-control tools.
- Finer-grained safety and authorization policies.
- Better settings and shortcut UX.
- Multi-platform support.
- Documentation and task examples.

Before submitting changes, run:

```powershell
pnpm build
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## License

WorkBuddy is released under the MIT License. See [LICENSE](LICENSE).

Default pet assets are from Kenney Cube Pets and are licensed under CC0-1.0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
