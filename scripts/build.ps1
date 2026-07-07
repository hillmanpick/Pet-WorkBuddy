$ErrorActionPreference = "Stop"
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path $cargoBin) {
  $env:Path = "$cargoBin;$env:Path"
}
pnpm install
pnpm desktop:pack
