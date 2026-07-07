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

## Web Preview

```powershell
pnpm dev
```

## Electron Fallback

Electron remains available for machines without Rust:

```powershell
pnpm electron:desktop
pnpm electron:pack
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
apps/desktop      Electron/Tauri + React desktop app
packages          Shared package boundaries
pet-packs         Redistributable default pet packs
scripts           User-friendly commands
docs              Project documentation
```
