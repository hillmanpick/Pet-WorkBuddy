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

The desktop app exposes a Tauri command named `execute_computer_actions`. Frontend code must pass structured actions only; the Rust side does not execute arbitrary shell commands.

Supported actions:

- `open_app` for whitelisted apps.
- `open_folder` for common user folders.
- `open_url` for `http://` and `https://` URLs.
- `set_clipboard` for copying text.
- `paste_text` for clipboard-backed text input.
- `hotkey`, `key`, and `wait` for small UI automation steps.

Keep user confirmation in the frontend before invoking these actions. Message sending and other high-impact actions should keep a second confirmation step.

The frontend rule parser currently recognizes simple tasks such as:

- Open apps: WeChat, File Explorer, Notepad, Calculator, Paint, Windows Settings, screenshot tool.
- Open folders: Desktop, Downloads, Documents, Pictures, Music, Videos, Home.
- Open URLs and web searches.
- Copy text, paste text, and create a Notepad note.
- Local reminders/countdowns while the app is running.
- Prepare WeChat messages with final send confirmation.

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
