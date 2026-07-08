# WorkBuddy

WorkBuddy 是一个开源 AI 桌面宠物项目。它不是网页玩具，也不是 Electron 应用，而是基于 Tauri + Rust 的桌面应用：宠物常驻桌面，用户自己配置 API Key，可以聊天、执行快捷指令、做简单电脑任务，并支持自定义 3D 宠物模型。

WorkBuddy is an open-source AI desktop pet built with Tauri + Rust. It gives users a small animated desktop companion with configurable AI providers, local API key storage, customizable pet packs, global shortcuts, and confirmed local computer-control tasks.

---

## 中文说明

### 功能

- 纯桌面版：Tauri + Rust + React + TypeScript。
- 透明、可拖动、可置顶的桌面宠物窗口。
- 支持宠物贴边隐藏，鼠标移过去后探出。
- 点击宠物会触发不同动作。
- 可隐藏操作栏，可调整宠物大小。
- 聊天输入框出现在宠物下方，AI 回复以宠物气泡显示。
- 设置窗口独立打开，支持中英文切换。
- 设置里支持开机自启动。
- 支持全局快捷键唤起聊天框。
- 支持自定义快捷指令。
- 支持本地配置模型服务和模型 ID。
- API Key 只保存在用户本地系统密钥库。
- 支持自定义宠物包和 GLB/GLTF 模型。
- 内置多只 CC0 可爱宠物模型。
- 支持简单电脑任务，执行前默认需要用户确认。
- 支持三档电脑任务授权：完全授权、敏感操作询问、拒绝敏感操作。
- 已移除 Electron，项目只保留 Tauri/Rust 桌面路线。

### 支持的模型服务

当前内置支持：

- ChatGPT / OpenAI-compatible API
- Claude / Anthropic API
- DeepSeek / OpenAI-compatible API

所有模型 ID 都可以在设置里修改，不写死在代码里。

### 电脑任务能力

WorkBuddy 可以识别一些简单任务，并在执行前显示任务计划。确认后才会操作电脑。

当前支持：

- 打开应用：微信、资源管理器、记事本、计算器、画图、系统设置、截图工具。
- 打开文件夹：桌面、下载、文档、图片、音乐、视频、用户目录。
- 打开网页。
- 搜索网页。
- 复制文字到剪贴板。
- 向当前光标位置粘贴文字。
- 新建记事本笔记。
- 整理常用文件夹：把第一层文件按类型移动到 `WorkBuddy Organized`。
- 设置本地提醒/倒计时。
- 准备微信消息：打开微信、搜索联系人、填入消息，最后发送前二次确认。

授权模式：

- 完全授权：普通和敏感任务都会自动执行，包括整理文件和发送前的最后一步。只建议在完全信任当前环境时开启。
- 敏感操作询问：普通任务自动执行，整理文件、发送消息等敏感任务需要用户同意或拒绝。
- 拒绝敏感操作：普通任务可以执行，整理文件、发送消息等敏感任务会被直接拦截。

示例：

```text
帮我打开微信
帮我给张三发微信：今晚七点吃饭
搜索 Tauri 全局快捷键
打开下载文件夹
打开文档文件夹
复制：这段文字放到剪贴板
帮我输入：这是一段测试文字
新建笔记：今天要检查打包流程
整理文档
整理下载文件夹
提醒我 10 分钟后喝水
打开截图工具
打开系统设置
```

安全边界：

- WorkBuddy 不接入微信官方 API。
- 微信发送使用本地桌面自动化，不会绕过登录、验证码或风控。
- 默认授权模式是“敏感操作询问”。
- 整理文件夹会移动文件，请确认任务计划后再执行。
- 微信发送会在最后一步再次确认，确认后才按 Enter 发送。
- 电脑操作模块只执行白名单动作，不执行任意 shell 命令。
- 本地提醒只在 WorkBuddy 当前运行期间有效。

### 安装依赖

需要安装：

- Node.js 20+
- pnpm 9+
- Rust
- Windows MSVC Build Tools

安装依赖：

```powershell
pnpm install
```

### 本地运行

运行桌面版：

```powershell
pnpm desktop
```

如果只想预览前端：

```powershell
pnpm dev
```

### 打包

打包 Windows 桌面安装包：

```powershell
pnpm desktop:pack
```

产物会生成在：

```text
apps/desktop/src-tauri/target/release/bundle/
```

Windows 用户也可以直接双击：

- `dev.bat`：启动桌面开发环境。
- `build.bat`：打包桌面应用。
- `update.bat`：拉取最新代码、安装依赖并构建。

PowerShell 版本在 `scripts/` 目录。

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

`pet.json` 用来描述模型文件、预览图、默认动作、动画映射和事件动作。你可以把自己的 GLB/GLTF 模型放进新的宠物包里。

### 项目结构

```text
apps/desktop              Tauri + React 桌面应用
apps/desktop/src-tauri    Rust/Tauri 后端
apps/desktop/src          React 前端
pet-packs                 可分发宠物包
packages                  共享包边界
docs                      项目文档
scripts                   Windows/PowerShell 辅助命令
```

### 常用命令

```powershell
pnpm install
pnpm desktop
pnpm build
pnpm desktop:pack
pnpm typecheck
```

### 开源协议

WorkBuddy 使用 MIT License。

默认宠物资源来自 Kenney Cube Pets，资源为 CC0。详情见 `THIRD_PARTY_NOTICES.md`。

---

## English

### Overview

WorkBuddy is an open-source AI desktop pet. It runs as a real desktop app powered by Tauri + Rust, not Electron. Users bring their own API keys, choose a model provider, customize model IDs, install their own pet models, and use the pet as a small desktop companion for chat and simple confirmed computer tasks.

### Features

- Desktop-first app built with Tauri + Rust + React + TypeScript.
- Transparent, draggable, always-on-top pet window.
- Edge tuck behavior: the pet can hide near screen edges and peek back out on hover.
- Pet click actions and animation event mapping.
- Hideable toolbar and adjustable pet size.
- Chat input below the pet; AI replies appear as pet speech bubbles.
- Separate settings window with Chinese/English UI.
- Launch-on-startup toggle in settings.
- Global shortcuts for opening chat and common actions.
- User-defined quick commands.
- Configurable AI providers, base URLs, model IDs, temperatures, token limits, and system prompts.
- API keys stored locally through the operating system keychain.
- Custom pet packs with GLB/GLTF model support.
- Bundled CC0 cute pet packs.
- Confirmed local computer-control tasks.
- Three computer authorization modes: full access, ask for sensitive actions, or deny sensitive actions.
- Electron has been removed; the desktop target is Tauri/Rust only.

### AI Providers

Built-in providers:

- ChatGPT / OpenAI-compatible API
- Claude / Anthropic API
- DeepSeek / OpenAI-compatible API

Model IDs are configurable in settings and are not hardcoded.

### Computer Control

WorkBuddy includes a local computer-control layer for simple desktop tasks. It shows a task plan first and requires user confirmation by default.

Supported tasks:

- Open apps: WeChat, File Explorer, Notepad, Calculator, Paint, Windows Settings, screenshot tool.
- Open folders: Desktop, Downloads, Documents, Pictures, Music, Videos, Home.
- Open websites.
- Search the web.
- Copy text to the clipboard.
- Paste text into the currently focused field.
- Create quick Notepad notes.
- Organize common folders by moving top-level files into `WorkBuddy Organized`.
- Set local reminders/countdowns.
- Prepare WeChat messages by opening WeChat, searching a contact, and filling the message, with a second confirmation before sending.

Authorization modes:

- Full access: normal and sensitive tasks run automatically, including file organization and final send steps. Use only in fully trusted environments.
- Ask for sensitive actions: normal tasks run automatically; sensitive tasks such as organizing files or sending messages wait for user approve/deny.
- Deny sensitive actions: normal tasks can run; sensitive tasks such as organizing files or sending messages are blocked.

Example prompts:

```text
Open WeChat
Send WeChat to Alice: dinner at 7 tonight
Search Tauri global shortcuts
Open Downloads
Copy: put this text on the clipboard
Paste: this is a test message
Create note: check the packaging flow today
Organize Documents
Organize Downloads
Remind me in 10 minutes to drink water
Open screenshot tool
Open Windows Settings
```

Safety boundaries:

- WorkBuddy is not a WeChat API integration.
- WeChat tasks use local desktop automation and do not bypass login, verification, or platform controls.
- The default authorization mode asks before sensitive actions.
- Folder organization moves files, so review the task plan before confirming.
- WeChat sending asks for a second confirmation before pressing Enter.
- The Rust computer-control layer only accepts structured allowlisted actions.
- Local reminders only live while WorkBuddy is running.

### Requirements

- Node.js 20+
- pnpm 9+
- Rust
- Windows MSVC Build Tools

### Install

```powershell
pnpm install
```

### Run Locally

Run the desktop app:

```powershell
pnpm desktop
```

Optional frontend preview:

```powershell
pnpm dev
```

### Package

Build Windows desktop installers:

```powershell
pnpm desktop:pack
```

Generated bundles are written to:

```text
apps/desktop/src-tauri/target/release/bundle/
```

Windows users can also double-click:

- `dev.bat`: start desktop development.
- `build.bat`: package the desktop app.
- `update.bat`: pull the latest project files, install dependencies, and build.

PowerShell equivalents live in `scripts/`.

### Pet Packs

Default pet packs live in:

```text
pet-packs/
apps/desktop/public/pet-packs/
```

Each pack usually contains:

```text
pet.json
model.glb
preview.png
Textures/
LICENSE-KENNEY.txt
```

`pet.json` describes the model file, preview image, default animation, animation mapping, and event actions. You can add your own GLB/GLTF pet models by creating a new pet pack.

### Project Layout

```text
apps/desktop              Tauri + React desktop app
apps/desktop/src-tauri    Rust/Tauri backend
apps/desktop/src          React frontend
pet-packs                 Redistributable pet packs
packages                  Shared package boundaries
docs                      Project documentation
scripts                   Windows/PowerShell helper commands
```

### Useful Commands

```powershell
pnpm install
pnpm desktop
pnpm build
pnpm desktop:pack
pnpm typecheck
```

### License

WorkBuddy is MIT licensed.

Default pet assets are from Kenney Cube Pets and are CC0. See `THIRD_PARTY_NOTICES.md`.
