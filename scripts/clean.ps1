$ErrorActionPreference = "Stop"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules, dist
Get-ChildItem -Recurse -Directory -Filter dist | Remove-Item -Recurse -Force
Get-ChildItem -Recurse -Directory -Filter target | Remove-Item -Recurse -Force

