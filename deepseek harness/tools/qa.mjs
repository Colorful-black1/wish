#!/usr/bin/env node
/**
 * GPU-only 验收：无头 Chrome 打开单文件成品，遍历 13 个源码知识库页面，
 * 再专项验收 3D 动态执行实验室；检查控制台、外链请求、横向溢出、交互路径，
 * 并留存截图与 qa/report.json。
 *
 * 用法（愿望目录内）：node tools/qa.mjs
 * 硬性要求：必须拿到硬件 GPU；命中 SwiftShader / llvmpipe 直接失败。
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'qa')
fs.mkdirSync(OUT, { recursive: true })

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p))
if (!CHROME) {
  console.error('no chrome / edge at the expected paths')
  process.exit(1)
}

const PORT = 9400 + Math.floor(Math.random() * 300)
const PROFILE = path.join(ROOT, '.chrome-qa')
const URL = pathToFileURL(path.join(ROOT, 'index.html')).href
fs.rmSync(PROFILE, { recursive: true, force: true })

const GPU_ARGS = [
  '--headless=new',
  '--enable-gpu',
  '--use-gl=angle',
  '--use-angle=d3d11',
  '--disable-gpu-sandbox',
  '--ignore-gpu-blocklist',
  '--disable-software-rasterizer',
]

const chrome = spawn(CHROME, [
  ...GPU_ARGS,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--hide-scrollbars',
  '--mute-audio',
  '--allow-file-access-from-files',
  '--force-device-scale-factor=1',
  `--user-data-dir=${PROFILE}`,
  `--remote-debugging-port=${PORT}`,
  '--window-size=1440,900',
  'about:blank',
], { stdio: 'ignore' })

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function waitPort() {
  for (let i = 0; i < 160; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) return (await res.json()).webSocketDebuggerUrl
    } catch { /* retry */ }
    await sleep(150)
  }
  throw new Error('chrome did not start')
}

const wsUrl = await waitPort()
const ws = new WebSocket(wsUrl)
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve)
  ws.addEventListener('error', reject)
})

let nextId = 1
const pending = new Map()
let sessionId = null
const consoleErrors = []
const pageErrors = []
const failedRequests = []
const checks = []
const screenshots = []

ws.addEventListener('message', (ev) => {
  let msg
  try { msg = JSON.parse(ev.data) } catch { return }
  if (msg.id) {
    const p = pending.get(msg.id)
    if (p) {
      pending.delete(msg.id)
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result)
    }
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map(a => a.value || a.description || '').join(' '))
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    pageErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || 'unknown exception')
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    consoleErrors.push('LOG: ' + msg.params.entry.text)
  }
  if (msg.method === 'Network.loadingFailed' && !msg.params.errorText?.includes('net::ERR_ABORTED')) {
    failedRequests.push(msg.params.errorText)
  }
})

function send(method, params = {}, sid = sessionId) {
  const id = nextId++
  const payload = { id, method, params }
  if (sid) payload.sessionId = sid
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify(payload))
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error('timeout ' + method))
      }
    }, 60000)
  })
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'))
  screenshots.push(name)
  console.log('  shot', name)
}

function check(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail })
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function goto(page, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const hash = '#/' + page + (qs ? '?' + qs : '')
  await evaluate(`location.hash = ${JSON.stringify(hash)}`)
  await sleep(360)
  return evaluate(`({
    page: document.querySelector('#workspace .page') ? true : false,
    title: document.querySelector('.page-title')?.textContent || '',
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    nodes: document.querySelectorAll('.g-node').length,
    edges: document.querySelectorAll('.g-edge').length,
    err: /渲染失败|Uncaught|stack overflow/i.test(document.querySelector('#workspace')?.textContent || '')
  })`)
}

try {
  const target = await send('Target.createTarget', { url: 'about:blank' })
  const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })
  sessionId = attached.sessionId
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: URL })

  // 等待 boot
  let ready = false
  for (let i = 0; i < 80; i++) {
    try {
      ready = await evaluate(`!!(window.App && document.querySelector('#workspace .page'))`)
      if (ready) break
    } catch { /* retry */ }
    await sleep(200)
  }
  if (!ready) throw new Error('app did not boot: ' + await evaluate(`document.body.innerText.slice(0,400)`))

  // ---------- GPU ----------
  const gpu = await evaluate(`(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return { ok: false, renderer: 'no-webgl' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { ok: true, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '' };
  })()`)
  if (!gpu.ok) {
    check('GPU renderer available', false, gpu.renderer)
  } else {
    const software = /swiftshader|software|llvmpipe|basic render/i.test(gpu.renderer)
    check('GPU renderer is hardware', !software, gpu.renderer)
    if (software) throw new Error('software renderer detected: ' + gpu.renderer)
  }

  // ---------- 数据完整性 ----------
  const stats = await evaluate(`({
    nodes: document.querySelectorAll('.nav__item').length,
    labEntry: !!document.querySelector('.nav__lab[data-go="execution-lab"]'),
    packages: window.LAB_DATA.generated.meta.stats.packages,
    events: window.LAB_DATA.generated.meta.stats.events,
    tools: window.LAB_DATA.generated.meta.stats.tools,
    excerpts: window.LAB_DATA.generated.excerpts.length,
    stations: window.LAB_DATA.executionLab.stations.length,
    scenarios: window.LAB_DATA.executionLab.scenarios.length,
    archNodes: window.LAB_DATA.architecture.nodes.length,
    archEdges: window.LAB_DATA.architecture.edges.length
  })`)
  check('13 个知识库页面', stats.nodes === 13, String(stats.nodes))
  check('数据已内联（包/事件/工具/片段）', stats.packages > 300 && stats.events > 50 && stats.tools > 50 && stats.excerpts >= 30,
    `${stats.packages} 包 · ${stats.events} 事件 · ${stats.tools} 工具 · ${stats.excerpts} 片段`)
  check('实验室数据已内联', stats.stations === 20 && stats.scenarios === 10, `${stats.stations} 站台 · ${stats.scenarios} 场景`)

  // ---------- 逐页 ----------
  const pages = [
    ['home', {}, 'home.png'],
    ['stack', {}, 'stack.png'],
    ['architecture', {}, 'architecture.png'],
    ['agent', {}, 'agent.png'],
    ['loop', {}, 'loop.png'],
    ['request', {}, 'request.png'],
    ['scenarios', { s: 'B' }, 'scenarios.png'],
    ['plugins', {}, 'plugins.png'],
    ['events', {}, 'events.png'],
    ['models', {}, 'models.png'],
    ['modes', {}, 'modes.png'],
    ['sources', {}, 'sources.png'],
    ['progress', {}, 'progress.png'],
  ]
  for (const [page, params, file] of pages) {
    const state = await goto(page, params)
    check(`页面 ${page} 渲染`, state.page && !state.overflow && !state.err,
      state.page ? (state.overflow ? '有横向溢出' : state.title) : '未渲染')
    if (state.nodes) check(`页面 ${page} 架构图节点`, state.nodes >= 5, `${state.nodes} 节点 / ${state.edges} 连线`)
    if (file) await shot(file)
  }

  // 启动流程子页
  const startup = await goto('architecture', { tab: 'startup' })
  check('启动流程页渲染', startup.page && startup.nodes >= 9, `${startup.nodes} 节点 / ${startup.edges} 连线`)
  await shot('startup.png')

  // ---------- 3D 动态执行实验室 ----------
  await evaluate(`location.hash = '#/execution-lab?scenario=loop'`)
  await sleep(900)
  const labBoot = await evaluate(`(() => {
    const canvas = document.querySelector('#labCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    let alpha = 0;
    if (ctx) {
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < d.length; i += 4096) if (d[i] > 0) alpha++;
    }
    return {
      lab: !!document.querySelector('.lab'),
      navHidden: document.querySelector('.app').classList.contains('app--lab') && getComputedStyle(document.querySelector('.nav')).display === 'none',
      topbarHidden: getComputedStyle(document.querySelector('.topbar')).display === 'none',
      tags: document.querySelectorAll('.lab-tag').length,
      scenes: document.querySelectorAll('[data-scenario]').length,
      panel: !!document.querySelector('.lab-panel__head'),
      canvas: canvas ? canvas.width + 'x' + canvas.height : '',
      alpha,
      sim: /SIMULATED/.test(document.querySelector('.lab-top')?.textContent || ''),
      total: window.__lab?.engine.total() || 0,
      title: document.querySelector('.lab-brand__t')?.textContent || '',
      navEntry: !!document.querySelector('.nav__lab[data-go="execution-lab"]')
    };
  })()`)
  check('导航顶部出现动态实验室入口', labBoot.navEntry)
  check('动态实验室独立布局', labBoot.lab && labBoot.navHidden && labBoot.topbarHidden && labBoot.panel,
    `${labBoot.title} · 侧栏 ${labBoot.panel} · 顶栏隐藏 ${labBoot.topbarHidden}`)
  check('19 个站台 + 核心 + 10 个场景', labBoot.tags === 20 && labBoot.scenes === 10, `${labBoot.tags} 标签 / ${labBoot.scenes} 场景`)
  check('3D 画布已绘制', labBoot.canvas !== '' && labBoot.alpha > 50, `${labBoot.canvas} · ${labBoot.alpha} 采样点`)
  check('教学模拟标识可见', labBoot.sim)
  await shot('execution-lab.png')

  await evaluate(`document.querySelector('#labRun').click()`)
  await sleep(3000)
  const labPlay = await evaluate(`({
    index: window.__lab.engine.index,
    status: window.__lab.engine.status,
    dock: document.querySelector('.lab-tag.is-active')?.textContent || '',
    count: document.querySelector('#hudCount')?.textContent || '',
    caption: document.querySelector('#labCaption')?.textContent || '',
    activeSeg: document.querySelectorAll('.lab-seg.is-active').length,
    panel: document.querySelector('.lab-panel__name')?.textContent || ''
  })`)
  check('开始执行：粒子与站台推进', labPlay.index >= 2 && labPlay.status === 'playing' && labPlay.activeSeg === 1,
    `${labPlay.count} · ${labPlay.panel.trim()} · ${labPlay.caption.slice(0, 40)}`)
  await shot('execution-lab-running.png')

  const labPause = await evaluate(`(() => {
    document.querySelector('[data-ctl="play"]').click();
    return { status: window.__lab.engine.status, index: window.__lab.engine.index };
  })()`)
  check('暂停可用', labPause.status === 'paused', `停在第 ${labPause.index + 1} 步`)

  const labStep = await evaluate(`(() => {
    const before = window.__lab.engine.index;
    document.querySelector('[data-ctl="next"]').click();
    const after = window.__lab.engine.index;
    document.querySelector('[data-ctl="prev"]').click();
    return { before, after, back: window.__lab.engine.index };
  })()`)
  check('单步前进 / 后退', labStep.after === labStep.before + 1 && labStep.back === labStep.before,
    `${labStep.before} → ${labStep.after} → ${labStep.back}`)

  const labScenario = await evaluate(`(() => {
    const sel = document.querySelector('#labScenario');
    sel.value = 'bugfix';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return { id: window.__lab.engine.scenario.id, total: window.__lab.engine.total(), label: document.querySelector('#hudTitle')?.textContent };
  })()`)
  check('场景切换', labScenario.id === 'bugfix' && labScenario.total >= 30, `${labScenario.label} · ${labScenario.total} 步`)

  // 自定义任务进入执行
  const labTask = await evaluate(`(() => {
    const task = document.querySelector('#labTask');
    task.value = '自定义任务：检查登录失败的原因';
    document.querySelector('#labRun').click();
    return { value: task.value };
  })()`)
  await sleep(700)
  const labTaskState = await evaluate(`({
    task: window.__lab.engine.task,
    panel: document.querySelector('.lab-taskline b')?.textContent || '',
    status: window.__lab.engine.status
  })`)
  check('任意任务文本进入执行', labTaskState.task.includes('自定义任务') && labTaskState.panel.includes('自定义任务') && labTaskState.status === 'playing',
    labTaskState.panel.slice(0, 28))

  const labSpeed = await evaluate(`(() => {
    const sel = document.querySelector('#labSpeed');
    sel.value = '2';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return { speed: window.__lab.engine.speed };
  })()`)
  check('播放速度可调', labSpeed.speed === 2, labSpeed.speed + '×')

  const labKeys = await evaluate(`(() => {
    const fire = (key) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    const before = window.__lab.engine.status;
    fire(' ');
    const paused = window.__lab.engine.status;
    fire(' ');
    const resumed = window.__lab.engine.status;
    fire(' ');
    return { before, paused, resumed, final: window.__lab.engine.status };
  })()`)
  check('空格暂停 / 继续', labKeys.before === 'playing' && labKeys.paused === 'paused' && labKeys.resumed === 'playing' && labKeys.final === 'paused',
    `${labKeys.before} → ${labKeys.paused} → ${labKeys.resumed}`)

  // 审批分支（索引从数据里找，避免流程调整后测试写死）
  const approval = await evaluate(`(() => {
    window.__lab.loadScenario('exception');
    const idx = window.__lab.engine.scenario.beats.findIndex(b => b.s === 'approval');
    window.__lab.engine.go(idx);
    return {
      index: idx,
      status: document.querySelector('.lab-status')?.textContent.trim(),
      tag: document.querySelector('.lab-tag[data-station="approval"]')?.className || '',
      panel: document.querySelector('.lab-panel__name')?.textContent || '',
      trail: window.__lab.engine.state().trail.slice(-1)[0] || []
    };
  })()`)
  check('审批分支动画状态', /等待审批/.test(approval.status || '') && /is-approval/.test(approval.tag) && /审批/.test(approval.panel),
    `${approval.status} · ${approval.panel.trim()} · ${approval.trail.join('→')}`)
  await shot('execution-lab-approval.png')

  // Loop 回边：下一步回到 preStep（Tool Registry），不是回到 Turn
  const labLoop = await evaluate(`(() => {
    window.__lab.loadScenario('loop');
    const idx = window.__lab.engine.scenario.beats.findIndex(b => b.s === 'context' && b.cycle === 'Step 2');
    window.__lab.engine.go(idx);
    const st = window.__lab.engine.state();
    const edge = window.__lab.scene.edges.find(e => e.a === 'loop' && e.b === 'registry');
    const hit = st.trail.some(([a, b]) => a === 'loop' && b === 'registry');
    return { index: idx, edge: edge ? edge.loop : false, hit, status: st.statuses.loop || '', panel: document.querySelector('.lab-panel__name')?.textContent || '' };
  })()`)
  check('循环回边（下一 Step → preStep）', labLoop.edge && labLoop.hit && labLoop.status === 'done',
    `#${labLoop.index} · loop→registry · ${labLoop.panel.trim()}`)
  await shot('execution-lab-loop.png')

  // 全屏 / 剧场模式
  const full = await evaluate(`(() => {
    document.querySelector('#labFull').click();
    return { on: document.querySelector('.lab').classList.contains('is-expanded') };
  })()`)
  await sleep(300)
  const fullOff = await evaluate(`(() => {
    document.querySelector('#labFull').click();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    return { on: document.querySelector('.lab').classList.contains('is-expanded') };
  })()`)
  check('全屏 / 剧场模式切换', full.on && !fullOff.on, `开 ${full.on} · 关 ${fullOff.on}`)

  await evaluate(`window.__lab.loadScenario('bugfix')`)
  await sleep(300)
  const labStation = await evaluate(`(() => {
    const tag = document.querySelector('.lab-tag[data-station="llmRequest"]');
    if (!tag) return { ok: false };
    tag.click();
    return {
      ok: true,
      name: document.querySelector('.lab-panel__name')?.textContent || '',
      selected: !!document.querySelector('.lab-tag.is-selected')
    };
  })()`)
  check('点击站台打开详情', labStation.ok && /LLM/.test(labStation.name) && labStation.selected, labStation.name.trim())

  await evaluate(`document.querySelector('[data-lp-tab="data"]').click()`)
  const labData = await evaluate(`({
    json: !!document.querySelector('.lab-json'),
    sim: /SIMULATED/.test(document.querySelector('.lab-panel__body')?.textContent || ''),
    keys: (document.querySelector('.lab-json')?.textContent || '').includes('"provider"')
  })`)
  check('数据观察器展示模拟 JSON', labData.json && labData.sim && labData.keys)
  await shot('execution-lab-data.png')

  await evaluate(`document.querySelector('[data-lp-tab="source"]').click()`)
  const labSrc = await evaluate(`({
    code: !!document.querySelector('.lab-panel__body .code'),
    path: document.querySelector('.lab-filecard .lab-src')?.textContent || '',
    copy: !!document.querySelector('[data-lp-copy]')
  })`)
  check('源码追踪面板', labSrc.code && /packages\//.test(labSrc.path) && labSrc.copy, labSrc.path)

  await evaluate(`document.querySelector('[data-lp-tab="links"]').click()`)
  const labLinks = await evaluate(`({
    events: document.querySelectorAll('.lab-ev').length,
    kb: document.querySelectorAll('.lab-link').length,
    back: !!document.querySelector('#labBack')
  })`)
  check('事件 / 知识库互链', labLinks.events > 0 && labLinks.kb > 0 && labLinks.back, `${labLinks.events} 事件 · ${labLinks.kb} 入口`)

  // 实验室 → 源码知识库
  await evaluate(`document.querySelector('.lab-link[data-lp-go="architecture"]').click()`)
  await sleep(400)
  const labJump = await evaluate(`({
    lab: !!document.querySelector('.lab'),
    inspector: document.querySelector('.shell').classList.contains('has-inspector'),
    title: document.querySelector('.inspector__title')?.textContent || ''
  })`)
  check('实验室 → 源码知识库跳转', !labJump.lab && labJump.inspector, labJump.title)

  // 知识库 → 实验室
  await goto('loop')
  const loopLab = await evaluate(`(() => {
    const btn = document.querySelector('[data-lab="loop"]');
    if (!btn) return { ok: false };
    btn.click();
    return { ok: true, hash: location.hash };
  })()`)
  await sleep(800)
  const loopLabState = await evaluate(`({ lab: !!document.querySelector('.lab'), scenario: window.__lab?.engine.scenario.id, total: window.__lab?.engine.total() })`)
  check('Agent Loop → 动态实验室', loopLab.ok && loopLabState.lab && loopLabState.scenario === 'loop',
    `${loopLab.hash} · ${loopLabState.total} 步`)

  // ---------- 交互 ----------
  await goto('architecture')
  const nodeClick = await evaluate(`(() => {
    const el = document.querySelector('.g-node[data-id="agent-loop"]');
    if (!el) return { ok: false };
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return {
      ok: true,
      open: document.querySelector('.shell').classList.contains('has-inspector'),
      title: document.querySelector('.inspector__title')?.textContent || '',
      code: !!document.querySelector('.inspector .code')
    };
  })()`)
  check('架构图节点 → 右侧详情', nodeClick.open && /Agent Loop/.test(nodeClick.title), nodeClick.title)
  check('详情包含真实代码片段', nodeClick.code)

  const edgeClick = await evaluate(`(() => {
    const el = document.querySelector('.g-edge');
    if (!el) return { ok: false };
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return { ok: true, title: document.querySelector('.inspector__title')?.textContent || '' };
  })()`)
  check('连线 → 关系详情', edgeClick.ok && edgeClick.title.includes('→'), edgeClick.title)

  const kindFilter = await evaluate(`(() => {
    const select = document.querySelector('[data-fkind]');
    if (!select) return { ok: false, reason: 'no kind filter' };
    select.value = 'store';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const hidden = [...document.querySelectorAll('.g-node')].filter(el => el.style.opacity === '0').length;
    document.querySelector('[data-freset]').click();
    const restored = [...document.querySelectorAll('.g-node')].filter(el => el.style.opacity === '0').length;
    return { ok: hidden > 0 && restored === 0, hidden, restored };
  })()`)
  check('架构图按类型过滤 / 重置', kindFilter.ok, `过滤隐藏 ${kindFilter.hidden}，重置后隐藏 ${kindFilter.restored}`)

  const searchHit = await evaluate(`(() => {
    const input = document.querySelector('#archGraph input[type=search]') || document.querySelector('.graph__toolbar input');
    if (!input) return { ok: false };
    input.value = 'session';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true, hits: document.querySelectorAll('.g-node.is-hit').length };
  })()`)
  check('架构图搜索命中', searchHit.ok && searchHit.hits >= 2, `${searchHit.hits} 个命中`)

  // 循环播放
  await goto('loop')
  const playStart = await evaluate(`(() => {
    const btn = document.querySelector('[data-play]');
    if (!btn) return { ok: false };
    btn.click();
    return { ok: true, count: document.querySelector('[data-count]')?.textContent };
  })()`)
  await sleep(2100)
  const playState = await evaluate(`({
    count: document.querySelector('[data-count]')?.textContent || '',
    active: !!document.querySelector('.g-node--active'),
    detail: document.querySelector('.flow__title')?.textContent || ''
  })`)
  check('Loop 自动播放推进', playStart.ok && playState.count !== '1 / 23' && playState.active, playState.count + ' · ' + playState.detail)
  const pause = await evaluate(`(() => { document.querySelector('[data-play]')?.click(); return document.querySelector('[data-count]')?.textContent; })()`)
  check('Loop 暂停可用', Boolean(pause), pause)

  // 请求链路：轨道过滤 + 点击
  await goto('request')
  const trace = await evaluate(`(() => {
    const items = document.querySelectorAll('[data-trace]');
    if (items.length < 5) return { ok: false, n: items.length };
    items[3].click();
    return { ok: true, n: items.length, title: document.querySelector('.flow__title')?.textContent || '' };
  })()`)
  check('请求链路步骤可点选', trace.ok && trace.title.length > 0, `${trace.n} 步 · ${trace.title}`)

  await goto('request', { track: 'ui' })
  const tracks = await evaluate(`document.querySelectorAll('[data-trace]').length`)
  check('按轨道过滤', tracks > 0 && tracks < 20, `${tracks} 步（ui 轨道）`)

  // 场景切换
  await goto('scenarios', { s: 'D' })
  const scenario = await evaluate(`({
    title: document.querySelector('#scenarioDetail h3')?.textContent || '',
    support: document.querySelector('#scenarioDetail .badge')?.textContent || '',
    steps: document.querySelectorAll('[data-scstep]').length,
    lab: !!document.querySelector('#scenarioDetail [data-lab="office"]')
  })`)
  check('场景 D 渲染与支持度标注', /办公/.test(scenario.title) && scenario.steps >= 5, `${scenario.title} · ${scenario.support}`)
  check('场景 → 3D 实验室入口', scenario.lab)

  // 事件过滤
  await goto('events')
  const ev = await evaluate(`(() => {
    const input = document.querySelector('[data-eq]');
    if (!input) return { ok: false };
    input.value = 'assistant';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: true };
  })()`)
  await sleep(320)
  const evState = await evaluate(`({ rows: document.querySelectorAll('[data-ev]').length, chains: document.querySelectorAll('[data-chain]').length })`)
  check('事件矩阵搜索', ev.ok && evState.rows > 0, `${evState.rows} 行 / ${evState.chains} 链`)

  // 全局搜索
  const gs = await evaluate(`(() => {
    const input = document.querySelector('#globalSearch');
    input.focus();
    input.value = 'Cordis';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`)
  await sleep(260)
  const gsState = await evaluate(`({ rows: document.querySelectorAll('#searchPop .search-pop__row').length, shown: !document.querySelector('#searchPop').classList.contains('hidden') })`)
  check('全局搜索弹出结果', gs && gsState.shown && gsState.rows > 0, `${gsState.rows} 条`)

  // 主题切换
  const theme = await evaluate(`(() => {
    document.querySelector('#themeBtn').click();
    return document.documentElement.getAttribute('data-theme');
  })()`)
  check('主题切换', theme === 'light' || theme === 'dark', theme)
  await evaluate(`document.querySelector('#themeBtn').click()`)

  // 源码索引：切到「代码片段」再打开
  await goto('sources')
  const src = await evaluate(`(() => {
    const tab = document.querySelector('[data-stab="snippets"]');
    if (!tab) return { ok: false, reason: 'no tab' };
    tab.click();
    const btn = document.querySelector('[data-ex]');
    if (!btn) return { ok: false, reason: 'no excerpt card' };
    btn.click();
    return { ok: true, code: !!document.querySelector('.inspector .code') };
  })()`)
  check('源码片段面板', src.ok && src.code)

  // 进度持久化
  await goto('progress')
  const progress = await evaluate(`(() => {
    const box = document.querySelector('[data-page-check]');
    if (!box) return { ok: false };
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    const saved = JSON.parse(localStorage.getItem('dsh-lab:progress') || '{}');
    return { ok: true, checks: saved.checks || {}, visited: (saved.visited || []).length };
  })()`)
  check('学习进度写入 localStorage', progress.ok && progress.visited >= 13, `${progress.visited} 个已访问`)

  // ---------- 移动端 390px ----------
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  let mobileOverflow = []
  for (const [page, params] of pages) {
    const state = await goto(page, params)
    if (state.overflow) mobileOverflow.push(page)
  }
  check('390px 无横向滚动', mobileOverflow.length === 0, mobileOverflow.join(', ') || '全部通过')

  await goto('architecture')
  const mobileInspector = await evaluate(`(() => {
    const node = document.querySelector('.g-node');
    if (!node) return { ok: false, reason: 'no node' };
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const insp = document.querySelector('#inspector');
    const open = document.querySelector('.shell').classList.contains('has-inspector');
    const rect = insp.getBoundingClientRect();
    const fits = rect.right <= window.innerWidth + 1 && rect.width <= window.innerWidth;
    insp.querySelector('[data-close-inspector]')?.click();
    const closed = !document.querySelector('.shell').classList.contains('has-inspector');
    return { ok: open && fits && closed, open, fits, width: Math.round(rect.width), closed };
  })()`)
  check('390px 节点详情以覆盖层打开并可关闭', mobileInspector.ok,
    `打开 ${mobileInspector.open} · 宽度 ${mobileInspector.width} · 关闭 ${mobileInspector.closed}`)

  await goto('home')
  await shot('mobile-home.png')

  await evaluate(`location.hash = '#/execution-lab?scenario=ask'`)
  await sleep(700)
  const mobileLab = await evaluate(`(() => {
    const stage = document.querySelector('.lab-stage');
    const rect = stage ? stage.getBoundingClientRect() : null;
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      lab: !!document.querySelector('.lab'),
      tags: document.querySelectorAll('.lab-tag').length,
      stageH: rect ? Math.round(rect.height) : 0,
      panel: !!document.querySelector('.lab-panel__head'),
      deck: !!document.querySelector('.lab-deck')
    };
  })()`)
  check('390px 实验室可用（无横向滚动）', mobileLab.lab && !mobileLab.overflow && mobileLab.stageH >= 280 && mobileLab.panel && mobileLab.deck,
    `舞台 ${mobileLab.stageH}px · ${mobileLab.tags} 标签`)
  await shot('mobile-lab.png')

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

  // ---------- 汇总 ----------
  const indexSize = fs.statSync(path.join(ROOT, 'index.html')).size
  const remote = await evaluate(`performance.getEntriesByType('resource').filter(r => /^https?:/.test(r.name)).map(r => r.name)`)
  check('运行时零外部请求', remote.length === 0, `${remote.length} 个`)
  check('控制台无错误', consoleErrors.length === 0 && pageErrors.length === 0, `${consoleErrors.length} console / ${pageErrors.length} exception`)
  check('无失败请求', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '))

  const report = {
    generatedAt: new Date().toISOString(),
    url: URL,
    chrome: CHROME,
    gpu: { renderer: gpu.renderer, vendor: gpu.vendor || '', software: /swiftshader|software|llvmpipe/i.test(gpu.renderer || '') },
    size: { indexHtml: indexSize, indexHtmlMB: Number((indexSize / 1024 / 1024).toFixed(2)) },
    stats,
    checks,
    consoleErrors,
    pageErrors,
    failedRequests,
    screenshots,
    passed: checks.filter(c => c.ok).length,
    failed: checks.filter(c => !c.ok).length,
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))

  console.log(`\n${report.passed} passed, ${report.failed} failed`)
  console.log(`gpu: ${gpu.renderer}`)
  if (report.failed > 0) process.exitCode = 1
} catch (error) {
  const report = {
    generatedAt: new Date().toISOString(),
    fatal: String(error && error.stack || error),
    checks,
    consoleErrors,
    pageErrors,
    failedRequests,
    screenshots,
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.error('QA fatal:', error)
  process.exitCode = 1
} finally {
  try { ws.close() } catch { /* ignore */ }
  chrome.kill()
  let removed = false
  for (let i = 0; i < 20 && !removed; i++) {
    await sleep(300)
    try {
      fs.rmSync(PROFILE, { recursive: true, force: true })
      removed = true
    } catch { /* Chrome may still hold the profile for a moment */ }
  }
  if (!removed) console.warn('warning: could not remove .chrome-qa (Chrome still holds it); it is gitignored')
}
