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

The generated package is written to `apps/desktop/release/`.

## Web Preview

```powershell
pnpm dev
```

## Tauri Preview

Install Rust first, then run:

```powershell
pnpm tauri:dev
```

## Build

```powershell
pnpm build
```

For desktop installers:

```powershell
pnpm desktop:pack
```

Tauri builds are optional and require Rust plus MSVC Build Tools:

```powershell
pnpm tauri:build
```

## Repository Layout

```text
apps/desktop      Electron/Tauri + React desktop app
packages          Shared package boundaries
pet-packs         Redistributable default pet packs
scripts           User-friendly commands
docs              Project documentation
```
