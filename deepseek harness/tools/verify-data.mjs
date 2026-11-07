#!/usr/bin/env node
/**
 * 校验 data/*.json 的源码引用是否存在、id 是否唯一、图边端点是否有效。
 * 用法：node tools/verify-data.mjs [--src <source-root>]
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.resolve(process.env.DSH_SRC || 'E:\\Codeing\\WebStorm 2025.3.3\\work\\deepseek-harness')
const dataDir = path.join(ROOT, 'data')

const problems = []
const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'))
const docs = {}
for (const file of files) {
  try {
    docs[file] = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
  } catch (error) {
    problems.push(`${file}: JSON 解析失败 — ${error.message}`)
  }
}

const seen = new Set()
const walk = (value, trail) => {
  if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${trail}[${i}]`)); return }
  if (value === null || typeof value !== 'object') return
  if (typeof value.path === 'string' && !value.path.startsWith('http')) {
    if (!fs.existsSync(path.join(SRC, value.path))) problems.push(`${trail}: 文件不存在 ${value.path}`)
  }
  for (const [key, v] of Object.entries(value)) walk(v, `${trail}.${key}`)
}
for (const [file, doc] of Object.entries(docs)) {
  // 实验室里的 path 是工具参数示例（教学模拟），不是源码位置；源码引用在下方单独校验
  if (file === 'execution-lab.json') continue
  walk(doc, file)
}

// 图数据：边端点必须存在
for (const [file, doc] of Object.entries(docs)) {
  if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) continue
  const ids = new Set(doc.nodes.map(n => n.id))
  for (const id of ids) {
    if (seen.has(id)) problems.push(`${file}: 节点 id 重复 ${id}`)
    seen.add(id)
  }
  for (const edge of doc.edges) {
    if (edge.from && !ids.has(edge.from)) problems.push(`${file}: 边起点不存在 ${edge.from}`)
    if (edge.to && !ids.has(edge.to)) problems.push(`${file}: 边终点不存在 ${edge.to}`)
    if (edge.ref) {
      const p = String(edge.ref).split(':')[0]
      if (!fs.existsSync(path.join(SRC, p))) problems.push(`${file}: 边引用不存在 ${edge.ref}`)
    }
  }
}

// 执行实验室：站台 / 场景 / 事件 / 源码摘录必须互相对得上
const lab = docs['execution-lab.json']
const generated = docs['generated.json']
if (lab && generated) {
  const excerptIds = new Set(generated.excerpts.map(e => e.id))
  const eventNames = new Set([
    ...(generated.events || []).map(e => e.name),
    ...(generated.sessionEvents || []).map(e => e.name),
  ])
  const nodeIds = new Set((docs['architecture.json']?.nodes || []).map(n => n.id))
  const stationIds = new Set()
  for (const s of lab.stations || []) {
    if (stationIds.has(s.id)) problems.push(`execution-lab: 站台 id 重复 ${s.id}`)
    stationIds.add(s.id)
    if (!Array.isArray(s.pos) || s.pos.length !== 3) problems.push(`execution-lab: ${s.id} pos 不是三维坐标`)
    if (s.node && !nodeIds.has(s.node)) problems.push(`execution-lab: ${s.id} 架构节点不存在 ${s.node}`)
    if (!excerptIds.has(s.source?.excerpt)) problems.push(`execution-lab: ${s.id} 代码片段不存在 ${s.source?.excerpt}`)
    for (const e of s.events || []) if (!eventNames.has(e.name)) problems.push(`execution-lab: ${s.id} 事件不存在 ${e.name}`)
    for (const h of s.hooks || []) {
      const [file, line] = String(h.ref).split(':')
      if (!fs.existsSync(path.join(SRC, file))) { problems.push(`execution-lab: ${s.id} 钩子文件不存在 ${file}`); continue }
      const text = fs.readFileSync(path.join(SRC, file), 'utf8').split('\n')[Number(line) - 1] || ''
      if (!text.includes(h.name)) problems.push(`execution-lab: ${s.id} 钩子 ${h.name} 不在 ${h.ref}`)
    }
    const line = s.source?.line ? fs.readFileSync(path.join(SRC, s.source.file), 'utf8').split('\n') : []
    if (s.source?.line && line.length && s.source.line > line.length) problems.push(`execution-lab: ${s.id} 行号越界 ${s.source.line}`)
  }
  const scenarioIds = new Set()
  for (const sc of lab.scenarios || []) {
    if (scenarioIds.has(sc.id)) problems.push(`execution-lab: 场景 id 重复 ${sc.id}`)
    scenarioIds.add(sc.id)
    if (!sc.beats?.length) problems.push(`execution-lab: 场景 ${sc.id} 没有步骤`)
    sc.beats?.forEach((b, i) => {
      if (!stationIds.has(b.s)) problems.push(`execution-lab: ${sc.id}[${i}] 站台不存在 ${b.s}`)
      if (b.src && !excerptIds.has(b.src)) problems.push(`execution-lab: ${sc.id}[${i}] 代码片段不存在 ${b.src}`)
      for (const e of b.ev || []) if (!eventNames.has(e)) problems.push(`execution-lab: ${sc.id}[${i}] 事件不存在 ${e}`)
      if (b.status && !['error', 'approval', 'branch'].includes(b.status)) problems.push(`execution-lab: ${sc.id}[${i}] 非法状态 ${b.status}`)
    })
  }
}

console.log(`checked ${files.length} data files against ${SRC}`)
if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error(' - ' + p)
  process.exit(1)
}
console.log('all source references resolve')
