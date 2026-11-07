#!/usr/bin/env node
/**
 * 从本地 DeepSeek Harness 源码仓库抽取“事实型”数据，写入 data/generated.json。
 *
 * 设计原则：只做机械抽取（目录扫描、生成文档表格解析、类型键名匹配），
 * 不做推断。所有抽取结果都带来源文件与行号，供页面上的源码面板引用。
 *
 * 用法（在愿望目录内）：
 *   node tools/extract-source-facts.mjs
 *   node tools/extract-source-facts.mjs --src "E:\path\to\deepseek-harness"
 *
 * 环境变量 DSH_SRC 可替代 --src。脚本不修改源码仓库，只读。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = process.cwd()
const DEFAULT_SRC = 'E:\\Codeing\\WebStorm 2025.3.3\\work\\deepseek-harness'
const srcArg = process.argv.indexOf('--src')
const SRC = path.resolve(srcArg > -1 ? process.argv[srcArg + 1] : (process.env.DSH_SRC || DEFAULT_SRC))

const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/^\uFEFF/, '')
const exists = (rel) => fs.existsSync(path.join(SRC, rel))
const sha1 = (text) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 12)

/** 递归收集文件（跳过 node_modules/.git/dist）。 */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.idea') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function rel(full) {
  return path.relative(SRC, full).split(path.sep).join('/')
}

// ---------------------------------------------------------------- packages
const packages = []
const packageRoots = []
for (const group of fs.readdirSync(path.join(SRC, 'packages'), { withFileTypes: true })) {
  if (!group.isDirectory()) continue
  const groupDir = path.join(SRC, 'packages', group.name)
  for (const dir of fs.readdirSync(groupDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    const manifest = path.join(groupDir, dir.name, 'package.json')
    if (fs.existsSync(manifest)) packageRoots.push({ group: group.name, dir: `packages/${group.name}/${dir.name}`, manifest })
  }
}
for (const app of ['cli', 'desktop', 'desktop-host', 'web', 'plugin-market-generator']) {
  const manifest = path.join(SRC, 'apps', app, 'package.json')
  if (fs.existsSync(manifest)) packageRoots.push({ group: 'apps', dir: `apps/${app}`, manifest })
}
for (const { group, dir, manifest } of packageRoots) {
  let json
  try { json = JSON.parse(fs.readFileSync(manifest, 'utf8')) } catch { continue }
  const readme = path.join(path.dirname(manifest), 'README.zh.md')
  let summary = json.description || ''
  if (!summary && fs.existsSync(readme)) {
    const head = fs.readFileSync(readme, 'utf8').slice(0, 800)
    const m = head.match(/^description:\s*"?(.+?)"?\s*$/m)
    if (m) summary = m[1]
  }
  packages.push({
    name: json.name,
    short: String(json.name || '').replace('@deepseek-ai/dsh-', '').replace('@deepseek-ai/', ''),
    group,
    dir,
    version: json.version || '',
    description: summary || '',
  })
}
packages.sort((a, b) => a.dir.localeCompare(b.dir))

// ---------------------------------------------------------------- ts stats
const tsFiles = []
for (const dir of ['packages', 'apps', 'vendor']) {
  if (!fs.existsSync(path.join(SRC, dir))) continue
  for (const full of walk(path.join(SRC, dir))) {
    if (!/\.(ts|tsx|mts|cts)$/.test(full)) continue
    if (full.includes(`${path.sep}tests${path.sep}`)) continue
    tsFiles.push(full)
  }
}
let loc = 0
for (const full of tsFiles) {
  const text = fs.readFileSync(full, 'utf8')
  loc += text.split('\n').length
}

// ---------------------------------------------------------------- events (generated matrix)
const events = []
const eventDoc = read('docs/event-producer-consumer.md')
for (const line of eventDoc.split('\n')) {
  if (!line.startsWith('| `')) continue
  const cells = line.split('|').slice(1, -1).map(cell => cell.trim())
  if (cells.length < 5) continue
  const name = cells[0].replace(/`/g, '')
  const mode = cells[1].replace(/`/g, '')
  if (!name || !mode) continue
  const declared = cells[2].match(/\[`([^`]+)`\]\(([^)]+)\)/)
  const names = (cell) => {
    const out = []
    const re = /\[`([^`]+)`\]\(([^)]+)\)|`([^`]+)`/g
    let m
    while ((m = re.exec(cell))) out.push(m[1] || m[3])
    return out.filter(Boolean)
  }
  const dispatchCell = cells[3].split('(')[0]
  events.push({
    name,
    mode,
    declared: declared ? declared[1] : cells[2].replace(/`/g, ''),
    declaredPath: declared ? declared[2] : '',
    dispatchers: names(dispatchCell),
    listeners: names(cells[4]),
  })
}

// ---------------------------------------------------------------- module graph (peer edges)
const moduleEdges = []
const moduleNodes = new Map()
const moduleDoc = read('docs/module-graph.md')
for (const line of moduleDoc.split('\n')) {
  const node = line.match(/^\s+(pkg_[A-Za-z0-9_]+)\["([^"]+)"\]/)
  if (node) moduleNodes.set(node[1], node[2])
  const edge = line.match(/^\s+(pkg_[A-Za-z0-9_]+)\s+-->\s+(pkg_[A-Za-z0-9_]+)/)
  if (edge) moduleEdges.push({ from: moduleNodes.get(edge[1]) || edge[1], to: moduleNodes.get(edge[2]) || edge[2] })
}

// ---------------------------------------------------------------- base composition rows
const basePlugins = []
for (const line of read('apps/cli/composition.md').split('\n')) {
  const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*`(@[^`]+)`\s*\|/)
  if (m) basePlugins.push({ id: m[1], package: m[2] })
}

// ---------------------------------------------------------------- profiles + bundles
const bundlesSrc = read('packages/util/official-bundles/src/bundles.ts')
const profiles = []
const templateBlock = bundlesSrc.slice(bundlesSrc.indexOf('PROFILE_TEMPLATES'))
for (const m of templateBlock.matchAll(/\n  (?:'([a-z-]+)'|([a-z-]+)): \{\s*\n\s*bundles: \[([^\]]+)\],/g)) {
  const name = m[1] || m[2]
  const bundles = [...m[3].matchAll(/'([^']+)'/g)].map(x => x[1])
  profiles.push({ name, bundles })
}
const bundleRows = {}
for (const profile of profiles) {
  for (const bundle of profile.bundles) {
    if (bundleRows[bundle]) continue
    const short = bundle.replace('@deepseek-ai/', '')
    const file = `packages/bundle/${short.replace('dsh-', '')}/cordis.patch.yml`
    if (!exists(file)) { bundleRows[bundle] = []; continue }
    const ids = []
    for (const line of read(file).split('\n')) {
      const m = line.match(/^\s+- id: ([A-Za-z0-9@/._-]+)\s*$/)
      if (m) ids.push(m[1])
    }
    bundleRows[bundle] = [...new Set(ids)]
  }
}

// ---------------------------------------------------------------- tools catalog
const tools = []
for (const line of read('docs/tool-catalog.md').split('\n')) {
  const m = line.match(/^\|\s*`(@deepseek-ai\/[^`]+)`\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|$/)
  if (!m) continue
  const names = [...m[2].matchAll(/`([^`]+)`/g)].map(x => x[1])
  if (names.length === 0) continue
  tools.push({
    package: m[1],
    names,
    requires: [...m[3].matchAll(/`([^`]+)`/g)].map(x => x[1]),
    writes: [...m[4].matchAll(/`([^`]+)`/g)].map(x => x[1]),
    aliases: [...m[5].matchAll(/`([^`]+)`/g)].map(x => x[1]),
  })
}

// ---------------------------------------------------------------- session events
const sessionEventLines = []
const sessionTypes = read('packages/core/session/src/types.ts').split('\n')
let inMap = false
for (let i = 0; i < sessionTypes.length; i++) {
  const line = sessionTypes[i]
  if (line.includes('export interface SessionEventMap {')) { inMap = true; continue }
  if (inMap && line === '}') break
  if (!inMap) continue
  const m = line.match(/^  '([^']+)':/)
  if (m) sessionEventLines.push({ name: m[1], line: i + 1 })
}

// 插件通过声明合并扩展 SessionEventMap；把扩展键也收进来，标注所属包。
const sessionEventExtensions = []
const seenEventKeys = new Set(sessionEventLines.map(e => `packages/core/session/src/types.ts:${e.line}`))
for (const full of walk(path.join(SRC, 'packages'))) {
  if (!/\.ts$/.test(full)) continue
  const relPath = rel(full)
  if (relPath.includes('/tests/') || relPath.endsWith('api-catalog.ts')) continue
  if (relPath === 'packages/core/session/src/types.ts') continue
  const text = fs.readFileSync(full, 'utf8')
  if (!text.includes('interface SessionEventMap')) continue
  const lines = text.split('\n')
  let inside = false
  let depth = 0
  for (let i = 0; i < lines.length; i++) {
    if (/interface SessionEventMap\s*\{/.test(lines[i])) { inside = true; depth = 1; continue }
    if (!inside) continue
    depth += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length
    if (depth <= 0) { inside = false; continue }
    const m = lines[i].match(/^\s+'([^']+)'\??:/)
    if (m && !seenEventKeys.has(`${relPath}:${i + 1}`)) {
      seenEventKeys.add(`${relPath}:${i + 1}`)
      sessionEventExtensions.push({ name: m[1], file: relPath, line: i + 1 })
    }
  }
}

// ---------------------------------------------------------------- curated source excerpts
const manifestPath = path.join(ROOT, 'tools', 'source-excerpts.json')
const excerpts = []
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  for (const item of manifest) {
    const full = path.join(SRC, item.file)
    if (!fs.existsSync(full)) { excerpts.push({ ...item, missing: true }); continue }
    const lines = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '').split('\n')
    const start = Math.max(1, item.start || 1)
    const end = Math.min(lines.length, item.end || lines.length)
    const text = lines.slice(start - 1, end).join('\n')
    excerpts.push({
      id: item.id,
      file: item.file,
      start,
      end,
      label: item.label,
      note: item.note || '',
      code: text,
      hash: sha1(text),
    })
  }
}

// ---------------------------------------------------------------- meta
const head = (() => {
  try {
    const gitHead = fs.readFileSync(path.join(SRC, '.git', 'HEAD'), 'utf8').trim()
    if (gitHead.startsWith('ref: ')) {
      return fs.readFileSync(path.join(SRC, '.git', gitHead.slice(5).trim()), 'utf8').trim()
    }
    return gitHead
  } catch { return '' }
})()
const rootPkg = JSON.parse(read('package.json'))

const out = {
  meta: {
    source: SRC,
    product: rootPkg.name,
    version: rootPkg.version,
    commit: head,
    node: (rootPkg.engines && rootPkg.engines.node) || '',
    packageManager: rootPkg.packageManager || '',
    extractedAt: new Date().toISOString(),
    stats: {
      packages: packages.length,
      groups: new Set(packages.map(p => p.group)).size,
      sourceFiles: tsFiles.length,
      lines: loc,
      basePlugins: basePlugins.length,
      events: events.length,
      sessionEvents: sessionEventLines.length + sessionEventExtensions.length,
      coreSessionEvents: sessionEventLines.length,
      tools: tools.reduce((n, t) => n + t.names.length, 0),
      moduleEdges: moduleEdges.length,
    },
  },
  packages,
  groups: [...new Set(packages.map(p => p.group))].map(name => ({
    name,
    count: packages.filter(p => p.group === name).length,
  })),
  basePlugins,
  profiles,
  bundles: Object.fromEntries(Object.entries(bundleRows).map(([k, v]) => [k, v])),
  events,
  moduleNodes: [...moduleNodes.values()].sort(),
  moduleEdges,
  tools,
  sessionEvents: [
    ...sessionEventLines.map(e => ({ ...e, file: 'packages/core/session/src/types.ts' })),
    ...sessionEventExtensions,
  ],
  excerpts,
}

const outDir = path.join(ROOT, 'data')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'generated.json'), JSON.stringify(out, null, 2), 'utf8')

// research 快照：记录抽取口径与来源文档指纹，便于复核
fs.mkdirSync(path.join(ROOT, 'research'), { recursive: true })
const snapshot = [
  '# 源码事实抽取快照',
  '',
  `- 源码路径：\`${SRC}\``,
  `- 版本：${out.meta.version}（commit ${out.meta.commit.slice(0, 12)}）`,
  `- 抽取时间：${out.meta.extractedAt}`,
  '',
  '## 来源文档指纹（SHA-1 前 12 位）',
  '',
  '| 文档 | hash |',
  '| --- | --- |',
  ...[
    'docs/event-producer-consumer.md',
    'docs/module-graph.md',
    'docs/tool-catalog.md',
    'apps/cli/composition.md',
    'packages/util/official-bundles/src/bundles.ts',
    'packages/core/session/src/types.ts',
  ].map(f => `| \`${f}\` | \`${sha1(read(f))}\` |`),
  '',
  '## 抽取结果计数',
  '',
  '```json',
  JSON.stringify(out.meta.stats, null, 2),
  '```',
  '',
]
fs.writeFileSync(path.join(ROOT, 'research', 'source-facts.md'), snapshot.join('\n'), 'utf8')

console.log(`source: ${SRC}`)
console.log(`version ${out.meta.version} · commit ${out.meta.commit.slice(0, 12)}`)
console.log(`packages ${packages.length} · base plugins ${basePlugins.length} · events ${events.length} · tools ${out.meta.stats.tools} · session events ${out.meta.stats.sessionEvents} (core ${out.meta.stats.coreSessionEvents}) · peer edges ${moduleEdges.length}`)
console.log(`excerpts ${excerpts.length} (${excerpts.filter(e => e.missing).length} missing) · stat files ${tsFiles.length} · loc ${loc}`)
console.log('wrote data/generated.json + research/source-facts.md')
