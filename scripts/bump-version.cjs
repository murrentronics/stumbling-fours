/**
 * bump-version.cjs
 *
 * Auto-increments the app version every time you run `npm run cap:sync`.
 *
 * Updates:
 *   1. .env                      — VITE_APP_VERSION (baked into web bundle at build time)
 *   2. android/app/build.gradle  — versionCode (int) and versionName (string)
 *   3. public/version.json       — read by the update checker at runtime
 *
 * Strategy: bump the PATCH number (1.0.48 → 1.0.49 → 1.0.50 …)
 * For MINOR/MAJOR bumps, edit .env manually once, then cap:sync handles the rest.
 */

const fs   = require("fs");
const path = require("path");

const ROOT         = path.resolve(__dirname, "..");
const ENV_FILE     = path.join(ROOT, ".env");
const GRADLE_FILE  = path.join(ROOT, "android", "app", "build.gradle");
const VERSION_JSON = path.join(ROOT, "public", "version.json");

// ── 1. Read current version from .env ─────────────────────────────────────────
const envContent   = fs.readFileSync(ENV_FILE, "utf8");
const versionMatch = envContent.match(/^VITE_APP_VERSION="([^"]+)"/m);

if (!versionMatch) {
  console.error('✗  VITE_APP_VERSION not found in .env');
  console.error('   Add this line to .env:  VITE_APP_VERSION="1.0.0"');
  process.exit(1);
}

const current = versionMatch[1];
const parts   = current.split(".").map(Number);
parts[2]      = (parts[2] ?? 0) + 1;   // bump patch
const newVersion = parts.join(".");

// ── 2. Update .env ─────────────────────────────────────────────────────────────
const newEnv = envContent.replace(
  /^VITE_APP_VERSION="[^"]+"/m,
  `VITE_APP_VERSION="${newVersion}"`
);
fs.writeFileSync(ENV_FILE, newEnv, "utf8");
console.log(`✔  .env          → VITE_APP_VERSION="${newVersion}"`);

// ── 3. Update android/app/build.gradle ────────────────────────────────────────
if (fs.existsSync(GRADLE_FILE)) {
  let gradle = fs.readFileSync(GRADLE_FILE, "utf8");

  // bump versionCode by 1 — matches "versionCode 48" style
  gradle = gradle.replace(/(\bversionCode\s+)(\d+)/, (_, prefix, n) =>
    `${prefix}${parseInt(n, 10) + 1}`
  );
  // set versionName to the new semver — matches versionName "1.0.48" style
  gradle = gradle.replace(/(\bversionName\s+)"[^"]+"/, `$1"${newVersion}"`);

  fs.writeFileSync(GRADLE_FILE, gradle, "utf8");
  console.log(`✔  build.gradle  → versionCode +1, versionName "${newVersion}"`);
} else {
  console.warn("⚠  android/app/build.gradle not found — skipping");
}

// ── 4. Write public/version.json ──────────────────────────────────────────────
// This file is served at /version.json and read by useAppUpdate at runtime
// so the in-app update checker always knows what the current version is.
const versionJson = JSON.stringify({ version: newVersion }, null, 2) + "\n";
fs.writeFileSync(VERSION_JSON, versionJson, "utf8");
console.log(`✔  version.json  → { "version": "${newVersion}" }`);

console.log(`\n🃏  Next GitHub Release tag: v${newVersion}`);
