/**
 * 3D 贪吃蛇 · 桌面版主进程
 * 内置一个仅监听 127.0.0.1 的本地静态服务来托管游戏页面，
 * 规避 file:// 协议对 ES Module 的限制，完全离线运行。
 */
const { app, BrowserWindow, Menu, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

/* ---------- GPU 崩溃自动降级 ----------
 * 硬件加速优先；若 GPU 进程反复崩溃（虚拟机/远程桌面/驱动异常），
 * 写入标记并重启自身，改用软件渲染（SwiftShader，本游戏足够流畅）。
 */
let useSoftGPU = false;
let gpuCrashes = 0;
try {
  useSoftGPU = fs.existsSync(path.join(app.getPath('userData'), 'softgpu.flag'));
} catch (e) { /* 忽略 */ }
if (useSoftGPU) app.disableHardwareAcceleration();
app.commandLine.appendSwitch('ignore-gpu-blocklist');

app.on('child-process-gone', (e, details) => {
  if (details && details.type === 'GPU' && details.reason === 'crashed') {
    gpuCrashes++;
    if (gpuCrashes >= 3 && !useSoftGPU) {
      try { fs.writeFileSync(path.join(app.getPath('userData'), 'softgpu.flag'), '1'); } catch (err) { /* 忽略 */ }
      app.relaunch();
      app.exit(0);
    }
  }
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function startServer(cb) {
  const server = http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch (e) {
      res.writeHead(400); res.end(); return;
    }
    if (urlPath === '/') urlPath = '/index.html';
    // 防目录穿越
    const safe = path.normalize(urlPath).replace(/^([.][.][/\\])+/, '');
    const file = path.join(ROOT, safe);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(data);
    });
  });
  server.listen(0, '127.0.0.1', () => cb(server));
}

function createWindow(server) {
  const port = server.address().port;
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 860,
    minHeight: 600,
    title: '3D 贪吃蛇',
    backgroundColor: '#05080f',
    autoHideMenuBar: true,
    icon: path.join(ROOT, 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null); // 去掉默认菜单栏

  // 窗口标题保持固定（页面 title 变化时跟随页面，这里锁成游戏名）
  win.on('page-title-updated', (e) => { e.preventDefault(); });

  // 外链用系统浏览器打开（游戏本身无外链，双保险）
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL('http://127.0.0.1:' + port + '/');

  // Esc 退出全屏（F11 由 Chromium 默认处理）
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && win.isFullScreen()) {
      win.setFullScreen(false);
    }
  });
}

app.whenReady().then(() => {
  startServer(createWindow);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) startServer(createWindow);
  });
});

app.on('window-all-closed', () => app.quit());
