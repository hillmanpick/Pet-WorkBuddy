# WorkBuddy

WorkBuddy is an open-source AI desktop pet built with Tauri, Rust, React, and TypeScript. It keeps the desktop-pet feeling, while also adding a local Agent runtime that can chat, use configured AI providers, call local tools, and operate the computer after user authorization.

WorkBuddy 是一个开源 AI 桌面宠物项目。它不是网页版，也不是 Electron 应用，而是基于 Tauri + Rust 的真实桌面应用：桌宠常驻桌面，用户自己配置 API Key 和模型 ID，可以聊天、上传图片/文件、执行快捷指令，并在授权后调用本地工具完成电脑任务。

> WorkBuddy is not affiliated with Tencent, WeChat, OpenAI, Anthropic, DeepSeek, Kenney, or any other third-party brand mentioned in this repository.

## Highlights

- Real desktop app: Tauri + Rust, no Electron.
- Transparent 3D desktop pet with drag, rotate, resize, edge tuck, hover peek, and system tray restore.
- Pet bubbles above the character, compact chat input below the pet, and customizable chat box colors.
- Custom pet names, bilingual UI, global shortcuts, quick commands, and startup launch toggle.
- Bring-your-own-key providers: ChatGPT/OpenAI-compatible, Claude, and DeepSeek/OpenAI-compatible.
- Model IDs, base URLs, temperature, token limits, and system prompts are configurable.
- API keys are stored locally through the OS keychain.
- Image/file upload, drag-and-drop, and clipboard paste into chat.
- Codex-style local Agent runtime with plugin tools, risk levels, confirmation flow, and execution logs.
- Custom GLB/GLTF pet packs with animation and event mapping.

## Contents

- [中文说明](#中文说明)
- [English](#english)
- [License](#license)

## 中文说明

### 项目定位

WorkBuddy 的目标是做一个开源的 AI 桌面伙伴：它既有类似桌面宠物的陪伴感，也能在用户授权后执行本地电脑任务。它更接近“桌面宠物界面 + 本地 Agent Runtime”，不是单纯聊天窗口，也不是固定命令玩具。

当前项目重点：

- 桌宠体验：透明窗口、拖动、单独旋转手柄、贴边隐藏、45 度探头、气泡回复、系统托盘。
- AI 聊天：用户自己配置 API Key、Base URL、模型 ID 和系统提示词。
- 多模态输入：支持上传、拖拽、粘贴图片和文件，图片可发给支持视觉的模型识别。
- 本地任务：通过插件化工具执行打开应用、打开网页、剪贴板、文件整理、终端命令、截图、Office 文档等能力。
- 安全控制：敏感操作有授权模式、气泡确认和执行日志。
- 宠物扩展：用户可以替换自己的 GLB/GLTF 模型和动画映射。

### 桌宠功能

- 透明、置顶、可拖动的桌面宠物窗口。
- 拖到屏幕边缘后缩进屏幕，只露出一部分；鼠标移过去会探头出来，移开后缩回去。
- 宠物主体可拖动，右上角小球单独控制 360 度旋转。
- 点击宠物会随机触发不同动作和气泡台词。
- 超过一段时间未互动后，宠物会在屏幕内随机移动。
- 支持调节宠物大小、自定义宠物名字、中英文切换。
- 支持视觉跟随鼠标，宠物会轻微朝向鼠标。
- 主窗口隐藏在系统托盘，不占 Windows 任务栏；双击托盘图标可重新显示宠物。

### 聊天功能

- 宠物下方只显示输入框。
- AI 回复显示为宠物正上方的气泡，不遮挡宠物本体。
- 可在设置里切换聊天框颜色。
- 支持上传图片和文件，也支持拖拽文件/图片、从剪贴板粘贴图片。
- 聊天记录保存在本地，并可在设置里按日期查看，带时间戳。
- 支持自定义快捷指令和全局快捷键。

### 模型服务

WorkBuddy 默认内置三类 Provider。所有模型 ID 都可以在设置中修改。

| Provider | 默认名称 | 默认模型 ID | 说明 |
| --- | --- | --- | --- |
| OpenAI-compatible | ChatGPT | `gpt-5.5` | 使用 OpenAI 兼容 Chat Completions API |
| Anthropic | Claude | `claude-4.7` | 使用 Anthropic Messages API |
| OpenAI-compatible | DeepSeek | `deepseek-v4-pro` | 使用 DeepSeek/OpenAI 兼容 API |

WorkBuddy 不提供商业 API Key。用户需要自己在设置里配置 Key，Key 只保存在本机系统钥匙串。

### Codex 式本地 Agent Runtime

WorkBuddy 的插件不是普通 UI 插件，而是 Agent Tool 插件。每个插件把一类电脑能力封装成 AI 可调用的工具，Agent 负责理解任务、选择工具、执行、观察结果、继续执行，直到任务完成或需要用户接手。

架构大致如下：

```text
桌宠 UI
  -> 自然语言命令框
  -> Agent Runtime
  -> 插件管理器 / MCP Client 边界
  -> 工具插件：filesystem / terminal / browser / app / screen / clipboard / office / confirm
  -> Tauri Rust 后端
  -> 真实电脑操作
```

每个工具会声明：

- 工具名称
- 描述
- 参数 schema
- 所需权限
- 风险等级
- 执行结果

高风险操作会走确认流程，并写入本地执行日志。设置里的 Agent 页面可以查看内置工具、MCP 配置、最大复盘轮数和执行日志。

当前内置工具：

| 插件 | 能力 |
| --- | --- |
| `filesystem` | 列目录、搜索文件、读文件、写文件、复制、移动、删除到回收站 |
| `terminal` | 运行 PowerShell/cmd/git/npm/python，带超时、输出截断和风险标记 |
| `browser` | 打开网页，浏览器自动化接口预留给 Playwright/MCP sidecar |
| `app` | 打开微信、浏览器、VS Code、记事本、WPS/Word、指定文件 |
| `screen` | 截图、点击坐标、快捷键、向当前焦点输入文本，OCR 接口预留 |
| `clipboard` | 读写剪贴板、粘贴文本 |
| `office` | 创建 Word 兼容文档并打开 |
| `confirm` | Host 侧敏感操作确认 |

示例任务：

```text
帮我打开微信
帮我给张三发微信：今晚七点吃饭
打开浏览器进入百度，然后搜索 csdn
复制：这段文字放到剪贴板
帮我输入：这是一段测试文字
新建笔记：今天要检查打包流程
整理文档
提醒我 10 分钟后喝水
打开截图工具
打开系统设置
```

### 授权模式

| 模式 | 行为 |
| --- | --- |
| 完全授权 | 普通和敏感任务都会自动执行。只建议在完全信任当前环境时开启。 |
| 敏感操作询问 | 普通任务自动执行，整理文件、发送消息、终端命令等敏感任务会等待用户确认。 |
| 拒绝敏感操作 | 普通任务可以执行，敏感任务直接拦截。 |

默认推荐使用“敏感操作询问”。

### 安全边界

- WorkBuddy 不是微信官方 API 集成。
- 微信相关任务使用本地桌面自动化，不绕过登录、验证码或平台风控。
- WorkBuddy 不会偷取凭证、绕过权限弹窗、隐藏执行过程或上传本地隐私文件。
- 文件整理会移动文件，请确认计划后再执行。
- 终端命令属于敏感操作，默认需要确认。
- 打开网页只能说明系统接受了打开请求，不代表页面已经加载完成。
- 本地提醒只在 WorkBuddy 当前运行期间有效。

### 快速开始

环境要求：

- Windows 10/11
- Node.js 20+
- pnpm 9+
- Rust
- Windows MSVC Build Tools

安装依赖：

```powershell
pnpm install
```

本地运行桌面版：

```powershell
pnpm desktop
```

如果 `5175` 端口被占用，先关闭占用端口的 Vite 进程，或改 Tauri 配置里的 `devPath` 和 Vite 端口。

前端预览：

```powershell
pnpm dev
```

### 打包

```powershell
pnpm desktop:pack
```

打包产物会生成在：

```text
apps/desktop/src-tauri/target/release/bundle/
```

Windows 辅助命令文件：

- `dev.bat`: 启动桌面开发环境。
- `build.bat`: 打包桌面应用。
- `update.bat`: 拉取最新代码、安装依赖并构建。

PowerShell 脚本位于 `scripts/`。

### 宠物模型

默认宠物包位于：

```text
pet-packs/
apps/desktop/public/pet-packs/
```

宠物包通常包含：

```text
pet.json
model.glb
preview.png
Textures/
LICENSE-KENNEY.txt
```

`pet.json` 示例：

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

把新宠物包加入 `apps/desktop/public/pet-packs/manifest.json` 后，就可以在设置里选择。

默认宠物资源来自 Kenney Cube Pets，资源为 CC0。详情见 `THIRD_PARTY_NOTICES.md`。

### 常用命令

```powershell
pnpm install
pnpm desktop
pnpm build
pnpm desktop:pack
pnpm typecheck
```

开发细节见 [docs/development.md](docs/development.md)。

### 项目结构

```text
apps/desktop              Tauri + React 桌面应用
apps/desktop/src          React 前端
apps/desktop/src-tauri    Rust/Tauri 后端
apps/desktop/public       静态资源和宠物包
docs                      开发文档
packages                  共享包边界
pet-packs                 可分发宠物包源文件
scripts                   Windows/PowerShell 辅助脚本
```

## English

### What Is WorkBuddy?

WorkBuddy is an open-source AI desktop pet. It runs as a real desktop application powered by Tauri and Rust. Users bring their own API keys, configure model providers locally, install custom pet packs, and use a small animated companion for chat, quick commands, and approved local computer-control tasks.

It is not a web demo and not an Electron app. The desktop target is Tauri/Rust only.

### Features

- Transparent draggable desktop pet window.
- Edge tuck: move the pet to a screen edge and it hides partly off-screen; hover to peek it back out.
- Separate drag and rotate controls.
- AI replies appear as speech bubbles above the pet instead of covering it.
- Compact chat input below the pet.
- Customizable chat box colors.
- Image/file upload, drag-and-drop, and clipboard paste.
- Custom pet name, pet size, Chinese/English UI, and launch-on-startup toggle.
- Visual pointer follow for the 3D pet.
- Global shortcuts and custom quick commands.
- Independent settings window.
- GLB/GLTF pet packs with animation and event mapping.
- Local API key storage through the operating system keychain.
- Configurable provider base URLs, model IDs, temperatures, token limits, and system prompts.
- Codex-style local Agent runtime with plugin tools, execution review, authorization modes, and audit logs.

### Supported Providers

| Provider | Default display name | Default model ID | Notes |
| --- | --- | --- | --- |
| OpenAI-compatible | ChatGPT | `gpt-5.5` | Uses Chat Completions-compatible API |
| Anthropic | Claude | `claude-4.7` | Uses Anthropic Messages API |
| OpenAI-compatible | DeepSeek | `deepseek-v4-pro` | Uses DeepSeek/OpenAI-compatible API |

All model IDs are configurable in settings. WorkBuddy does not ship with commercial API keys.

### Codex-Style Local Agent Runtime

WorkBuddy can turn a natural-language task into plugin tool calls and execute them through local Rust tools. After execution, the result of each step is passed back to the Agent supervisor. WorkBuddy marks a task complete only when the result supports that conclusion; otherwise it continues, asks the user to take over, or reports failure.

Runtime shape:

```text
Pet UI
  -> Natural-language command box
  -> Agent Runtime
  -> Plugin manager / MCP Client boundary
  -> Tool plugins: filesystem / terminal / browser / app / screen / clipboard / office / confirm
  -> Tauri Rust backend
  -> Real computer operation
```

Each tool declares:

- name
- description
- input schema
- required permissions
- risk level
- structured result

High-risk tools go through confirmation and are recorded in a local audit log.

Built-in tools:

| Plugin | Capabilities |
| --- | --- |
| `filesystem` | list directories, search, read, write, copy, move, delete to recycle bin |
| `terminal` | run PowerShell/cmd/git/npm/python with timeout and output truncation |
| `browser` | open web pages; Playwright/MCP automation is reserved for a sidecar |
| `app` | open apps and files |
| `screen` | screenshots, coordinate clicks, hotkeys, focused text input; OCR interface reserved |
| `clipboard` | read, write, paste text |
| `office` | create Word-compatible documents |
| `confirm` | host-enforced confirmation for risky actions |

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
