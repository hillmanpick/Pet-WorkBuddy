# Development

## Install

```powershell
pnpm install
```

## Web Preview

```powershell
pnpm dev
```

## Desktop Preview

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
pnpm tauri:build
```

## Repository Layout

```text
apps/desktop      Tauri + React app
packages          Shared package boundaries
pet-packs         Redistributable default pet packs
scripts           User-friendly commands
docs              Project documentation
```

