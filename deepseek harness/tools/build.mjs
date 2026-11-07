#!/usr/bin/env node
/**
 * 构建单文件成品：dev.html + src/** → index.html。
 * 用法（必须在愿望目录内）：node tools/build.mjs
 *
 * 规则：零外部请求；CSS/JS/数据全部内联；产物不手改。
 */
import fs from 'node:fs';
import path from 'node:path'

const ROOT = process.cwd()
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/^\uFEFF/, '')

// 1) 数据源同步（data/*.json → src/js/data.generated.js）
const syncPath = path.join(ROOT, 'tools', 'sync-data.mjs')
if (fs.existsSync(syncPath)) {
  const { execFileSync } = await import('node:child_process')
  execFileSync(process.execPath, [syncPath], { cwd: ROOT, stdio: 'inherit' })
}

let html = read('dev.html')
const assets = []

html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g, (m, href) => {
  const file = path.join(ROOT, href)
  if (!fs.existsSync(file)) throw new Error('missing css: ' + href)
  const css = read(href)
  assets.push({ type: 'css', href, bytes: Buffer.byteLength(css) })
  return `<style>\n/* ===== ${href} ===== */\n${css}\n</style>`
})

html = html.replace(/<script\s+src="([^"]+)"><\/script>/g, (m, src) => {
  const file = path.join(ROOT, src)
  if (!fs.existsSync(file)) throw new Error('missing js: ' + src)
  const js = read(src).replace(/<\/script>/gi, '<\\/script>')
  assets.push({ type: 'js', src, bytes: Buffer.byteLength(js) })
  return `<script>\n/* ===== ${src} ===== */\n${js}\n</script>`
})

const remoteRefs = html.match(/(?:src|href)="(?:https?:)?\/\/[^"]+"/g) || []
if (remoteRefs.length > 0) {
  console.error('external references found:')
  remoteRefs.forEach(r => console.error('  ' + r))
  process.exit(1)
}

const bytes = Buffer.byteLength(html, 'utf8')
const stamp = `<!--
  DeepSeek Harness · 源码架构可视化实验室
  单文件构建产物。源码：dev.html + src/ + data/*.json。不要手改这个文件。
  分析对象：DeepSeek Harness 0.2.2-rc.1（本地源码 commit fcc0ad4）
  运行时零外部请求；代码片段来自本地源码，数据由 tools/extract-source-facts.mjs 抽取。
  Built ${new Date().toISOString()} · ${(bytes / 1024 / 1024).toFixed(2)} MB
-->`
html = html.replace('<!doctype html>', '<!doctype html>\n' + stamp)

fs.writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8')

console.log(`built index.html — ${(bytes / 1024 / 1024).toFixed(2)} MB, ${html.split('\n').length} lines`)
console.log(`inlined ${assets.length} assets (${assets.filter(a => a.type === 'js').length} js, ${assets.filter(a => a.type === 'css').length} css)`)
console.log('external references left: ' + remoteRefs.length)

// 产物自检：不应再有外链 css/js
const leftover = html.match(/<link\s+rel="stylesheet"|<script\s+src=/g) || []
if (leftover.length > 0) throw new Error(`build left ${leftover.length} external asset reference(s)`)
