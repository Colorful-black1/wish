// One-off inspector: dump the GLB JSON chunk (nodes / meshes / materials / extensions).
// Usage: node tools/inspect-glb.mjs [path]
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2] || path.join(process.cwd(), 'assets/models/ferrari.glb');
const buf = fs.readFileSync(file);
const magic = buf.readUInt32LE(0);
if (magic !== 0x46546c67) throw new Error('not a glb');
const version = buf.readUInt32LE(4);
const total = buf.readUInt32LE(8);
let off = 12;
let json = null;
let binLen = 0;
while (off < buf.length) {
  const len = buf.readUInt32LE(off);
  const type = buf.readUInt32LE(off + 4);
  const body = buf.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));
  if (type === 0x004e4942) binLen = len;
  off += 8 + len + ((4 - (len % 4)) % 4);
}
console.log('glb version', version, 'bytes', total, 'bin', binLen);
console.log('extensionsUsed', json.extensionsUsed, 'required', json.extensionsRequired);
console.log('scenes', json.scenes?.length, 'nodes', json.nodes.length, 'meshes', json.meshes.length, 'materials', json.materials.length, 'textures', (json.textures || []).length, 'animations', (json.animations || []).length, 'skins', (json.skins || []).length);

const primStats = (m) => {
  let tris = 0;
  let verts = 0;
  for (const p of m.primitives) {
    const pos = json.accessors[p.attributes.POSITION];
    verts += pos.count;
    if (p.indices != null) tris += json.accessors[p.indices].count / 3;
    else tris += pos.count / 3;
  }
  return { tris: Math.round(tris), verts };
};
let totalTris = 0;
let totalVerts = 0;
json.meshes.forEach((m, i) => {
  const s = primStats(m);
  totalTris += s.tris;
  totalVerts += s.verts;
  console.log(`mesh[${i}] ${m.name || '(unnamed)'} prims=${m.primitives.length} tris=${s.tris} verts=${s.verts} mats=${m.primitives.map((p) => p.material)}`);
});
console.log('TOTAL tris', totalTris, 'verts', totalVerts);

console.log('\n--- materials ---');
json.materials.forEach((m, i) => {
  const p = m.pbrMetallicRoughness || {};
  console.log(
    `mat[${i}] ${m.name || '(unnamed)'} base=${p.baseColorFactor ? p.baseColorFactor.map((n) => +n.toFixed(3)).join(',') : '-'} metal=${p.metallicFactor} rough=${p.roughnessFactor} alpha=${m.alphaMode || 'OPAQUE'} tex=${p.baseColorTexture ? 'yes' : 'no'} ext=${Object.keys(m.extensions || {}).join('|') || '-'}`
  );
});

console.log('\n--- node tree ---');
const nodeName = (i) => `${i}:${json.nodes[i].name || '(unnamed)'}`;
const walk = (i, depth) => {
  const n = json.nodes[i];
  const bits = [];
  if (n.mesh != null) bits.push('mesh=' + n.mesh);
  if (n.children) bits.push('kids=' + n.children.length);
  console.log('  '.repeat(depth) + nodeName(i) + (bits.length ? '  [' + bits.join(' ') + ']' : ''));
  (n.children || []).forEach((c) => walk(c, depth + 1));
};
json.scenes[json.scene || 0].nodes.forEach((n) => walk(n, 0));

console.log('\n--- mesh -> primitive attribute keys ---');
json.meshes.forEach((m, i) => {
  const keys = new Set();
  m.primitives.forEach((p) => Object.keys(p.attributes).forEach((k) => keys.add(k)));
  console.log(`mesh[${i}] ${m.name || ''} attrs=${[...keys].join(',')}`);
});
