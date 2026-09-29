/**
 * 把 web/index.html（网页版）同步为桌面版页面。
 *
 * 桌面版需要完全离线运行，因此把 importmap 里的 CDN 地址
 * 改写为随包分发的本地 ./three.module.js。
 *
 * 用法：npm run sync   （在 desktop/ 目录下执行）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const src = path.join(root, 'web', 'index.html');
const dst = path.resolve(here, '..', 'index.html');

const CDN = 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
const LOCAL = './three.module.js';

if (!fs.existsSync(src)) {
  console.error('[sync] 找不到源文件：' + src);
  process.exit(1);
}

let html = fs.readFileSync(src, 'utf8');

if (!html.includes(CDN)) {
  if (html.includes(LOCAL)) {
    console.log('[sync] 源文件已指向本地 three.js，直接复制。');
  } else {
    console.error('[sync] 源文件中找不到 three.js 的 importmap 地址，请检查 web/index.html。');
    process.exit(1);
  }
}

html = html.replaceAll(CDN, LOCAL);
fs.writeFileSync(dst, html, 'utf8');

const kb = (fs.statSync(dst).size / 1024).toFixed(1);
console.log('[sync] 已生成 desktop/index.html（' + kb + ' KB，three.js 指向本地）');

if (!fs.existsSync(path.resolve(here, '..', 'three.module.js'))) {
  console.warn('[sync] 警告：desktop/three.module.js 不存在，桌面版将无法离线运行。');
}
