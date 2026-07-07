#!/usr/bin/env sh
set -eu
git pull --ff-only
pnpm install
pnpm build

