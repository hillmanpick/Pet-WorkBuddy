# WorkBuddy

WorkBuddy is an open-source AI desktop pet. It gives users a small animated companion on the desktop, a configurable chat panel, global shortcuts, quick commands, and local-only API key management.

## Features

- Transparent, always-on-top desktop pet window powered by Tauri.
- React + TypeScript settings and chat interface.
- Three.js GLB pet rendering with animation clip mapping.
- Default CC0 pet packs from Kenney Cube Pets.
- Configurable ChatGPT, Claude, and DeepSeek providers.
- Editable model IDs, base URLs, temperature, max token limits, and system prompts.
- User-owned API keys stored through the OS keychain when running in Tauri.
- Custom global shortcuts for chat, hiding the pet, centering the pet, and quick prompts.
- Local quick commands with optional shortcuts.
- Update, dev, build, and clean command files for Windows users.

## Quick Start

Install dependencies:

```powershell
pnpm install
```

Run the web UI preview:

```powershell
pnpm dev
```

Run the desktop app:

```powershell
pnpm tauri:dev
```

Tauri desktop builds require the Rust toolchain. Install Rust from https://www.rust-lang.org/tools/install before running Tauri commands.

## User Commands

Windows users can double-click these files:

- `dev.bat`
- `build.bat`
- `update.bat`

PowerShell equivalents live in `scripts/`.

## Pet Packs

Default pet packs are in:

```text
pet-packs/
apps/desktop/public/pet-packs/
```

Each pack contains:

```text
pet.json
model.glb
preview.png
Textures/
LICENSE-KENNEY.txt
```

The current pet pack schema supports GLB/GLTF models and animation clip mapping.

## Model Providers

WorkBuddy ships with provider adapters for:

- ChatGPT / OpenAI-compatible APIs
- Claude / Anthropic Messages API
- DeepSeek / OpenAI-compatible APIs

Model IDs are never hardcoded. Users can edit provider settings from the app.

## License

WorkBuddy is MIT licensed.

Default pet assets are CC0. See `THIRD_PARTY_NOTICES.md`.
