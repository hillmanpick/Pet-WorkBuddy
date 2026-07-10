# WorkBuddy

WorkBuddy is an open-source AI desktop pet and local desktop Agent built with Tauri, Rust, React, and TypeScript.

WorkBuddy 是一个开源 AI 桌面宠物项目。它不是网页版，也不是 Electron 应用，而是基于 Tauri + Rust 的桌面应用：桌宠常驻桌面，用户自己配置 API Key 和模型 ID，可以聊天、识别图片和文件、执行快捷指令，并在用户授权后调用本地工具完成电脑任务。

> WorkBuddy is not affiliated with Tencent, WeChat, OpenAI, Anthropic, DeepSeek, Kenney, or any other third-party brand mentioned in this repository.
>
> WorkBuddy 与腾讯、微信、OpenAI、Anthropic、DeepSeek、Kenney 等第三方品牌没有官方关联。本项目不提供商业 API Key，用户需要自己配置服务商 Key。

## Contents

- [直接下载](#直接下载)
- [中文说明](#中文说明)
- [English Guide](#english-guide)
- [License](#license)

## 直接下载

不想拉代码或本地打包的用户，可以直接下载每个版本对应的 Windows 安装包。

| Version | Windows x64 installer | Release |
| --- | --- | --- |
| `v0.1.1` | [WorkBuddy_0.1.1_x64-setup.exe](https://github.com/hillmanpick/Pet-WorkBuddy/releases/download/v0.1.1/WorkBuddy_0.1.1_x64-setup.exe) | [Release notes](https://github.com/hillmanpick/Pet-WorkBuddy/releases/tag/v0.1.1) |
| `v0.1.0` | [WorkBuddy_0.1.0_x64-setup.exe](https://github.com/hillmanpick/Pet-WorkBuddy/releases/download/v0.1.0/WorkBuddy_0.1.0_x64-setup.exe) | [Release notes](https://github.com/hillmanpick/Pet-WorkBuddy/releases/tag/v0.1.0) |

All downloadable installers are published in [GitHub Releases](https://github.com/hillmanpick/Pet-WorkBuddy/releases). Source code users can still build locally with `pnpm desktop:pack`.

更新方式：退出旧版 WorkBuddy 后，直接运行新版安装包覆盖安装即可。用户配置、聊天记录、API Key 和通过设置导入的自定义宠物模型会保留在用户数据目录中，不会因为覆盖安装丢失。

## 中文说明

### WorkBuddy 是什么

WorkBuddy 的目标是做一个开源的 AI 桌面伙伴：它保留桌宠的陪伴感，也加入本地 Agent 能力。用户可以让它聊天、总结图片和文件、执行快捷任务、打开应用、操作剪贴板、整理文件、运行命令、创建文档，或者在授权后进行更完整的电脑操作。

简单理解：

```text
桌宠界面
  -> 自然语言命令
  -> Agent Runtime
  -> 插件工具系统
  -> Tauri/Rust 本地能力
  -> 真实电脑操作
```

### 主要功能

- 真实桌面应用：Tauri + Rust，不使用 Electron。
- 透明桌宠窗口：可拖动、可调大小、可旋转、可隐藏到系统托盘。
- 侧边缩进：把宠物拖到屏幕边缘后会缩进屏幕，只露出一部分，鼠标移过去会探头出来。
- 桌宠交互：点击宠物会触发随机动作和台词，长时间不互动会自动在屏幕内移动。
- 视觉跟随：宠物会轻微朝向鼠标，移动更有“活着”的感觉。
- 轻量聊天：宠物下方是输入框，AI 回复显示在宠物正上方气泡里。
- Markdown 友好显示：聊天内容会渲染粗体、列表和代码块，桌宠气泡不会直接显示 `**`、`###` 之类的原始 Markdown。
- 上传图片和文件：支持点击上传、拖拽文件、粘贴图片或文件到聊天框。
- 自定义外观：宠物名称、宠物大小、聊天框颜色、中英文 UI。
- 快捷键和快捷指令：可以配置全局快捷键，也可以添加自己的常用指令。
- 开机自启动：可在设置中打开或关闭，不需要管理员权限。
- 聊天记录：本地保存，可在设置里按日期查看，带时间戳。
- 本地 Agent：内置 filesystem、terminal、browser、app、screen、clipboard、office、confirm 等工具。
- 权限控制：高风险操作需要确认，并记录本地执行日志。
- 自定义宠物模型：支持 GLB/GLTF 宠物包、动画映射和事件映射。

### 快速开始

#### 1. 安装环境

需要准备：

- Windows 10/11
- Node.js 20+
- pnpm 9+
- Rust
- Windows MSVC Build Tools

如果 Rust 已安装但命令行找不到 `cargo`，可以先在当前 PowerShell 里临时加入 PATH：

```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
```

如果希望永久生效，请把下面路径加入 Windows 用户环境变量 `Path`：

```text
%USERPROFILE%\.cargo\bin
```

#### 2. 安装依赖

在项目根目录运行：

```powershell
pnpm install
```

#### 3. 启动桌面版

```powershell
pnpm desktop
```

第一次启动会编译 Rust 依赖，时间可能比较久，这是正常现象。启动成功后，桌面上会出现 WorkBuddy 宠物窗口。

#### 4. 如果端口被占用

开发模式使用 `127.0.0.1:5176`。如果看到类似 `Port 5176 is already in use`，说明之前的 Vite 进程还在运行。

可以关闭旧终端，或者在 PowerShell 中查看并结束占用进程：

```powershell
netstat -ano | findstr :5176
taskkill /PID <PID> /F
```

把 `<PID>` 换成上一条命令看到的进程号。

### 第一次使用

启动后建议按这个顺序配置：

1. 点击宠物工具栏里的设置按钮。
2. 进入 `模型` / `Providers` 页面。
3. 选择要用的服务商：ChatGPT、Claude 或 DeepSeek。
4. 填入 API Key。
5. 检查 Base URL 和模型 ID。
6. 保存设置。
7. 回到桌宠，点击聊天按钮，输入一句话测试。

如果没有配置 API Key，聊天请求会失败。WorkBuddy 不内置任何商业 Key，也不会向项目作者请求 Key。

### 模型配置

当前默认内置三个 Provider。所有模型 ID 都可以在设置中修改。

| Provider | 默认显示名 | 默认 Base URL | 默认模型 ID | 说明 |
| --- | --- | --- | --- | --- |
| OpenAI-compatible | ChatGPT | `https://api.openai.com/v1` | `gpt-5.5` | 使用 OpenAI 兼容 Chat Completions API |
| Anthropic | Claude | `https://api.anthropic.com` | `claude-4.7` | 使用 Anthropic Messages API |
| OpenAI-compatible | DeepSeek | `https://api.deepseek.com/v1` | `deepseek-v4-pro` | 使用 DeepSeek/OpenAI 兼容 API |

如果你的服务商使用不同模型名，直接在设置中改 `Model ID` 即可。比如你使用代理服务、第三方转发服务或本地兼容接口，也可以同时修改 `Base URL`。

API Key 存在本机系统密钥存储中，不会写入仓库代码。

### 桌宠怎么操作

| 操作 | 用法 |
| --- | --- |
| 移动宠物 | 按住宠物主体拖动 |
| 旋转宠物 | 按住宠物右上角的小球拖动 |
| 打开聊天 | 点击宠物工具栏的聊天按钮，或使用快捷键 |
| 打开设置 | 点击宠物工具栏的设置按钮 |
| 隐藏工具栏 | 点击工具栏隐藏按钮；15 秒无操作也会自动隐藏 |
| 重新显示工具栏 | 点击宠物旁边的小按钮 |
| 缩进屏幕边缘 | 把宠物拖到屏幕左/右/上/下边缘 |
| 从边缘探头 | 鼠标移到缩进位置附近 |
| 隐藏宠物 | 点击隐藏按钮，宠物会进入系统托盘 |
| 恢复宠物 | 双击系统托盘 WorkBuddy 图标 |

### 聊天怎么用

1. 点击宠物工具栏里的聊天按钮。
2. 宠物下方会出现一个输入框。
3. 输入问题或任务。
4. 按发送按钮，或用快捷键发送。
5. AI 回复会显示在宠物上方气泡里。
6. 完整聊天记录会保存在本地，并可在设置中的聊天记录页查看。

输入内容可以是普通聊天，也可以是任务：

```text
帮我总结这张图片
帮我把这个文件内容整理成要点
帮我打开微信
帮我打开浏览器搜索 WorkBuddy
帮我把这段话复制到剪贴板：明天下午三点开会
提醒我 10 分钟后喝水
帮我在桌面新建一个说明文档
```

### 上传图片和文件

WorkBuddy 支持三种方式添加附件：

- 点击输入框旁边的附件按钮选择文件。
- 直接把图片或文件拖到聊天输入框。
- 从剪贴板粘贴图片或文件。

附件会作为聊天上下文发给模型。图片识别效果取决于你选择的模型是否支持视觉输入。文本文件会提取内容，过大的文件会截断，避免一次请求过长。

### 快捷键和快捷指令

默认快捷键：

| 功能 | 默认快捷键 |
| --- | --- |
| 打开/关闭聊天 | `Ctrl+Alt+W` |
| 隐藏宠物 | `Ctrl+Alt+H` |
| 把宠物移回屏幕中央 | `Ctrl+Alt+B` |
| 快速提问 | `Ctrl+Alt+Space` |
| 快捷指令 1 | `Ctrl+Alt+1` |
| 快捷指令 2 | `Ctrl+Alt+2` |
| 快捷指令 3 | `Ctrl+Alt+3` |

修改方式：

1. 打开设置。
2. 进入 `快捷键` / `Shortcuts`。
3. 点击要修改的快捷键。
4. 按下新的组合键。
5. 保存设置。

快捷指令可以写成固定 prompt。例如：

```text
帮我把今天的工作按优先级整理成计划。
解释我接下来粘贴的内容，用简单实用的话说明。
把我当前任务拆成一个 25 分钟专注计划。
```

### 开机自启动

开启方式：

1. 打开设置。
2. 进入 `能力` / `Abilities`。
3. 打开 `开机自启动`。

这个功能写入当前 Windows 用户的启动项，不需要管理员权限。关闭开关后会移除启动项。

### 本地 Agent 和电脑操作

WorkBuddy 的本地 Agent 不是固定命令列表，而是让 AI 根据用户的一句话任务选择工具。流程大概是：

```text
用户说一句任务
  -> AI 判断是不是电脑任务
  -> AI 生成计划
  -> WorkBuddy 检查风险等级
  -> 需要时弹窗确认
  -> 调用本地工具执行
  -> 记录执行结果和日志
  -> AI 判断是否完成，必要时继续下一轮
```

内置工具：

| 插件 | 工具 | 能力 |
| --- | --- | --- |
| `filesystem` | `fs.list` | 列出目录 |
| `filesystem` | `fs.search` | 搜索文件 |
| `filesystem` | `fs.read` | 读取文本文件 |
| `filesystem` | `fs.write` | 写入文本文件 |
| `filesystem` | `fs.copy` | 复制文件 |
| `filesystem` | `fs.move` | 移动文件 |
| `filesystem` | `fs.delete_to_recycle_bin` | 删除到回收站 |
| `terminal` | `terminal.run` | 运行 PowerShell/cmd/git/npm/python 命令 |
| `browser` | `browser.open` | 用默认浏览器打开网页 |
| `browser` | `browser.screenshot` | 打开网页并提示截图流程 |
| `app` | `app.open` | 打开应用，如微信、浏览器、VS Code、记事本、WPS/Word |
| `app` | `app.open_file` | 用默认应用打开文件 |
| `screen` | `screen.screenshot` | 截屏 |
| `screen` | `screen.ocr` | OCR 预留接口 |
| `screen` | `screen.hotkey` | 发送系统快捷键 |
| `screen` | `screen.click` | 点击屏幕坐标 |
| `screen` | `screen.type_text` | 向当前焦点输入文本 |
| `clipboard` | `clipboard.read_text` | 读取剪贴板文本 |
| `clipboard` | `clipboard.write_text` | 写入剪贴板文本 |
| `clipboard` | `clipboard.paste_text` | 写入剪贴板并粘贴 |
| `office` | `office.create_word` | 创建 Word 兼容文档 |
| `confirm` | `confirm.ask` | 请求用户确认 |

可以试这些任务：

```text
帮我打开微信
帮我打开记事本
帮我打开浏览器进入 https://github.com
帮我搜索 WorkBuddy 桌面宠物
把“今天下午三点开会”复制到剪贴板
在当前输入框粘贴：这是 WorkBuddy 测试文本
截一张屏幕截图
在桌面新建一个 Word 文档，内容是今天的工作计划
帮我找下载文件夹里的 PDF
帮我整理桌面上的 txt 文件，移动前先问我
运行 git status，目录是这个项目根目录
```

### 授权模式

在设置的 `能力` / `Abilities` 页面可以调整电脑操作授权模式。

| 模式 | 行为 |
| --- | --- |
| 完全授权 | 普通和敏感任务都会自动执行。只建议在完全信任当前任务和环境时开启。 |
| 敏感操作询问 | 普通任务自动执行；移动/删除文件、运行命令、发消息、屏幕控制等敏感任务会等待确认。 |
| 拒绝敏感操作 | 普通任务可执行；敏感任务直接拦截。 |

推荐默认使用 `敏感操作询问`。

执行日志在设置的 `Agent` 页面查看。日志会记录工具名称、风险等级、参数、结果和时间。

### MCP 怎么配置

WorkBuddy 预留了 MCP Client/插件边界。设置里的 Agent 页面可以填写 MCP Server 配置，格式类似：

```json
{
  "filesystem": {
    "command": "node",
    "args": ["./plugins/filesystem/server.js"],
    "env": {}
  },
  "browser": {
    "command": "node",
    "args": ["./plugins/browser/server.js"],
    "env": {}
  }
}
```

当前内置工具已经可以完成基础本地任务。更复杂的浏览器自动化、OCR、Office 深度编辑可以后续用独立 MCP Server 或 sidecar 插件扩展。

### 安全边界

- WorkBuddy 不会绕过系统登录、验证码、权限弹窗或平台风控。
- WorkBuddy 不是微信官方 API，也不会伪造微信接口。
- 微信相关任务只通过本地桌面自动化完成，是否成功取决于用户是否已登录、窗口是否可见、当前界面是否匹配。
- WorkBuddy 不会偷取凭证、隐藏执行过程或自动上传本地隐私文件。
- 终端命令、删除文件、移动文件、发送消息、屏幕控制属于敏感操作。
- 文件整理会真实移动文件，请确认计划后再允许执行。
- 本地提醒只在 WorkBuddy 当前运行期间有效。

### 打包发布

运行：

```powershell
pnpm desktop:pack
```

打包产物位置：

```text
apps/desktop/src-tauri/target/release/bundle/
```

Windows 上通常会生成安装包或可执行分发文件，具体取决于 Tauri bundle 配置和本机环境。

### 辅助命令文件

项目根目录有三个 Windows 命令文件：

| 文件 | 用途 |
| --- | --- |
| `dev.bat` | 启动桌面开发环境 |
| `build.bat` | 打包桌面应用 |
| `update.bat` | 拉取最新代码、安装依赖并构建 |

对应 PowerShell 脚本在 `scripts/`：

| 文件 | 用途 |
| --- | --- |
| `scripts/dev.ps1` | 开发启动 |
| `scripts/build.ps1` | 构建打包 |
| `scripts/update.ps1` | Windows 更新脚本 |
| `scripts/update.sh` | Unix-like 更新脚本 |
| `scripts/clean.ps1` | 清理构建产物 |

### 常用开发命令

```powershell
pnpm install
pnpm desktop
pnpm dev
pnpm build
pnpm typecheck
pnpm desktop:pack
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

### 宠物模型怎么换

普通用户可以直接在应用里导入：

1. 打开设置。
2. 进入 `宠物` / `Pets` 页面。
3. 点击 `导入模型`。
4. 选择 `.glb`、`.vrm`、`.gltf` 或 `.zip` 文件。
5. 导入成功后，新宠物会出现在宠物列表里，并自动切换过去。

导入后的模型会复制到用户数据目录，覆盖安装新版 WorkBuddy 时会保留。单文件模型推荐使用 `.glb` 或 `.vrm`；如果模型依赖贴图、`.bin` 或多个资源文件，建议做成 zip 宠物包。

zip 宠物包结构：

```text
my-pet.zip
  pet.json
  model.glb
  preview.png
  Textures/
  LICENSE.txt
```

开发者也可以把宠物做成内置资源。默认宠物资源位置：

```text
pet-packs/
apps/desktop/public/pet-packs/
```

一个宠物包通常包含：

```text
pet.json
model.glb
preview.png
Textures/
LICENSE.txt
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
    "onClick": {
      "action": "happy",
      "bubble": ["摸摸头。", "我在！"]
    },
    "onChatOpen": "idle"
  }
}
```

添加新宠物：

1. 把宠物包放到 `apps/desktop/public/pet-packs/`。
2. 在 `apps/desktop/public/pet-packs/manifest.json` 中加入宠物路径。
3. 重新打包或重启开发版。
4. 打开设置，在宠物页面选择新宠物。

默认宠物资源来自 Kenney Cube Pets，资源许可为 CC0。详情见 `THIRD_PARTY_NOTICES.md`。

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

### 常见问题

#### 这是网页版吗？

不是。`pnpm desktop` 启动的是 Tauri 桌面版。`pnpm dev` 只是前端预览，不能代表完整桌面能力。

#### 为什么电脑操作不能用？

请确认：

- 你运行的是 `pnpm desktop`，不是只运行 `pnpm dev`。
- 设置中已开启电脑操作。
- Agent 已启用。
- 当前授权模式没有拦截敏感操作。
- 高风险任务已经确认。
- 要操作的应用已安装并且可以被系统打开。

#### 为什么模型回复失败？

请确认：

- API Key 已填写。
- Base URL 正确。
- Model ID 是服务商支持的真实模型 ID。
- 网络可以访问服务商接口。
- 账户额度没有耗尽。

#### 为什么图片识别效果不好？

图片会发给当前模型。只有支持视觉输入的模型才能真正理解图片。文本模型只能看到附件提示，不能识别图片内容。

#### 为什么宠物会隐藏到屏幕边缘？

这是侧边缩进功能。把鼠标移动到宠物露出的部分附近，它会探头出来；移开后会缩回去。

#### 为什么打包很慢？

第一次打包需要编译 Rust 和 Tauri 依赖，属于正常现象。后续构建会快一些。

## English Guide

### What Is WorkBuddy?

WorkBuddy is an open-source AI desktop pet and local desktop Agent. It runs as a real Tauri/Rust desktop app, not a web-only demo and not an Electron app.

Users bring their own API keys, configure model providers locally, chat with the pet, upload images/files, run quick commands, and approve local computer-control tasks.

### Key Features

- Real desktop app powered by Tauri + Rust.
- Transparent draggable desktop pet.
- Pet resize, manual 360-degree rotation, edge tuck, hover peek, and system tray restore.
- Speech bubbles above the pet and a compact chat input below it.
- Markdown-friendly chat display with clean short pet bubbles.
- Image/file upload, drag-and-drop, and clipboard paste.
- Custom pet name, pet size, chat color, Chinese/English UI.
- Global shortcuts and custom quick commands.
- Launch-on-startup toggle.
- Local chat history grouped by date with timestamps.
- Codex-style local Agent runtime with tool plugins, risk levels, confirmations, and audit logs.
- Custom GLB/GLTF pet packs with animation and event mappings.

### Requirements

- Windows 10/11
- Node.js 20+
- pnpm 9+
- Rust
- Windows MSVC Build Tools

If Rust is installed but `cargo` is not found, add Cargo to the current PowerShell session:

```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
```

For a permanent fix, add this path to the Windows user `Path` environment variable:

```text
%USERPROFILE%\.cargo\bin
```

### Install

```powershell
pnpm install
```

### Run The Desktop App

```powershell
pnpm desktop
```

The first run can take a while because Rust dependencies are compiled.

The frontend dev server uses:

```text
127.0.0.1:5176
```

If the port is occupied:

```powershell
netstat -ano | findstr :5176
taskkill /PID <PID> /F
```

### First-Time Setup

1. Start WorkBuddy with `pnpm desktop`.
2. Click the settings button in the pet toolbar.
3. Open the Providers page.
4. Choose ChatGPT, Claude, or DeepSeek.
5. Enter your API key.
6. Check the Base URL and Model ID.
7. Save settings.
8. Open chat and send a test message.

WorkBuddy does not include commercial API keys.

### Supported Providers

| Provider | Default name | Default Base URL | Default model ID | Notes |
| --- | --- | --- | --- | --- |
| OpenAI-compatible | ChatGPT | `https://api.openai.com/v1` | `gpt-5.5` | Uses Chat Completions-compatible API |
| Anthropic | Claude | `https://api.anthropic.com` | `claude-4.7` | Uses Anthropic Messages API |
| OpenAI-compatible | DeepSeek | `https://api.deepseek.com/v1` | `deepseek-v4-pro` | Uses DeepSeek/OpenAI-compatible API |

All model IDs and base URLs are configurable in settings.

### Pet Controls

| Action | How to use |
| --- | --- |
| Move pet | Drag the pet body |
| Rotate pet | Drag the small handle at the top-right of the pet |
| Open chat | Click the chat button or use the shortcut |
| Open settings | Click the settings button |
| Hide toolbar | Click the toolbar hide button; it also auto-hides after inactivity |
| Restore toolbar | Click the small reveal button |
| Tuck to edge | Drag the pet to a screen edge |
| Peek from edge | Hover near the tucked pet |
| Hide pet | Click the hide button |
| Restore pet | Double-click the WorkBuddy tray icon |

### Chat And Attachments

Use the chat box below the pet. AI replies appear as speech bubbles above the pet, and full history is saved locally.

You can add attachments by:

- clicking the attachment button,
- dragging files/images into the chat input,
- pasting images/files from the clipboard.

Image understanding depends on whether the selected model supports vision. Large text files may be truncated before being sent to the model.

### Shortcuts

Default shortcuts:

| Action | Shortcut |
| --- | --- |
| Toggle chat | `Ctrl+Alt+W` |
| Hide pet | `Ctrl+Alt+H` |
| Center pet | `Ctrl+Alt+B` |
| Quick ask | `Ctrl+Alt+Space` |
| Quick command 1 | `Ctrl+Alt+1` |
| Quick command 2 | `Ctrl+Alt+2` |
| Quick command 3 | `Ctrl+Alt+3` |

Change shortcuts in Settings -> Shortcuts.

### Local Agent Runtime

WorkBuddy can turn a natural-language task into local tool calls.

```text
User task
  -> Agent planner
  -> Risk check
  -> Confirmation if needed
  -> Local tool execution
  -> Audit log
  -> Review result and continue if needed
```

Built-in tools:

| Plugin | Tools |
| --- | --- |
| `filesystem` | list, search, read, write, copy, move, delete to recycle bin |
| `terminal` | run PowerShell/cmd/git/npm/python with timeout |
| `browser` | open web pages and reserved screenshot flow |
| `app` | open apps and files |
| `screen` | screenshot, OCR placeholder, hotkeys, coordinate click, type text |
| `clipboard` | read, write, paste text |
| `office` | create Word-compatible documents |
| `confirm` | request confirmation |

Example tasks:

```text
Open WeChat
Open Notepad
Open https://github.com in the browser
Copy "meeting at 3 PM" to the clipboard
Paste this text into the current input box: WorkBuddy test
Take a screenshot
Create a Word document with today's work plan
Find PDFs in my Downloads folder
Run git status in this project folder
```

### Authorization Modes

| Mode | Behavior |
| --- | --- |
| Full access | Normal and sensitive tasks run automatically. Use only in trusted environments. |
| Ask for sensitive actions | Normal tasks run automatically; sensitive tasks wait for approval. |
| Deny sensitive actions | Normal tasks run; sensitive tasks are blocked. |

The recommended default is `Ask for sensitive actions`.

Audit logs are available in the Agent settings page.

### Safety Boundaries

- WorkBuddy does not bypass login, verification, permission prompts, or platform controls.
- WorkBuddy is not an official WeChat API integration.
- WeChat tasks rely on visible local desktop automation.
- WorkBuddy does not steal credentials, hide execution, or upload private local files by itself.
- Shell commands, file deletion/move, message sending, and screen control are sensitive operations.
- File organization changes real files, so review the plan before approval.
- Local reminders only work while WorkBuddy is running.

### Package

```powershell
pnpm desktop:pack
```

Bundle output:

```text
apps/desktop/src-tauri/target/release/bundle/
```

### Helper Scripts

| File | Purpose |
| --- | --- |
| `dev.bat` | Start desktop development |
| `build.bat` | Package the desktop app |
| `update.bat` | Pull updates, install dependencies, and build |
| `scripts/dev.ps1` | PowerShell development script |
| `scripts/build.ps1` | PowerShell build script |
| `scripts/update.ps1` | PowerShell update script |
| `scripts/update.sh` | Unix-like update script |
| `scripts/clean.ps1` | Clean build artifacts |

### Pet Packs

Default pet packs live in:

```text
pet-packs/
apps/desktop/public/pet-packs/
```

A pack usually contains:

```text
pet.json
model.glb
preview.png
Textures/
LICENSE.txt
```

Add a new pet folder to `apps/desktop/public/pet-packs/`, then register it in:

```text
apps/desktop/public/pet-packs/manifest.json
```

Restart WorkBuddy and select the pet in settings.

End users can also import pets without editing the repository:

1. Open Settings.
2. Go to Pets.
3. Click Import model.
4. Choose a `.glb`, `.vrm`, `.gltf`, or `.zip` file.

Imported pets are copied to the WorkBuddy app data directory, so they survive installer overwrite updates. Use `.glb` or `.vrm` for simple single-file models. Use a zip pet pack when the model needs textures, `.bin` files, or a custom `pet.json`.

Zip pet pack shape:

```text
my-pet.zip
  pet.json
  model.glb
  preview.png
  Textures/
  LICENSE.txt
```

### Useful Commands

```powershell
pnpm install
pnpm desktop
pnpm dev
pnpm build
pnpm typecheck
pnpm desktop:pack
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

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

### Contributing

Issues and pull requests are welcome. Good areas to improve:

- More pet packs and better animation mappings.
- More reliable desktop-control tools.
- Better OCR and browser automation through MCP/sidecar plugins.
- More detailed safety policies.
- Multi-platform packaging.
- Documentation and task examples.

Before submitting changes:

```powershell
pnpm build
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

## License

WorkBuddy is released under the MIT License. See [LICENSE](LICENSE).

Default pet assets are from Kenney Cube Pets and are licensed under CC0-1.0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
