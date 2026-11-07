#!/usr/bin/env node
/**
 * 把 data/*.json 合并成 src/js/data.generated.js（window.LAB_DATA）。
 * 生成物不手改；build.mjs 与 dev.html 都消费同一份。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const dataDir = path.join(ROOT, 'data')

const read = file => JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'))
const data = {
  generated: read('generated.json'),
  architecture: read('architecture.json'),
  techstack: read('techstack.json'),
  startup: read('startup.json'),
  agentloop: read('agentloop.json'),
  request: read('request.json'),
  scenarios: read('scenarios.json'),
  plugins: read('plugins.json'),
  events: read('events-curated.json'),
  models: read('models.json'),
  modes: read('modes.json'),
  agent: read('agent.json'),
  coverage: read('coverage.json'),
  glossary: read('glossary.json'),
  home: read('home.json'),
  executionLab: read('execution-lab.json'),
}

const payload = `/* 由 tools/sync-data.mjs 从 data/*.json 生成，请勿手改。 */
window.LAB_DATA = ${JSON.stringify(data)};
`
fs.writeFileSync(path.join(ROOT, 'src', 'js', 'data.generated.js'), payload, 'utf8')

const kb = (Buffer.byteLength(payload) / 1024).toFixed(0)
console.log(`synced ${Object.keys(data).length} datasets -> src/js/data.generated.js (${kb} KB)`)
