import os from 'os';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO = 'AIResearchFactory/ai-researcher';
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = `v${pkg.version}`;

const platform = os.platform();
const arch = os.arch();

const getBinaryName = () => {
  if (platform === 'win32') return 'productos-server.exe';
  return 'productos-server';
};

const getAssetSuffix = () => {
  if (platform === 'darwin') return arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
  if (platform === 'win32') return 'x86_64-pc-windows-msvc';
  if (platform === 'linux') return arch === 'arm64' ? 'aarch64-unknown-linux-gnu' : 'x86_64-unknown-linux-gnu';
  return null;
};

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'productos-installer' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download: ${res.statusCode} ${res.statusMessage}`));
      }
      
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  const suffix = getAssetSuffix();
  if (!suffix) {
    console.warn(`[productos] Platform ${platform}-${arch} not officially supported for prebuilt binaries. Will attempt to build from source on first run.`);
    return;
  }

  const assetName = `productos-server-${suffix}${platform === 'win32' ? '.exe' : ''}`;
  const downloadUrl = `https://github.com/${REPO}/releases/download/${VERSION}/${assetName}`;
  const targetDir = path.join(ROOT, 'src-tauri', 'target', 'release');
  const targetPath = path.join(targetDir, getBinaryName());

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    console.log(`[productos] Downloading companion server for ${platform}-${arch}...`);
    console.log(`[productos] URL: ${downloadUrl}`);
    
    await download(downloadUrl, targetPath);
    
    if (platform !== 'win32') {
      fs.chmodSync(targetPath, 0o755);
    }
    
    console.log(`[productos] Successfully installed companion server.`);
  } catch (err) {
    console.warn(`[productos] Failed to download prebuilt binary: ${err.message}`);
    console.warn(`[productos] That's okay! It will be compiled from source on first run if you have Rust installed.`);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  }
}

main();
