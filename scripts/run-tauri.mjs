import { existsSync } from "node:fs";
import { join, delimiter } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const mode = process.argv[2] ?? "dev";
const scriptByMode = {
  dev: "tauri:dev",
  build: "tauri:build",
};

const script = scriptByMode[mode];
if (!script) {
  console.error(`Unknown Tauri mode "${mode}". Use "dev" or "build".`);
  process.exit(1);
}

const env = { ...process.env };
const candidates = [
  env.CARGO_HOME ? join(env.CARGO_HOME, "bin") : null,
  env.USERPROFILE ? join(env.USERPROFILE, ".cargo", "bin") : null,
  env.HOME ? join(env.HOME, ".cargo", "bin") : null,
].filter(Boolean);

const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
const pathParts = (env[pathKey] ?? "").split(delimiter).filter(Boolean);

for (const cargoBin of candidates) {
  if (existsSync(join(cargoBin, process.platform === "win32" ? "cargo.exe" : "cargo"))) {
    if (!pathParts.some((part) => part.toLowerCase() === cargoBin.toLowerCase())) {
      pathParts.unshift(cargoBin);
    }
    break;
  }
}

env[pathKey] = pathParts.join(delimiter);

const cargoProbe = spawnSync(
  process.platform === "win32" ? "cargo.exe" : "cargo",
  ["--version"],
  { env, encoding: "utf8" },
);

if (cargoProbe.status !== 0) {
  console.error("Rust Cargo was not found. Install Rust or add .cargo/bin to PATH.");
  console.error("Windows default path: %USERPROFILE%\\.cargo\\bin");
  process.exit(cargoProbe.status ?? 1);
}

console.log(`Using ${cargoProbe.stdout.trim()}`);

const pnpmArgs = ["--filter", "@workbuddy/desktop", script];
const result = spawnSync("pnpm", pnpmArgs, {
  stdio: "inherit",
  env,
  // Windows command shims such as pnpm.cmd cannot be spawned directly by
  // recent Node releases and otherwise fail with an unhelpful EINVAL.
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`Failed to start pnpm: ${result.error.message}`);
}

process.exit(result.status ?? 1);
