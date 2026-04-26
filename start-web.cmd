@echo off
set PATH=C:\Program Files\nodejs;C:\Users\Marco\AppData\Roaming\npm;%PATH%
cd /d "%~dp0"
pnpm --filter @pokequery/web dev
