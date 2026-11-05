// esbuild 打包：把 ESM 源码 + three/addons + GLB + Draco 解码器合成一个 IIFE。
// 资源（GLB / AO 贴图 / draco wasm 与 wrapper）在构建期读成 base64 文本，
// 通过虚拟模块 `virtual:assets` 注入，运行时不再有任何网络或文件请求。
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const MODEL_DIR = 'assets/models';
const DRACO_DIR = 'node_modules/three/examples/jsm/libs/draco/gltf';

function readB64(file) {
  return fs.readFileSync(file).toString('base64');
}

export function assetSizes(root = process.cwd()) {
  const glb = path.join(root, MODEL_DIR, 'ferrari.glb');
  const ao = path.join(root, MODEL_DIR, 'ferrari_ao.png');
  const wasm = path.join(root, DRACO_DIR, 'draco_decoder.wasm');
  const wrapper = path.join(root, DRACO_DIR, 'draco_wasm_wrapper.js');
  return {
    glb: fs.statSync(glb).size,
    ao: fs.statSync(ao).size,
    wasm: fs.statSync(wasm).size,
    wrapper: fs.statSync(wrapper).size
  };
}

export function assetsPlugin(root = process.cwd()) {
  return {
    name: 'virtual-assets',
    setup(build) {
      build.onResolve({ filter: /^virtual:assets$/ }, () => ({ path: 'virtual:assets', namespace: 'supercar-assets' }));
      build.onLoad({ filter: /.*/, namespace: 'supercar-assets' }, () => {
        const glb = readB64(path.join(root, MODEL_DIR, 'ferrari.glb'));
        const ao = readB64(path.join(root, MODEL_DIR, 'ferrari_ao.png'));
        const wasm = readB64(path.join(root, DRACO_DIR, 'draco_decoder.wasm'));
        const wrapper = fs.readFileSync(path.join(root, DRACO_DIR, 'draco_wasm_wrapper.js'), 'utf8');
        if (wrapper.includes('</script')) throw new Error('draco wrapper contains </script — needs escaping');
        const code = [
          `export const GLB_B64 = ${JSON.stringify(glb)};`,
          `export const AO_PNG_B64 = ${JSON.stringify(ao)};`,
          `export const DRACO_WASM_B64 = ${JSON.stringify(wasm)};`,
          `export const DRACO_WRAPPER_JS = ${JSON.stringify(wrapper)};`
        ].join('\n');
        return { contents: code, loader: 'js' };
      });
    }
  };
}

/** 打包 src/js/app.js → 一段可直接内联的 JS 文本。 */
export async function bundle({ root = process.cwd(), minify = true, logLevel = 'silent' } = {}) {
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['src/js/app.js'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome110', 'edge110'],
    minify,
    legalComments: 'none',
    write: false,
    metafile: true,
    sourcemap: false,
    plugins: [assetsPlugin(root)],
    logLevel
  });
  const out = result.outputFiles[0].text;
  return { code: out, metafile: result.metafile };
}

/** 按 npm 包归并「产物里」的字节数（bytesInOutput，而不是源文件体积）。 */
export function sizeByPackage(metafile) {
  const buckets = new Map();
  for (const out of Object.values(metafile.outputs || {})) {
    for (const [file, info] of Object.entries(out.inputs || {})) {
      let key = 'src';
      if (file.includes('node_modules/three/examples')) key = 'three/addons';
      else if (file.includes('node_modules/three')) key = 'three/core';
      else if (file.includes('node_modules/')) key = 'other-deps';
      if (file.startsWith('<') || file.includes('virtual')) key = 'virtual';
      buckets.set(key, (buckets.get(key) || 0) + (info.bytesInOutput || 0));
    }
  }
  return Object.fromEntries([...buckets.entries()].sort((a, b) => b[1] - a[1]));
}
