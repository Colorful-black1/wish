// 极简 PNG 解码（8-bit、非隔行，颜色类型 0/2/4/6）+ 图像差分。
// 只用于 QA 截图对比，不追求完整性。
import zlib from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let off = 8;
  let width = 0;
  let height = 0;
  let depth = 8;
  let colorType = 6;
  let interlace = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (depth !== 8) throw new Error('unsupported bit depth ' + depth);
  if (interlace !== 0) throw new Error('interlaced png unsupported');
  const ch = CHANNELS[colorType];
  if (!ch) throw new Error('unsupported color type ' + colorType);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      cur[x] = v & 255;
    }
  }
  return { width, height, channels: ch, data: out };
}

/** 两张同尺寸截图的差异比例；tolerance 为单通道容差。 */
export function diffPng(bufA, bufB, { tolerance = 10, region = null } = {}) {
  const a = decodePng(bufA);
  const b = decodePng(bufB);
  if (a.width !== b.width || a.height !== b.height) throw new Error('size mismatch');
  const x0 = region ? Math.round(region[0] * a.width) : 0;
  const y0 = region ? Math.round(region[1] * a.height) : 0;
  const x1 = region ? Math.round(region[2] * a.width) : a.width;
  const y1 = region ? Math.round(region[3] * a.height) : a.height;
  let changed = 0;
  let total = 0;
  let sumA = [0, 0, 0];
  let sumB = [0, 0, 0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const ia = (y * a.width + x) * a.channels;
      const ib = (y * b.width + x) * b.channels;
      total++;
      sumA[0] += a.data[ia];
      sumA[1] += a.data[ia + 1];
      sumA[2] += a.data[ia + 2];
      sumB[0] += b.data[ib];
      sumB[1] += b.data[ib + 1];
      sumB[2] += b.data[ib + 2];
      const d =
        Math.abs(a.data[ia] - b.data[ib]) + Math.abs(a.data[ia + 1] - b.data[ib + 1]) + Math.abs(a.data[ia + 2] - b.data[ib + 2]);
      if (d > tolerance * 3) {
        changed++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const avg = (s) => s.map((v) => +(v / total).toFixed(2));
  return {
    width: a.width,
    height: a.height,
    changedPixels: changed,
    totalPixels: total,
    ratio: +(changed / total).toFixed(4),
    avgA: avg(sumA),
    avgB: avg(sumB),
    bbox: maxX >= 0 ? [minX, minY, maxX, maxY] : null
  };
}

/** 取某个区域的像素均值，用于判断画面整体亮度/色调变化。 */
export function regionAverage(buf, region) {
  const img = decodePng(buf);
  const x0 = Math.round(region[0] * img.width);
  const y0 = Math.round(region[1] * img.height);
  const x1 = Math.round(region[2] * img.width);
  const y1 = Math.round(region[3] * img.height);
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * img.channels;
      sum[0] += img.data[i];
      sum[1] += img.data[i + 1];
      sum[2] += img.data[i + 2];
      n++;
    }
  }
  return sum.map((v) => +(v / n).toFixed(2));
}
