# WorkBuddy

WorkBuddy is an open-source AI desktop pet. It gives users a small animated companion on the desktop, a configurable chat panel, global shortcuts, quick commands, and local-only API key management.

## Features

- Transparent, always-on-top desktop pet window powered by Tauri by default.
- Optional Electron target is kept as a fallback for machines without a Rust toolchain.
- React + TypeScript settings and chat interface.
- Three.js GLB pet rendering with animation clip mapping.
- Default CC0 pet packs from Kenney Cube Pets.
- Configurable ChatGPT, Claude, and DeepSeek providers.
- Editable model IDs, base URLs, temperature, max token limits, and system prompts.
- User-owned API keys stored locally. Tauri uses the OS keychain; Electron uses `safeStorage` when available.
- Custom global shortcuts for chat, hiding the pet, centering the pet, and quick prompts.
- Local quick commands with optional shortcuts.
- Update, dev, build, and clean command files for Windows users.

## Quick Start

Install dependencies:

```powershell
pnpm install
```

Run the desktop app:

```powershell
pnpm desktop
```

Package the Windows desktop app:

```powershell
pnpm desktop:pack
```

Optional web UI preview:

```powershell
pnpm dev
```

The default desktop target uses Tauri and requires Rust plus MSVC Build Tools. Electron is available as a fallback with `pnpm electron:desktop` and `pnpm electron:pack`.

## User Commands

Windows users can double-click these files:

- `dev.bat` starts the desktop app.
- `build.bat` packages the Windows desktop app.
- `update.bat` pulls the latest project files, installs dependencies, and rebuilds.

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
