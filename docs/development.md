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

## Computer Control

The desktop app exposes a Tauri command named `execute_computer_actions`. Frontend code passes structured actions produced by the fixed parser or by `ComputerAgent.ts`.

`execute_computer_actions` returns a result object for each attempted step. A failed step is returned as `{ ok: false, message }` and stops the current batch so the frontend can show the real failure or pass it back to the Agent supervisor.

Supported actions:

- `open_app` for whitelisted apps.
- `open_folder` for common user folders.
- `organize_folder` for moving top-level files into `WorkBuddy Organized` by file type.
- `open_url` for `http://` and `https://` URLs.
- `set_clipboard` for copying text.
- `paste_text` for clipboard-backed text input.
- `create_word_document` for creating a Word-compatible document and opening it.
- `shell_command` for PowerShell commands. Treat this as sensitive.
- `hotkey`, `key`, and `wait` for small UI automation steps.

Keep user confirmation in the frontend before invoking these actions. Message sending and other high-impact actions should keep a second confirmation step.

Computer task plans carry a `sensitivity` field:

- `normal`: can run automatically in the default authorization mode.
- `sensitive`: requires user approval in the default mode, runs automatically in full-access mode, and is blocked in deny-sensitive mode.

Current sensitive tasks include WeChat sending flows, folder organization, and shell commands.

`ComputerAgent.ts` is the model-planned path. It asks the active provider for strict JSON, validates actions, upgrades sensitive plans when needed, and falls back to the fixed parser when planning is unavailable.

Agent tasks run through an operation-review loop:

1. Plan the first action batch from the user request.
2. Execute the approved batch with local Rust tools.
3. Feed action results back to the active model.
4. Mark complete only when the review says the goal is actually complete.
5. Otherwise continue with another approved batch, stop for user help, or report failure.

The frontend currently caps Agent tasks at three execution rounds. Sensitive follow-up actions still respect the configured authorization mode.

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
