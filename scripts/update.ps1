$ErrorActionPreference = "Stop"
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path $cargoBin) {
  $env:Path = "$cargoBin;$env:Path"
}
git pull --ff-only
pnpm install
pnpm build
