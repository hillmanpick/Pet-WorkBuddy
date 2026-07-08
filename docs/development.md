# Development

## Install

```powershell
pnpm install
```

## Desktop App

```powershell
pnpm desktop
```

## Package Windows Desktop App

```powershell
pnpm desktop:pack
```

The default package target is Tauri. Generated installers are written to `apps/desktop/src-tauri/target/release/bundle/`.

## Agent Runtime And Tool Plugins

The desktop app exposes a Tauri command named `execute_computer_actions`. Frontend code now treats computer abilities as Agent tools. `ComputerAgent.ts` asks the active model for `toolCalls`, validates them against `agent/tools/ToolRegistry.ts`, then executes them through the local Tauri/Rust backend.

`execute_computer_actions` returns a result object for each attempted step. A failed step is returned as `{ ok: false, message }` and stops the current batch so the frontend can show the real failure or pass it back to the Agent supervisor.

Tool metadata lives in `apps/desktop/src/agent/tools/`:

- `ToolTypes.ts` defines plugin manifests, tool definitions, risk levels, permissions, tool calls, and execution results.
- `ToolRegistry.ts` contains the built-in plugin manifests and maps tool calls to Tauri actions.
- `PermissionEngine.ts` maps risk levels to normal/sensitive task authorization.
- `AuditLog.ts` stores local tool execution logs in browser local storage.
- `mcp/McpClient.ts` is the adapter boundary for future external MCP servers.

Built-in plugins:

- `filesystem`: `fs.list`, `fs.search`, `fs.read`, `fs.write`, `fs.copy`, `fs.move`, `fs.delete_to_recycle_bin`.
- `terminal`: `terminal.run` for PowerShell, cmd, git, npm, and python with timeout.
- `browser`: `browser.open`, `browser.screenshot`.
- `app`: `app.open`, `app.open_file`.
- `screen`: `screen.screenshot`, `screen.ocr`, `screen.click`, `screen.hotkey`, `screen.type_text`.
- `clipboard`: `clipboard.read_text`, `clipboard.write_text`, `clipboard.paste_text`.
- `office`: `office.create_word`.
- `confirm`: `confirm.ask`.

The Rust backend currently supports these Tauri action variants:

- `open_app` for whitelisted apps.
- `open_file` for opening a path with the default app.
- `open_folder` for common user folders.
- `organize_folder` for moving top-level files into `WorkBuddy Organized` by file type.
- `open_url` for `http://` and `https://` URLs.
- `set_clipboard` for copying text.
- `clipboard_read_text` for reading clipboard text.
- `paste_text` for clipboard-backed text input.
- `create_word_document` for creating a Word-compatible document and opening it.
- `shell_command` for PowerShell commands. Treat this as sensitive.
- `terminal_command` for whitelisted command runners with timeout.
- `fs_list`, `fs_search`, `fs_read`, `fs_write`, `fs_copy`, `fs_move`, and `fs_delete_to_recycle_bin`.
- `screen_screenshot`, `screen_click`; `screen_ocr` is a declared extension point and currently returns a not-installed message.
- `browser_screenshot` opens a page and launches the screenshot flow.
- `hotkey`, `key`, and `wait` for small UI automation steps.

Keep user confirmation in the frontend before invoking these actions. Message sending and other high-impact actions should keep a second confirmation step.

Computer task plans carry a `sensitivity` field:

- `normal`: can run automatically in the default authorization mode.
- `sensitive`: requires user approval in the default mode, runs automatically in full-access mode, and is blocked in deny-sensitive mode.

Current sensitive tasks include WeChat sending flows, folder organization, and shell commands.

`ComputerAgent.ts` is the model-planned path. It asks the active provider for strict JSON, validates tool calls, upgrades sensitive plans when needed, and falls back to the fixed parser when planning is unavailable.

Agent tasks run through an operation-review loop:

1. Plan the first tool-call batch from the user request.
2. Execute the approved batch with local Rust tools.
3. Feed tool results back to the active model.
4. Mark complete only when the review says the goal is actually complete.
5. Otherwise continue with another approved batch, stop for user help, or report failure.

The frontend caps Agent tasks with the Settings -> Agent -> Max review rounds value. Sensitive follow-up actions still respect the configured authorization mode.

The frontend rule parser currently recognizes simple tasks such as:

- Open apps: WeChat, File Explorer, Notepad, Calculator, Paint, Windows Settings, screenshot tool.
- Open folders: Desktop, Downloads, Documents, Pictures, Music, Videos, Home.
- Open URLs and web searches.
- Copy text, paste text, and create a Notepad note.
- Folder organization for common user folders.
- Local reminders/countdowns while the app is running.
- Prepare WeChat messages with final send confirmation.

Launch-on-startup is managed through the Windows current-user Run registry key:

```text
HKCU\Software\Microsoft\Windows\CurrentVersion\Run
```

The related Tauri commands are `get_launch_on_startup` and `set_launch_on_startup`.

## Web Preview

```powershell
pnpm dev
```

## Build

```powershell
pnpm build
```

For Tauri desktop installers:

```powershell
pnpm desktop:pack
```

Direct Tauri commands are also available:

```powershell
pnpm tauri:dev
pnpm tauri:build
```

## Repository Layout

```text
apps/desktop      Tauri + React desktop app
packages          Shared package boundaries
pet-packs         Redistributable default pet packs
scripts           User-friendly commands
docs              Project documentation
```
