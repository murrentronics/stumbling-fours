/**
 * cap-sync.cjs
 *
 * Temporarily swaps index.html to the Capacitor app for cap sync,
 * then ALWAYS restores it to the download page — even on error or crash.
 */

const { execSync } = require("child_process");
const fs   = require("fs");
const path = require("path");

const dist        = path.join(__dirname, "..", "dist", "client");
const appHtml     = path.join(dist, "index.capacitor.html");
const indexHtml   = path.join(dist, "index.html");
const downloadSrc = path.join(__dirname, "..", "public", "download.html");

// Restore function — always puts the download page back
function restore() {
  try {
    if (fs.existsSync(downloadSrc)) {
      fs.copyFileSync(downloadSrc, indexHtml);
      console.log("✔  Restored index.html → download page");
    }
  } catch (e) {
    console.error("✗  Failed to restore index.html:", e.message);
  }
}

process.on("exit", restore);
process.on("SIGINT",  () => process.exit(1));
process.on("SIGTERM", () => process.exit(1));
process.on("uncaughtException", (e) => { console.error(e); process.exit(1); });

// Validate
if (!fs.existsSync(appHtml)) {
  console.error("✗  dist/client/index.capacitor.html not found — run build:android first");
  process.exit(1);
}

// Swap in the Capacitor app
fs.copyFileSync(appHtml, indexHtml);
console.log("✔  Swapped in index.capacitor.html for cap sync");

// Run cap sync — restore() fires via process.on("exit") regardless of outcome
execSync("npx cap sync android", { stdio: "inherit" });
