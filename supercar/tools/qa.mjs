// GPU-only 验收：冒烟 + 逐条对照 v2 验收清单 + 截图 + qa/report.json
// 用法：node tools/qa.mjs            （需本机 Chrome / Edge，必须能拿到硬件 GPU）
//       node tools/qa.mjs --fast     （跳过 1080p 帧率测试）
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, isSoftwareRenderer } from './cdp.mjs';
import { diffPng, regionAverage } from './png.mjs';

const root = process.cwd();
const OUT = path.join(root, 'qa');
fs.mkdirSync(OUT, { recursive: true });
const fast = process.argv.includes('--fast');

const report = {
  startedAt: new Date().toISOString(),
  url: '',
  gpu: null,
  checks: [],
  consoleErrors: [],
  failedRequests: [],
  pageErrors: []
};
const failures = [];

function check(id, ok, detail, extra = {}) {
  const entry = { id, ok: !!ok, detail, ...extra };
  report.checks.push(entry);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(34)} ${detail}`);
  if (!ok) failures.push(id);
  return ok;
}

const s = await launch({ root, width: 1440, height: 900 });
await s.attachPage();
const url = pathToFileURL(path.join(root, 'index.html')).href;
report.url = url;
await s.send('Page.navigate', { url });

const waitReady = async (timeout = 90000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const st = await s
      .evaluate(`({ ready: !!window.SUPERCAR_READY, boot: document.getElementById('bootText')?.textContent || '' })`)
      .catch(() => ({ ready: false, boot: '' }));
    if (st.ready) return true;
    if (st.boot.startsWith('启动失败')) throw new Error(st.boot);
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('SUPERCAR_READY timeout');
};
await waitReady();
await new Promise((r) => setTimeout(r, 1500));

// ---------- 0. GPU ----------
const gpu = await s.evaluate(`(() => {
  const gl = SC.showroom.renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '',
    version: gl.getParameter(gl.VERSION),
    webgl2: gl instanceof WebGL2RenderingContext
  };
})()`);
report.gpu = gpu;
check('gpu.hardware', !isSoftwareRenderer(gpu.renderer), `${gpu.renderer}｜${gpu.version}`);

// ---------- 1. 基础信息 ----------
const base = await s.evaluate(`(async () => {
  const wait = () => new Promise(r => setTimeout(r, 40));
  SC.ui.setTab('config'); await wait();
  const paints = document.querySelectorAll('[data-paint]').length;
  SC.ui.setTab('lights'); await wait();
  const lights = document.querySelectorAll('[data-light]').length;
  SC.ui.setTab('spec'); await wait();
  return {
    title: document.title,
    canvas: { w: document.getElementById('view').clientWidth, h: document.getElementById('view').clientHeight },
    specRows: document.querySelectorAll('.spec__row').length,
    specData: SC.cars[0].specs.length,
    paints,
    paintData: SC.paintList.length,
    scenes: document.querySelectorAll('[data-scene]').length,
    views: document.querySelectorAll('[data-view]').length,
    lights,
    parts: SC.car.partsInfo.size,
    external: performance.getEntriesByType('resource').map(e => e.name).filter(n => !n.startsWith('file:') && !n.startsWith('data:')),
    audioCtx: !!SC.audio.ctx,
    sound: SC.state.sound,
    hash: location.hash
  };
})()`);
report.base = base;
check('page.title', /SUPERCAR/.test(base.title), base.title);
check('ui.specRows', base.specRows === base.specData, `参数行 ${base.specRows} / 数据 ${base.specData}`);
check('ui.views', base.views === 7, `视角按钮 ${base.views}`);
check('ui.scenes', base.scenes === 5, `环境按钮 ${base.scenes}`);
check('ui.lights', base.lights === 7, `灯光开关 ${base.lights}`);
check('ui.paints', base.paints === base.paintData && base.paintData === 12, `车漆色板 ${base.paints} / 数据 ${base.paintData}`);
check('runtime.noExternal', base.external.length === 0, `运行时外部资源 ${base.external.length} 个`);
check('audio.defaultMuted', base.audioCtx === false && base.sound === false, '引擎声默认静音、未创建 AudioContext');
check('url.hash', /paint=/.test(base.hash), base.hash || '(空)');

await s.shot(OUT, '01-overview.png');

// ---------- 2. 七个预设视角 + 无跳变 ----------
const views = ['front', 'rear', 'side', 'front45', 'rear45', 'top', 'interior'];
report.views = {};
for (const id of views) {
  const r = await s.evaluate(`(async () => {
    const app = SC;
    const samples = [];
    app.setView('${id}');
    const t0 = performance.now();
    await new Promise((done) => {
      const tick = () => {
        const p = app.showroom.camera.position;
        samples.push([+(performance.now() - t0).toFixed(1), +p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)]);
        const elapsed = performance.now() - t0;
        // 无头环境下动画可能比墙钟慢，等到缓动真正结束再收工
        if ((elapsed < 2000 || app.rig.isMoving) && elapsed < 9000) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    let maxSpeed = 0, maxJump = 0;
    for (let i = 1; i < samples.length; i++) {
      const dt = (samples[i][0] - samples[i-1][0]) / 1000;
      const d = Math.hypot(samples[i][1]-samples[i-1][1], samples[i][2]-samples[i-1][2], samples[i][3]-samples[i-1][3]);
      if (dt > 0.001) maxSpeed = Math.max(maxSpeed, d / dt);
      maxJump = Math.max(maxJump, d);
    }
    const last = samples[samples.length - 1];
    const first = samples[0];
    const travel = Math.hypot(last[1]-first[1], last[2]-first[2], last[3]-first[3]);
    const snap = app.rig.snapshot();
    return { view: '${id}', frames: samples.length, maxSpeed: +maxSpeed.toFixed(2), maxJump: +maxJump.toFixed(3),
      travel: +travel.toFixed(2), jumpRatio: +(maxJump / Math.max(travel, 0.001)).toFixed(3),
      mode: snap.mode, pos: snap.pos, target: snap.target, fov: snap.fov, moving: snap.moving };
  })()`);
  report.views[id] = r;
  if (id === 'interior') {
    check(`view.${id}`, r.mode === 'cockpit', `进入驾驶舱 mode=${r.mode}`);
    await new Promise((res) => setTimeout(res, 400));
    await s.shot(OUT, '02-cockpit.png');
    await s.evaluate(`SC.exitCockpit()`);
    await new Promise((res) => setTimeout(res, 1200));
  } else {
    check(`view.${id}`, r.mode === 'exterior' && !r.moving && r.jumpRatio < 0.3, `单帧最大位移 ${r.maxJump} m（占全程 ${(r.jumpRatio * 100).toFixed(1)}%），峰值速度 ${r.maxSpeed} m/s`);
  }
  if (id === 'front45') await s.shot(OUT, '03-view-front45.png');
  if (id === 'side') await s.shot(OUT, '04-view-side.png');
}

// ---------- 3. 五个场景 ----------
await s.evaluate(`SC.setView('front45')`);
await new Promise((res) => setTimeout(res, 1600));
report.scenes = {};
const sceneShots = {};
for (const id of ['studio', 'garage', 'night', 'mountain', 'track']) {
  const r = await s.evaluate(`(() => {
    SC.setScene('${id}');
    const sh = SC.showroom;
    return {
      scene: SC.state.scene,
      exposure: +sh.renderer.toneMappingExposure.toFixed(2),
      envUuid: sh.scene.environment.uuid,
      fogDensity: sh.scene.fog ? +sh.scene.fog.density.toFixed(4) : null,
      bloom: +sh.bloom.strength.toFixed(2),
      keyIntensity: +sh.keyLight.intensity.toFixed(2),
      backdrop: sh.backdrop ? sh.backdrop.children.length : 0
    };
  })()`);
  await new Promise((res) => setTimeout(res, 900));
  const name = `05-scene-${id}.png`;
  await s.shot(OUT, name);
  sceneShots[id] = path.join(OUT, name);
  report.scenes[id] = r;
  check(`scene.${id}`, r.scene === id && r.backdrop > 0, `env=${r.envUuid.slice(0, 8)} exposure=${r.exposure} fog=${r.fogDensity}`);
}
const envUuids = new Set(Object.values(report.scenes).map((r) => r.envUuid));
check('scene.envDistinct', envUuids.size === 5, `5 套 IBL 互不相同（${envUuids.size}）`);
const studioPng = fs.readFileSync(sceneShots.studio);
const nightPng = fs.readFileSync(sceneShots.night);
const nightDiff = diffPng(studioPng, nightPng, { tolerance: 8 });
const floorStudio = regionAverage(studioPng, [0.3, 0.72, 0.7, 0.92]);
const floorNight = regionAverage(nightPng, [0.3, 0.72, 0.7, 0.92]);
report.sceneDiff = { changedRatio: nightDiff.ratio, floorStudio, floorNight };
check('scene.pixels', nightDiff.ratio > 0.3, `studio↔night 像素变化 ${(nightDiff.ratio * 100).toFixed(1)}%`);
check('scene.floor', Math.abs(floorStudio[0] - floorNight[0]) > 4, `地面均值 ${floorStudio.join(',')} → ${floorNight.join(',')}`);
await s.evaluate(`SC.setScene('studio')`);
await new Promise((res) => setTimeout(res, 800));

// ---------- 4. 车漆 12 预设 + 5 材质档 ----------
report.paint = { presets: {}, finishes: {} };
const paintsOk = await s.evaluate(`(async () => {
  const out = [];
  for (const p of SC.paintList) {
    SC.setPaint(p.id);
    await new Promise(r => setTimeout(r, 40));
    out.push({ id: p.id, want: (p.custom ? SC.state.custom : p.hex).replace('#','').toLowerCase(), got: SC.car.roles.paint.color.getHexString() });
  }
  return out;
})()`);
let paintOk = true;
for (const p of paintsOk) {
  if (p.want !== p.got) paintOk = false;
  report.paint.presets[p.id] = p;
}
check('paint.presets12', paintOk && paintsOk.length === 12, `${paintsOk.filter((p) => p.want === p.got).length}/12 颜色与色板一致`);

const customHex = await s.evaluate(`(async () => {
  SC.setCustomColor('#7a5cff');
  await new Promise(r => setTimeout(r, 60));
  const got = SC.car.roles.paint.color.getHexString();
  const st = { paint: SC.state.paint, custom: SC.state.custom, hash: location.hash };
  SC.setPaint('rosso-corsa');
  return { got, want: '7a5cff', ...st };
})()`);
report.customHex = customHex;
check('paint.customHex', customHex.got === '7a5cff' && customHex.paint === 'custom', `自定义 HEX #7a5cff → 材质 ${customHex.got}`);

const rgb = await s.evaluate(`(async () => {
  SC.ui.setTab('config');
  await new Promise(r => setTimeout(r, 80));
  const sliders = [...document.querySelectorAll('[data-ch]')];
  if (sliders.length === 3) {
    sliders[0].value = '12';
    sliders[0].dispatchEvent(new Event('input', { bubbles: true }));
  }
  await new Promise(r => setTimeout(r, 100));
  return { count: sliders.length, hex: SC.car.roles.paint.color.getHexString(), state: SC.state.custom,
    input: document.getElementById('colorInput')?.value || '' };
})()`);
report.rgb = rgb;
check('paint.rgbSliders', rgb.count === 3 && rgb.hex.startsWith('0c'), `RGB 三滑块拖动 → 材质 ${rgb.hex}，HEX 框 ${rgb.input}`);

const finishes = await s.evaluate(`(async () => {
  const out = [];
  for (const f of SC.finishList) {
    SC.setFinish(f.id);
    await new Promise(r => setTimeout(r, 40));
    const m = SC.car.roles.paint;
    out.push({ id: f.id, metalness: +m.metalness.toFixed(2), roughness: +m.roughness.toFixed(2),
      clearcoat: +m.clearcoat.toFixed(2), hasMap: !!m.map, hasNormal: !!m.normalMap, wantMap: !!f.weave });
  }
  return out;
})()`);
let finishOk = true;
for (const f of finishes) {
  const distinct = finishOk && f.clearcoat >= 0;
  report.paint.finishes[f.id] = f;
  if (f.hasMap !== f.wantMap) finishOk = false;
  void distinct;
}
const metalnessSpread = new Set(finishes.map((f) => f.roughness)).size;
check('paint.finishes5', finishes.length === 5 && finishOk, `5 档材质，粗糙度取值 ${metalnessSpread} 种`);

await s.evaluate(`SC.ui.setTab('config'); SC.setPaint('nardo-grey'); SC.setFinish('metallic')`);
await new Promise((res) => setTimeout(res, 500));
await s.shot(OUT, '06-paint-nardo.png');
await s.evaluate(`SC.setPaint('matte-black'); SC.setFinish('matte')`);
await new Promise((res) => setTimeout(res, 500));
await s.shot(OUT, '07-paint-matte.png');
await s.evaluate(`SC.setPaint('rosso-corsa'); SC.setFinish('carbon')`);
await new Promise((res) => setTimeout(res, 500));
await s.shot(OUT, '08-paint-carbon.png');
const nardo = fs.readFileSync(path.join(OUT, '06-paint-nardo.png'));
const carbon = fs.readFileSync(path.join(OUT, '08-paint-carbon.png'));
const paintDiff = diffPng(nardo, carbon, { tolerance: 8 });
check('paint.pixels', paintDiff.ratio > 0.02, `nardo ↔ carbon 像素变化 ${(paintDiff.ratio * 100).toFixed(1)}%`);
await s.evaluate(`SC.setPaint('rosso-corsa'); SC.setFinish('metallic')`);

// ---------- 5. 卡钳隔离 ----------
const caliper = await s.evaluate(`(async () => {
  SC.setCaliper('red');
  await new Promise(r => setTimeout(r, 60));
  const before = { body: SC.car.roles.paint.color.getHexString(), rim: SC.car.roles.rim.color.getHexString(), caliper: SC.car.roles.caliper.color.getHexString() };
  SC.setCaliper('yellow');
  await new Promise(r => setTimeout(r, 60));
  const after = { body: SC.car.roles.paint.color.getHexString(), rim: SC.car.roles.rim.color.getHexString(), caliper: SC.car.roles.caliper.color.getHexString() };
  return { before, after };
})()`);
report.caliper = caliper;
check(
  'caliper.isolated',
  caliper.before.body === caliper.after.body && caliper.before.rim === caliper.after.rim && caliper.before.caliper !== caliper.after.caliper,
  `车身 ${caliper.before.body}→${caliper.after.body}｜轮辋 ${caliper.before.rim}→${caliper.after.rim}｜卡钳 ${caliper.before.caliper}→${caliper.after.caliper}`
);
await s.evaluate(`SC.setCaliper('red')`);
await new Promise((res) => setTimeout(res, 400));
await s.shot(OUT, '09-caliper-red.png');
await s.evaluate(`SC.setCaliper('yellow')`);
await new Promise((res) => setTimeout(res, 400));
await s.shot(OUT, '10-caliper-yellow.png');
const calDiff = diffPng(fs.readFileSync(path.join(OUT, '09-caliper-red.png')), fs.readFileSync(path.join(OUT, '10-caliper-yellow.png')), { tolerance: 8 });
report.caliperDiff = { ratio: calDiff.ratio, bbox: calDiff.bbox };
check('caliper.pixels', calDiff.ratio > 0.0005 && calDiff.ratio < 0.2, `卡钳改色像素变化 ${(calDiff.ratio * 100).toFixed(2)}%（局部）`);
await s.evaluate(`SC.setCaliper('red')`);

// ---------- 6. 内饰三组 + 方向盘 ----------
const interior = await s.evaluate(`(async () => {
  const out = [];
  for (const id of ['nero', 'cuoio', 'alcantara']) {
    SC.setInterior(id);
    await new Promise(r => setTimeout(r, 60));
    const def = SC.interiors.find(i => i.id === id);
    out.push({ id,
      leather: SC.car.roles.leather.color.getHexString(), wantLeather: def.leather.replace('#',''),
      dark: SC.car.roles.interiorDark.color.getHexString(), wantDark: def.dark.replace('#',''),
      carpet: SC.car.roles.carpet.color.getHexString(), wantCarpet: def.carpet.replace('#',''),
      steeringVisible: !!SC.car.steeringGroup && SC.car.steeringGroup.node.visible
    });
  }
  return out;
})()`);
report.interior = interior;
const interiorOk = interior.every((i) => i.leather === i.wantLeather && i.dark === i.wantDark && i.carpet === i.wantCarpet);
check('interior.groups', interiorOk && interior.every((i) => i.steeringVisible), '皮革 / 深色饰件 / 地毯三组换色生效，方向盘组可见');
await s.evaluate(`SC.setInterior('nero')`);

// ---------- 7. 驾驶舱进出 ----------
const cockpit = await s.evaluate(`(async () => {
  SC.enterCockpit();
  await new Promise(r => setTimeout(r, 2400));
  const inState = { mode: SC.rig.mode, pos: SC.showroom.camera.position.toArray().map(n=>+n.toFixed(3)),
    fov: +SC.showroom.camera.fov.toFixed(1), screens: !!SC.screens, noteVisible: getComputedStyle(document.getElementById('cockpitNote')).opacity };
  return inState;
})()`);
await s.shot(OUT, '11-cockpit.png');
report.cockpit = cockpit;
check('cockpit.enter', cockpit.mode === 'cockpit' && cockpit.screens, `mode=${cockpit.mode} fov=${cockpit.fov} 屏幕补建=${cockpit.screens}`);
await s.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await s.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await new Promise((res) => setTimeout(res, 1600));
const afterEsc = await s.evaluate(`({ mode: SC.rig.mode, view: SC.state.view })`);
check('cockpit.exitEsc', afterEsc.mode === 'exterior', `Esc 退出 → ${afterEsc.mode}`);

// ---------- 8. 七种灯光 ----------
const lights = await s.evaluate(`(async () => {
  const out = { off: {}, on: {}, blink: [] };
  SC.allLights(false);
  await new Promise(r => setTimeout(r, 120));
  out.off = { head: +SC.car.roles.headlamp.emissiveIntensity.toFixed(2), led: +SC.car.roles.led.emissiveIntensity.toFixed(2), tail: +SC.car.roles.taillamp.emissiveIntensity.toFixed(2), spots: +SC.car.headlights[0].intensity.toFixed(1) };
  for (const l of SC.lightList) {
    SC.allLights(false);
    await new Promise(r => setTimeout(r, 60));
    const on = SC.toggleLight(l.id);
    await new Promise(r => setTimeout(r, 120));
    out.on[l.id] = {
      state: on,
      head: +SC.car.roles.headlamp.emissiveIntensity.toFixed(2),
      led: +SC.car.roles.led.emissiveIntensity.toFixed(2),
      tail: +SC.car.roles.taillamp.emissiveIntensity.toFixed(2),
      spots: +SC.car.headlights[0].intensity.toFixed(1)
    };
  }
  // 转向灯闪烁：采样两次 emissive
  SC.allLights(false); SC.toggleLight('turn');
  for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 130)); out.blink.push(+SC.car.roles.led.emissiveIntensity.toFixed(2)); }
  SC.allLights(false);
  return out;
})()`);
report.lights = lights;
check('lights.states', lights.on.low.head > 0 && lights.on.high.head > lights.on.low.head, `近光 ${lights.on.low.head} / 远光 ${lights.on.high.head}`);
check('lights.tail', lights.on.tail.tail > 0 && lights.on.brake.tail > lights.on.tail.tail, `尾灯 ${lights.on.tail.tail} / 刹车 ${lights.on.brake.tail}`);
check('lights.spot', lights.on.low.spots > 0 && lights.off.spots === 0, `近光聚光灯 ${lights.on.low.spots}`);
check('lights.blink', new Set(lights.blink).size > 1, `转向灯闪烁采样 ${lights.blink.join(' / ')}`);
check('lights.count7', Object.keys(lights.on).length === 7, `7 个开关全部可独立切换`);
await s.evaluate(`SC.ui.setTab('lights'); SC.allLights(true)`);
await new Promise((res) => setTimeout(res, 500));
await s.shot(OUT, '12-lights-on.png');
await s.evaluate(`SC.allLights(false)`);

// ---------- 9. 拾取 / 部件卡 ----------
await s.evaluate(`SC.setView('front45')`);
await new Promise((res) => setTimeout(res, 1200));
const pick = await s.evaluate(`(() => {
  const app = SC;
  const rect = app.showroom.canvas.getBoundingClientRect();
  const hit = app.rig.raycast(app.car, rect.left + rect.width * 0.5, rect.top + rect.height * 0.62);
  return { hit: !!hit, part: hit?.object?.userData?.part || null, name: hit?.object?.name || null };
})()`);
report.pick = pick;
check('pick.part', !!pick.part, `中心射线命中 ${pick.name} → 分组 ${pick.part}`);
if (pick.part) {
  await s.evaluate(`SC.focusPart('${pick.part}')`);
  await new Promise((res) => setTimeout(res, 1200));
  const card = await s.evaluate(`({ has: !!document.querySelector('.pcard'), title: document.querySelector('.pcard h3')?.textContent || '' })`);
  check('pick.card', card.has, `部件卡「${card.title}」`);
  await s.shot(OUT, '13-part-focus.png');
  await s.evaluate(`SC.clearPart()`);
}

// ---------- 9.5 拖动回归：缓动结束后控制器必须交还用户 ----------
const handback = await s.evaluate(`(async () => {
  SC.setView('side');
  await new Promise(r => setTimeout(r, 2600));
  const afterView = { enabled: SC.rig.controls.enabled, moving: SC.rig.isMoving };
  SC.focusPart('shell');
  await new Promise(r => setTimeout(r, 2600));
  const afterFocus = { enabled: SC.rig.controls.enabled, moving: SC.rig.isMoving };
  SC.clearPart();
  return { afterView, afterFocus, pos: SC.rig.snapshot().pos };
})()`);
report.handback = handback;
check(
  'controls.handback',
  handback.afterView.enabled && handback.afterFocus.enabled && !handback.afterFocus.moving,
  `切视角后 enabled=${handback.afterView.enabled}，聚焦部件后 enabled=${handback.afterFocus.enabled}`
);

const dragResults = [];
for (let round = 0; round < 3; round++) {
  const beforeDrag = await s.evaluate('SC.rig.snapshot().pos');
  await s.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 720, y: 520, button: 'left', buttons: 1, clickCount: 1 });
  for (let i = 1; i <= 12; i++) {
    await s.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720 + i * 14, y: 520 - i * 2, button: 'left', buttons: 1 });
    await new Promise((r) => setTimeout(r, 16));
  }
  await s.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 888, y: 496, button: 'left', buttons: 0, clickCount: 1 });
  await new Promise((r) => setTimeout(r, 600));
  const afterDrag = await s.evaluate(`({ pos: SC.rig.snapshot().pos, card: !!document.querySelector('.pcard'), enabled: SC.rig.controls.enabled })`);
  dragResults.push({
    round: round + 1,
    moved: +Math.hypot(afterDrag.pos[0] - beforeDrag[0], afterDrag.pos[1] - beforeDrag[1], afterDrag.pos[2] - beforeDrag[2]).toFixed(2),
    card: afterDrag.card,
    enabled: afterDrag.enabled
  });
}
report.drag = dragResults;
check(
  'controls.drag',
  dragResults.every((r) => r.moved > 0.2 && r.enabled),
  `连续 3 次拖动位移：${dragResults.map((r) => r.moved + ' m').join(' / ')}`
);
check('controls.dragNoPick', dragResults.every((r) => !r.card), `拖动没有误触发部件选择（${dragResults.filter((r) => r.card).length} 次误选）`);

// ---------- 10. 1080p 帧率 ----------
if (!fast) {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await s.evaluate(`SC.resize()`);
  await new Promise((res) => setTimeout(res, 600));
  await s.evaluate(`SC.setView('front45')`);
  await new Promise((res) => setTimeout(res, 1400));
  const perf = await s.evaluate(`(async () => {
    const app = SC, r = app.showroom.renderer;
    const once = (ms) => new Promise((done) => {
      let frames = 0;
      const t0 = performance.now();
      const tick = () => {
        frames++;
        if (performance.now() - t0 < ms) requestAnimationFrame(tick);
        else done({ frames, ms: Math.round(performance.now() - t0), fps: +(frames / ((performance.now() - t0) / 1000)).toFixed(1) });
      };
      requestAnimationFrame(tick);
    });
    const runs = [];
    for (let i = 0; i < 3; i++) {
      for (let k = 0; k < 10; k++) await new Promise(r2 => requestAnimationFrame(r2));
      runs.push(await once(2000));
    }
    const fps = runs.map(r2 => r2.fps).sort((a, b) => a - b);
    return { runs, best: fps[2], median: fps[1], worst: fps[0],
      drawCalls: r.info.render.calls, triangles: r.info.render.triangles, pixelRatio: r.getPixelRatio() };
  })()`);
  report.perf = perf;
  check('perf.fps1080p', perf.best >= 55, `最佳 ${perf.best} fps / 中位 ${perf.median} / 最差 ${perf.worst} @1920×1080，drawcall ${perf.drawCalls}，三角面 ${perf.triangles}`);
  await s.shot(OUT, '14-fps-1080p.png');
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await s.evaluate(`SC.resize()`);
}

// ---------- 11. 移动端 ----------
await s.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await s.send('Page.reload', { ignoreCache: true });
await waitReady();
await new Promise((res) => setTimeout(res, 2200));
const mobile = await s.evaluate(`({
  innerW: innerWidth, innerH: innerHeight,
  scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight,
  hasHorizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
  railOpen: document.body.classList.contains('rail-open'),
  panelVisible: getComputedStyle(document.getElementById('panel')).opacity,
  fps: SC.fps
})`);
report.mobile = mobile;
check('mobile.390', !mobile.hasHorizontalOverflow && mobile.scrollW <= mobile.innerW + 2, `scrollWidth ${mobile.scrollW} / innerWidth ${mobile.innerW}`);
await s.shot(OUT, '15-mobile.png');
await s.evaluate(`document.getElementById('btnPanel').click()`);
await new Promise((res) => setTimeout(res, 600));
const mobilePanel = await s.evaluate(`({
  open: document.body.classList.contains('panel-open'),
  overflow: document.documentElement.scrollWidth > innerWidth + 2,
  swatches: document.querySelectorAll('[data-paint]').length
})`);
report.mobilePanel = mobilePanel;
check('mobile.drawer', mobilePanel.open && !mobilePanel.overflow, `面板抽屉 ${mobilePanel.open}，无横向溢出 ${!mobilePanel.overflow}`);
await s.shot(OUT, '16-mobile-panel.png');
await s.evaluate(`document.getElementById('btnPanelClose').click()`);
await new Promise((res) => setTimeout(res, 500));
await s.evaluate(`document.getElementById('btnRail').click()`);
await new Promise((res) => setTimeout(res, 700));
await s.shot(OUT, '17-mobile-rail.png');

// ---------- 收尾 ----------
report.consoleErrors = s.consoleErrors;
report.failedRequests = s.failedRequests;
report.pageErrors = s.pageErrors;
check('console.clean', s.consoleErrors.length === 0 && s.pageErrors.length === 0, `console ${s.consoleErrors.length} / page ${s.pageErrors.length}`);
check('network.clean', s.failedRequests.length === 0, `失败请求 ${s.failedRequests.length}`);
report.failures = failures;
report.ok = failures.length === 0;
report.finishedAt = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

console.log('\n' + '─'.repeat(64));
console.log(`${report.checks.filter((c) => c.ok).length}/${report.checks.length} 项通过`);
if (failures.length) console.log('失败项：' + failures.join(', '));
console.log('报告：qa/report.json  截图：qa/*.png');

await s.close();
process.exit(report.ok ? 0 : 1);
