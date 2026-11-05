// 程序化材质与纹理。模型零贴图，所有表面质感都靠运行时生成：
// 车漆金属颗粒 / 清漆橘皮纹、4×4 斜纹碳纤维、皮革毛孔、翻毛皮、地毯、橡胶。
// 纹理全部用固定种子生成，保证每次构建、每次刷新看到的都一样。
import * as THREE from 'three';
import { rng, clamp } from './util.js';

const cache = new Map();
let anisotropy = 8;

/** 由画质档调用，限制程序化纹理的各向异性过滤。 */
export function setAnisotropy(n) {
  anisotropy = n;
  for (const tex of cache.values()) tex.anisotropy = n;
}

function remember(key, factory) {
  if (!cache.has(key)) {
    const tex = factory();
    tex.anisotropy = anisotropy;
    cache.set(key, tex);
  }
  return cache.get(key);
}

/** 细微法线：RGB 噪声围绕 (0.5,0.5,1)，用于车漆金属颗粒。 */
function flakeNormal(size, seed, strength) {
  const data = new Uint8Array(size * size * 4);
  const rand = rng(seed);
  for (let i = 0; i < size * size; i++) {
    const n = i * 4;
    // 颗粒方向随机，强度集中在中央 ±strength
    const x = 128 + (rand() - 0.5) * 255 * strength;
    const y = 128 + (rand() - 0.5) * 255 * strength;
    data[n] = clamp(x, 0, 255);
    data[n + 1] = clamp(y, 0, 255);
    data[n + 2] = 255;
    data[n + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** 橘皮纹：低频起伏，贴在 clearcoat 法线上让高光边缘有细微抖动。 */
function orangePeelNormal(size, seed) {
  const rand = rng(seed);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      h[y * size + x] =
        0.55 * Math.sin(u * 3 + Math.cos(v * 2) * 1.7) +
        0.3 * Math.sin(v * 5 + Math.sin(u * 3) * 2.1) +
        0.15 * (rand() - 0.5);
    }
  }
  const data = new Uint8Array(size * size * 4);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 1.4;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 1.4;
      const n = (y * size + x) * 4;
      data[n] = clamp(128 + dx * 127, 0, 255);
      data[n + 1] = clamp(128 + dy * 127, 0, 255);
      data[n + 2] = 255;
      data[n + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** 4×4 斜纹碳纤维：返回 { map, bump }，两张图同源。 */
function carbonMaps() {
  const size = 256;
  const cell = 16;
  const cells = size / cell;
  const color = document.createElement('canvas');
  color.width = color.height = size;
  const ctx = color.getContext('2d');
  const bump = document.createElement('canvas');
  bump.width = bump.height = size;
  const bctx = bump.getContext('2d');
  ctx.fillStyle = '#101114';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#5a5a5a';
  bctx.fillRect(0, 0, size, size);
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      // 2×2 twill：按 (x+y) mod 4 决定经纬方向
      const twill = (cx + cy) % 4;
      const horizontal = twill === 0 || twill === 1;
      const x0 = cx * cell;
      const y0 = cy * cell;
      const g = ctx.createLinearGradient(x0, y0, horizontal ? x0 : x0 + cell, horizontal ? y0 + cell : y0);
      const dark = horizontal ? '#0b0c0e' : '#16181c';
      const light = horizontal ? '#2a2d33' : '#3a3e45';
      g.addColorStop(0, dark);
      g.addColorStop(0.5, light);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, cell, cell);

      const bg = bctx.createLinearGradient(x0, y0, horizontal ? x0 : x0 + cell, horizontal ? y0 + cell : y0);
      bg.addColorStop(0, '#3c3c3c');
      bg.addColorStop(0.5, '#c8c8c8');
      bg.addColorStop(1, '#3c3c3c');
      bctx.fillStyle = bg;
      bctx.fillRect(x0, y0, cell, cell);

      // 纤维丝
      ctx.strokeStyle = 'rgba(255,255,255,0.045)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 2; i < cell; i += 3) {
        if (horizontal) {
          ctx.moveTo(x0, y0 + i + 0.5);
          ctx.lineTo(x0 + cell, y0 + i + 0.5);
        } else {
          ctx.moveTo(x0 + i + 0.5, y0);
          ctx.lineTo(x0 + i + 0.5, y0 + cell);
        }
      }
      ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bump: bumpMap };
}

/** 皮革 / 翻毛皮 / 地毯：一张灰度噪声图兼作 bump 与 roughness 细节。 */
function grainCanvas(size, seed, { pores = 0, strength = 0.5, suede = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rand = rng(seed);
  for (let i = 0; i < size * size; i++) {
    const n = i * 4;
    let v = 128 + (rand() - 0.5) * 255 * strength;
    if (suede) v = 128 + (rand() - 0.5) * 255 * strength * 1.5;
    img.data[n] = img.data[n + 1] = img.data[n + 2] = clamp(v, 0, 255);
    img.data[n + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // 皮革毛孔
  for (let i = 0; i < pores; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.6 + rand() * 1.5;
    ctx.beginPath();
    ctx.fillStyle = `rgba(0,0,0,${0.18 + rand() * 0.25})`;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

function grainTexture(key, opts) {
  return remember(key, () => {
    const tex = new THREE.CanvasTexture(grainCanvas(256, opts.seed, opts));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  });
}

export function paintFlake() {
  return remember('flake', () => flakeNormal(256, 0x5f3a1c, 0.55));
}

export function clearcoatPeel() {
  return remember('peel', () => orangePeelNormal(128, 0x1d7f21));
}

export function carbonWeave() {
  if (!cache.has('carbon')) {
    const maps = carbonMaps();
    const out = { map: maps.map, bump: maps.bump };
    cache.set('carbon', out);
  }
  return cache.get('carbon');
}

export function leatherGrain() {
  return grainTexture('leather', { seed: 0x9ab31, pores: 900, strength: 0.34 });
}

export function suedeGrain() {
  return grainTexture('suede', { seed: 0x4c2d7, pores: 0, strength: 0.5, suede: true });
}

export function carpetGrain() {
  return grainTexture('carpet', { seed: 0x77aa3, pores: 0, strength: 0.85 });
}

export function rubberGrain() {
  return grainTexture('rubber', { seed: 0x2be41, pores: 0, strength: 0.3 });
}

/**
 * 车漆材质。finish 是 data.config.js 里 FINISHES 的一项。
 * 碳纤维档忽略车身色，直接铺编织花纹。
 */
export function makePaint(hex, finish) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(finish.weave ? '#ffffff' : hex),
    metalness: finish.metalness,
    roughness: finish.roughness,
    clearcoat: finish.clearcoat,
    clearcoatRoughness: finish.clearcoatRoughness,
    envMapIntensity: 1.05
  });
  mat.name = 'paint';
  if (finish.weave) {
    const weave = carbonWeave();
    mat.color.set('#4a4d52');
    mat.map = weave.map;
    mat.map.repeat.set(10, 10);
    mat.bumpMap = weave.bump;
    mat.bumpScale = 0.35;
    mat.roughness = 0.3;
    mat.metalness = 0.42;
  } else if (finish.flake > 0.05) {
    const flake = paintFlake();
    const f = flake.clone();
    f.needsUpdate = true;
    f.repeat.set(14, 14);
    mat.normalMap = f;
    // 只留极轻的颗粒，避免近距离出现「电视雪花」般的噪点
    mat.normalScale = new THREE.Vector2(finish.flake * 0.012, finish.flake * 0.012);
    mat.clearcoatNormalMap = clearcoatPeel();
    mat.clearcoatNormalMap.repeat.set(5, 5);
    mat.clearcoatNormalScale = new THREE.Vector2(0.035, 0.035);
  }
  if (finish.iridescence) {
    mat.iridescence = finish.iridescence;
    mat.iridescenceIOR = 1.32;
    mat.iridescenceThicknessRange = [120, 380];
  }
  mat.userData.finish = finish.id;
  return mat;
}

/** 玻璃：高画质用 transmission，低画质退回半透明。 */
export function makeGlass(mode) {
  if (mode === 'fake') {
    return new THREE.MeshPhysicalMaterial({
      color: '#9fb2c4',
      metalness: 0,
      roughness: 0.08,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      envMapIntensity: 1.2
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color: '#cfd8e2',
    metalness: 0,
    roughness: 0.045,
    transmission: 1,
    thickness: 0.02,
    ior: 1.5,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    envMapIntensity: 0.95,
    specularIntensity: 0.9
  });
}

export function makeChrome(color = '#c9ccd0', roughness = 0.12) {
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness, envMapIntensity: 1.4 });
}

export function makeDarkMetal(color = '#3b3e43', roughness = 0.42) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness, envMapIntensity: 1.1 });
}

export function makePlastic(color = '#161719', roughness = 0.62) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.25,
    roughness,
    clearcoat: 0.4,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.9
  });
}

export function makeRubber() {
  const mat = new THREE.MeshStandardMaterial({
    color: '#141516',
    metalness: 0.05,
    roughness: 0.92,
    envMapIntensity: 0.5
  });
  const grain = rubberGrain();
  mat.bumpMap = grain;
  mat.bumpScale = 0.08;
  mat.roughnessMap = grain;
  mat.roughness = 1;
  return mat;
}

/** 内饰皮革（或翻毛皮）。 */
export function makeLeather(hex, { suede = false, roughness = 0.52 } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: hex,
    metalness: 0.05,
    roughness: suede ? 0.94 : roughness,
    clearcoat: suede ? 0 : 0.28,
    clearcoatRoughness: 0.55,
    sheen: suede ? 0.5 : 0.15,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color(suede ? '#8a8a8a' : '#5a5a5a'),
    envMapIntensity: 0.8
  });
  const grain = suede ? suedeGrain() : leatherGrain();
  mat.bumpMap = grain;
  mat.bumpScale = suede ? 0.25 : 0.12;
  return mat;
}

export function makeCarpet(hex) {
  const mat = new THREE.MeshStandardMaterial({
    color: hex,
    metalness: 0,
    roughness: 0.95,
    envMapIntensity: 0.4
  });
  mat.bumpMap = carpetGrain();
  mat.bumpScale = 0.35;
  return mat;
}

/** 荧光灯罩：emissive 开关只改 emissiveIntensity，颜色保持不变。 */
export function makeLamp(color, emissive, { opacity = 1, transmission = 0 } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(emissive),
    emissiveIntensity: 0,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: opacity < 1,
    opacity,
    transmission,
    thickness: transmission ? 0.1 : 0
  });
  mat.userData.lamp = true;
  return mat;
}

export function disposeMaterialCache() {
  for (const v of cache.values()) {
    if (v && v.dispose) v.dispose();
    if (v && v.map) {
      v.map.dispose();
      v.bump.dispose();
    }
  }
  cache.clear();
}
