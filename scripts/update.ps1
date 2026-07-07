$ErrorActionPreference = "Stop"
git pull --ff-only
pnpm install
pnpm build

