#!/usr/bin/env node
/**
 * 从 data/*.json 生成两份「索引型」文档，避免手工抄写导致数字漂移：
 *   docs/SOURCE_INDEX.md
 *   docs/GLOSSARY.md
 * 其余文档是手写的分析正文，不由脚本覆盖。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const D = {
  generated: JSON.parse(fs.readFileSync(path.join(ROOT, 'data/generated.json'), 'utf8')),
  architecture: JSON.parse(fs.readFileSync(path.join(ROOT, 'data/architecture.json'), 'utf8')),
  glossary: JSON.parse(fs.readFileSync(path.join(ROOT, 'data/glossary.json'), 'utf8')),
  lab: JSON.parse(fs.readFileSync(path.join(ROOT, 'data/execution-lab.json'), 'utf8')),
}
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true })

const meta = D.generated.meta
const stamp = `> 生成物：由 \`tools/generate-docs.mjs\` 从 data/*.json 生成，请勿手改。分析对象 ${meta.version}（commit ${meta.commit.slice(0, 7)}）。`

// ---------- SOURCE_INDEX ----------
const rows = []
const seen = new Set()
for (const node of D.architecture.nodes) {
  for (const file of node.files || []) {
    const key = `${file.path}:${file.line || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      module: node.label,
      loc: file.line ? `${file.path}:${file.line}` : file.path,
      symbol: file.symbol || '—',
    })
  }
}
rows.sort((a, b) => a.loc.localeCompare(b.loc))

const groupCounts = D.generated.groups.map(g => `| \`${g.name}\` | ${g.count} |`).join('\n')
const excerptRows = D.generated.excerpts.map(e => `| \`${e.id}\` | \`${e.file}:${e.start}\` | ${e.label} |`).join('\n')
const sessionEventRows = D.generated.sessionEvents.map(e => `| \`${e.name}\` | \`${e.file}:${e.line}\` |`).join('\n')

const sourceIndex = `# SOURCE_INDEX · 源码索引

${stamp}

## 怎么用

- 路径都相对于源码仓库根目录；行号是抽取时的真实位置。
- 可视化平台的「源码索引」页可以搜索文件、符号、包名，并直接打开已抽取的代码片段。
- 若要重新核对，先看 \`research/source-facts.md\` 的来源文档指纹，再跑 \`node tools/extract-source-facts.mjs\`。

## 规模

| 指标 | 数值 |
| --- | --- |
| workspace 包 | ${meta.stats.packages} |
| 包分组 | ${meta.stats.groups} |
| TypeScript 源文件（不含测试） | ${meta.stats.sourceFiles} |
| 源码行数 | ${meta.stats.lines} |
| 事件 | ${meta.stats.events} |
| Session 事件 | ${meta.stats.sessionEvents}（核心 ${meta.stats.coreSessionEvents}） |
| 模型可见工具名 | ${meta.stats.tools} |
| 已抽取代码片段 | ${D.generated.excerpts.length} |

## 核心源码位置（${rows.length}）

| 模块 | 位置 | 符号 |
| --- | --- | --- |
${rows.map(r => `| ${r.module} | \`${r.loc}\` | ${r.symbol} |`).join('\n')}

## 已抽取代码片段（${D.generated.excerpts.length}）

| id | 位置 | 说明 |
| --- | --- | --- |
${excerptRows}

## Session 事件声明位置（${D.generated.sessionEvents.length}）

| 事件 | 位置 |
| --- | --- |
${sessionEventRows}

## 包分组

| 分组 | 包数 |
| --- | --- |
${groupCounts}

完整包列表（${meta.stats.packages} 个）见平台「源码索引 → 全部包」，或 \`data/generated.json\` 的 \`packages\`。
`
fs.writeFileSync(path.join(ROOT, 'docs/SOURCE_INDEX.md'), sourceIndex, 'utf8')

// ---------- GLOSSARY ----------
const glossary = `# GLOSSARY · 术语表

${stamp}

| 术语 | 一句话解释 | 打个比方 | 源码位置 |
| --- | --- | --- | --- |
${D.glossary.terms.map(t => `| **${t.term}** | ${t.plain} | ${t.analogy} | \`${t.ref}\` |`).join('\n')}
`
fs.writeFileSync(path.join(ROOT, 'docs/GLOSSARY.md'), glossary, 'utf8')

// ---------- EXECUTION_LAB ----------
const lab = D.lab
const usage = new Map()
for (const sc of lab.scenarios) {
  const seen = new Set()
  for (const b of sc.beats) seen.add(b.s)
  for (const id of seen) usage.set(id, (usage.get(id) || 0) + 1)
}
const stationRows = lab.stations.map(s => {
  const ev = (s.events || []).map(e => `\`${e.name}\``).join('<br>') || '—'
  const hook = (s.hooks || []).map(h => `\`${h.name}\``).join('<br>')
  return `| ${s.no} | **${s.name}** | ${s.module} | \`${s.source.file}:${s.source.line}\` | ${ev}${hook ? '<br>钩子 ' + hook : ''} | ${usage.get(s.id) || 0} |`
}).join('\n')
const scenarioRows = lab.scenarios.map(sc =>
  `| \`${sc.id}\` | ${sc.title} | ${sc.beats.length} | ${sc.support} | ${sc.example} |`).join('\n')
const eventCount = new Set(lab.stations.flatMap(s => (s.events || []).map(e => e.name))).size

const labDoc = `# EXECUTION_LAB · 3D Agent 动态执行实验室

${stamp}

## 它是什么

源码知识库回答「有什么、怎么设计」；动态实验室回答「执行时内部发生了什么」。
它把一次 Agent 执行拆成 ${lab.stations.length} 个站台（含 1 个不参与路径动画的中央核心），按真实源码里的
Turn / Step / 工具流水线关系播放。站台、模块、事件与源码位置来自本地源码；模型回复、耗时、token
与字段值为**教学模拟数据**，页面顶部始终显示 \`SIMULATED / 教学模拟\`。

## 技术选择

现有知识库是零依赖的 vanilla JS + SVG，不是 React 工程。为了不破坏单文件、离线、零外部请求的基线，
实验室没有引入 Three.js / React Three Fiber / GSAP，而是在 \`src/js/lab-scene.js\` 里自研了
**透视投影 + 深度排序 + Canvas 2D** 的轻量 3D：站台、管道、粒子、标签都在同一套相机下绘制。
它没有 WebGL 依赖，截图与验收稳定；代价是没有真实光照与阴影，视觉层次靠发光、深度与标签避让实现。
\`lab-engine.js\` 只管 beat 播放，\`lab-panel.js\` 只管详情，\`lab.js\` 负责装配，三者不互相硬编码。

## 入口与操作

- 知识库左侧导航顶部「Agent 动态执行」，或直接打开 \`#/execution-lab\`；场景深链形如 \`#/execution-lab?scenario=loop\`。
- 底部输入台可以输入任意任务文本；它只作为本次模拟的任务标签，**不做意图识别**，流程由所选场景决定。
- 播放：空格暂停/继续，\`←\` / \`→\` 单步，\`R\` 重置；也支持上一步、下一步、倍速、点击进度段跳转。
- 点击 3D 站台或其标签，右侧打开「概览 / 数据 / 源码 / 关联」四个页签；站台标签在拥挤处会自动避让，悬停站台可重新显示。
- 「跟随」只做轻微镜头跟随，避免把两侧站台裁掉；「重置视角」恢复完整构图。
- 「全屏」进入剧场模式；\`Esc\` 退出。移动端改为上下布局，只显示当前站台标签。

## 与许愿清单的差异（以源码为准）

许愿里的 17 个站台只是初步构想，最终按源码做了四处修正：

1. **Tool Registry 在 LLM 请求之前**：每个 Step 的 preStep 都会 \`tools.resolve()\`，不是等到 tool-call 之后才找工具。
2. **Context 构建在 prepareCall 之后**：\`deriveMessages()\` 在 \`buildRequest()\` 里执行，不是 preStep 之前；preStep 只做 claim、解析工具、组装提示词与 \`agent/pre-step\`。
3. **审批门在 pipeline 内部**：\`tools/pre-execute\` 返回 ask 后才进入 \`approval/request\`，所以路径是 toolcall → pipeline → approval → pipeline → result。
4. **加入中央 Agent Core**：它不参与单步路径动画，只作为 \`turn()\` 循环的视觉锚点。Subagent 与审批门是独立站台。

## 站台（${lab.stations.length}）

| 编号 | 站台 | 所属模块 | 源码位置 | 关联事件 / 钩子 | 覆盖场景数 |
| --- | --- | --- | --- | --- | --- |
${stationRows}

共关联 ${eventCount} 个事件/钩子。\`agent/request\` 在源码里是 \`runtime-types.ts:373\` 的 waterfall，但事件矩阵表缺这一行，页面上单列为「钩子」。

## 场景（${lab.scenarios.length}）

| id | 场景 | 步数 | 支持度 | 示例任务 |
| --- | --- | --- | --- | --- |
${scenarioRows}

## 播放模型

- 每个场景由一串 beat 组成；beat 属于某个站台，带阶段、标题、解释、输入输出、事件与数据样本。
- 播放器只做线性推进；循环感来自路径几何（工具结果回到 Context，再进入下一个 Step）。
- 上一帧、下一帧、暂停、倍速、进度跳转都是对 beat 索引的操作，不改变源码事实。
- 回边（Loop 判断 → Tool Registry）在场景里是显式 beat，画面上是橙色弧线；它不是「再开一个 Turn」，而是同一 Turn 的下一个 Step 重新 claim / 解析工具 / 组装提示词。
- 失败、审批、取消是 beat 的显示状态，不是另一种流程。

## 数据口径

- 站台 \`source.file\`、\`source.line\`、事件名、包名都由 \`tools/verify-data.mjs\` 校验。
- 数据观察器里的 JSON 是按源码类型定义的**示意值**；\`note\` 字段会说明哪些数值不可当真。
- 当前**没有接入真实运行追踪**：不修改、不注入 DeepSeek Harness 进程，也不把预设数据伪装成实时日志。

## 重新生成

\`\`\`powershell
node tools/generate-docs.mjs   # 生成本文件、SOURCE_INDEX.md、GLOSSARY.md
node tools/verify-data.mjs     # 校验站台 / 场景 / 事件 / 源码引用
\`\`\`
`
fs.writeFileSync(path.join(ROOT, 'docs/EXECUTION_LAB.md'), labDoc, 'utf8')

console.log(`wrote docs/SOURCE_INDEX.md (${rows.length} core locations), docs/GLOSSARY.md (${D.glossary.terms.length} terms), docs/EXECUTION_LAB.md (${lab.stations.length} stations / ${lab.scenarios.length} scenarios)`)
