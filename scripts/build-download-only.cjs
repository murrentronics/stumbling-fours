const fs   = require('fs');
const path = require('path');

const distDir     = path.join(__dirname, '..', 'dist', 'client');
const downloadSrc = path.join(__dirname, '..', 'public', 'download.html');
const assetsSrc   = path.join(__dirname, '..', 'src', 'assets');
const assetsDest  = path.join(distDir, 'assets');

// Ensure dist/client exists
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

// Copy download.html → index.html
if (!fs.existsSync(downloadSrc)) {
  console.error('✗  public/download.html not found');
  process.exit(1);
}
fs.copyFileSync(downloadSrc, path.join(distDir, 'index.html'));
console.log('✔  Copied download.html → dist/client/index.html');

// Copy src/assets (logo etc) → dist/client/assets
if (fs.existsSync(assetsSrc)) {
  if (!fs.existsSync(assetsDest)) fs.mkdirSync(assetsDest, { recursive: true });
  fs.cpSync(assetsSrc, assetsDest, { recursive: true });
  console.log('✔  Copied src/assets → dist/client/assets');
}

// _redirects for Cloudflare Pages — everything hits the download page
fs.writeFileSync(path.join(distDir, '_redirects'), `/* /index.html 200\n`);

console.log('✔  Build complete — dist/client ready for Cloudflare Pages');
