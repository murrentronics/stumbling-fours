/**
 * bump-version.cjs
 *
 * Auto-increments the app version every time you run `npm run cap:sync`.
 *
 * Updates:
 *   1. android/app/build.gradle  — versionCode (int) and versionName (string)
 *   2. .env                      — VITE_APP_VERSION (read by update checker at runtime)
 *
 * Strategy: bump the PATCH number (1.0.0 → 1.0.1 → 1.0.2 …)
 * For MINOR/MAJOR bumps edit .env manually once, then cap:sync handles the rest.
 */

const fs   = require("fs");
const path = require("path");

const ROOT        = path.resolve(__dirname, "..");
const ENV_FILE    = path.join(ROOT, ".env");
const GRADLE_FILE = path.join(ROOT, "android", "app", "build.gradle");

// ── 1. Read current version from .env ────────────────────────────────────────
const envContent = fs.readFileSync(ENV_FILE, "utf8");
const versionMatch = envContent.match(/^VITE_APP_VERSION="([^"]+)"/m);

if (!versionMatch) {
  console.error("✗  VITE_APP_VERSION not found in .env");
  console.error('   Add this line to .env:  VITE_APP_VERSION="1.0.0"');
  process.exit(1);
}

const current = versionMatch[1];
const parts   = current.split(".").map(Number);
parts[2] = (parts[2] ?? 0) + 1;          // bump patch
const newVersion = parts.join(".");

// ── 2. Update .env ────────────────────────────────────────────────────────────
const newEnv = envContent.replace(
  /^VITE_APP_VERSION="[^"]+"/m,
  `VITE_APP_VERSION="${newVersion}"`
);
fs.writeFileSync(ENV_FILE, newEnv, "utf8");
console.log(`✔  .env         → VITE_APP_VERSION="${newVersion}"`);

// ── 3. Update android/app/build.gradle ────────────────────────────────────────
if (fs.existsSync(GRADLE_FILE)) {
  let gradle = fs.readFileSync(GRADLE_FILE, "utf8");

  // bump versionCode by 1
  gradle = gradle.replace(/versionCode\s+(\d+)/, (_, n) => `versionCode ${parseInt(n) + 1}`);
  // set versionName to the new semver
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${newVersion}"`);

  fs.writeFileSync(GRADLE_FILE, gradle, "utf8");
  console.log(`✔  build.gradle → versionName "${newVersion}"`);
} else {
  console.log("⚠  android/app/build.gradle not found — skipping (run npx cap add android first)");
}

console.log(`\n🃏  GitHub Release tag to use: v${newVersion}`);
