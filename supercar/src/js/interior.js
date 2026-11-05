// 驾驶舱补建件：模型没有仪表与中控屏的网格，这里用 Canvas 画好贴到自建平面上。
// 页面与 README 都标注「屏幕为程序化补建」，不冒充原厂内饰网格。
import * as THREE from 'three';

const CLUSTER_W = 1024;
const CLUSTER_H = 384;
const SCREEN_W = 512;
const SCREEN_H = 640;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCluster() {
  const canvas = document.createElement('canvas');
  canvas.width = CLUSTER_W;
  canvas.height = CLUSTER_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CLUSTER_W, CLUSTER_H);
  const bg = ctx.createRadialGradient(CLUSTER_W / 2, CLUSTER_H * 0.55, 20, CLUSTER_W / 2, CLUSTER_H * 0.55, CLUSTER_W * 0.62);
  bg.addColorStop(0, 'rgba(16,19,24,0.85)');
  bg.addColorStop(1, 'rgba(0,0,0,0.99)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CLUSTER_W, CLUSTER_H);

  // 转速弧
  const cx = CLUSTER_W * 0.5;
  const cy = CLUSTER_H * 0.82;
  const r = CLUSTER_H * 0.6;
  const start = Math.PI * 1.12;
  const end = Math.PI * 1.88;
  ctx.lineCap = 'butt';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.stroke();

  // 红区
  ctx.strokeStyle = 'rgba(216,52,42,0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, start + (end - start) * 0.92, end);
  ctx.stroke();

  // 刻度与数字
  for (let i = 0; i <= 9; i++) {
    const t = i / 9;
    const a = start + (end - start) * t;
    const x1 = cx + Math.cos(a) * (r - 22);
    const y1 = cy + Math.sin(a) * (r - 22);
    const x2 = cx + Math.cos(a) * (r - 40);
    const y2 = cy + Math.sin(a) * (r - 40);
    ctx.strokeStyle = i >= 9 ? '#ff4a3a' : 'rgba(255,255,255,0.65)';
    ctx.lineWidth = i % 2 === 0 ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (i % 2 === 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(232,236,242,0.78)';
      ctx.font = '600 30px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), cx + Math.cos(a) * (r - 70), cy + Math.sin(a) * (r - 70));
      ctx.restore();
    }
  }

  // 指针（静止在 3200 rpm）
  const rpm = 3.2;
  const a = start + (end - start) * (rpm / 9);
  ctx.strokeStyle = '#ff3b30';
  ctx.lineWidth = 6;
  ctx.shadowColor = 'rgba(255,59,48,0.85)';
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
  ctx.lineTo(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18));
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 数字车速
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f3f5f8';
  ctx.font = '300 96px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('0', CLUSTER_W - 120, CLUSTER_H * 0.5);
  ctx.fillStyle = 'rgba(232,236,242,0.55)';
  ctx.font = '500 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('km/h', CLUSTER_W - 120, CLUSTER_H * 0.5 + 40);

  // 挡位
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(232,236,242,0.6)';
  ctx.font = '500 24px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('GEAR', 120, CLUSTER_H * 0.44);
  ctx.fillStyle = '#f3f5f8';
  ctx.font = '300 84px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('1', 120, CLUSTER_H * 0.62);

  // 换挡提示灯
  for (let i = 0; i < 7; i++) {
    const x = cx - 168 + i * 56;
    ctx.beginPath();
    ctx.arc(x, CLUSTER_H * 0.2, 11, 0, Math.PI * 2);
    ctx.fillStyle = i < 1 ? '#ff3b30' : 'rgba(255,255,255,0.14)';
    ctx.fill();
  }

  // 品牌条
  ctx.fillStyle = 'rgba(216,52,42,0.9)';
  ctx.fillRect(CLUSTER_W / 2 - 60, CLUSTER_H - 26, 120, 3);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232,236,242,0.35)';
  ctx.font = '500 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('458 ITALIA', CLUSTER_W / 2, CLUSTER_H - 44);

  return canvas;
}

function drawCenterScreen() {
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
  g.addColorStop(0, 'rgba(16,19,24,0.92)');
  g.addColorStop(1, 'rgba(0,0,0,0.99)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // 顶栏
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, 0, SCREEN_W, 96);
  ctx.fillStyle = '#ece9e4';
  ctx.font = '600 26px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('458 ITALIA', 32, 46);
  ctx.fillStyle = 'rgba(232,236,242,0.45)';
  ctx.font = '400 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('INFOTAINMENT', 32, 76);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(232,236,242,0.75)';
  ctx.font = '400 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('20:24', SCREEN_W - 32, 52);

  // 空调
  ctx.textAlign = 'left';
  const rows = [
    ['CLIMATE', '22.0 °C', '#e8b21a'],
    ['MEDIA', '87.5 MHz', '#7ad7ff'],
    ['VEHICLE', 'TRACK · OFF', '#9aa0a6'],
    ['AUDIO', 'VOL 04', '#9aa0a6']
  ];
  let y = 160;
  for (const [label, value, color] of rows) {
    ctx.fillStyle = 'rgba(232,236,242,0.4)';
    ctx.font = '500 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(label, 32, y);
    ctx.fillStyle = color;
    ctx.font = '300 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(value, 32, y + 42);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, y + 70);
    ctx.lineTo(SCREEN_W - 32, y + 70);
    ctx.stroke();
    y += 118;
  }

  // 底部：程序化补建标注
  ctx.fillStyle = 'rgba(232,236,242,0.28)';
  ctx.font = '400 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('SCREEN · PROCEDURALLY BUILT', 32, SCREEN_H - 28);

  return canvas;
}

function screenTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * 在驾驶舱里补建两块屏。位置由射线打到内饰表面决定，
 * 避免凭空摆一块穿过仪表台的平面。
 */
export function buildInteriorScreens(car, { eye }) {
  const wheel = car.steeringBox?.getCenter(new THREE.Vector3());
  if (!wheel) return null;

  const group = new THREE.Group();
  group.name = 'interior-screens';

  // 仪表：方向盘正后方（沿车身 -Z 前移 0.24、抬高 0.065）
  const clusterPos = wheel.clone().add(new THREE.Vector3(0, 0.065, -0.24));
  const cluster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.235, 0.086),
    new THREE.MeshBasicMaterial({ map: screenTexture(drawCluster()), toneMapped: false })
  );
  cluster.position.copy(clusterPos);
  cluster.name = 'cluster-screen';
  group.add(cluster);

  // 中控屏：方向盘右前方，略低，竖屏
  const centerPos = wheel.clone().add(new THREE.Vector3(0.36, -0.02, -0.115));
  const center = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.175),
    new THREE.MeshBasicMaterial({ map: screenTexture(drawCenterScreen()), toneMapped: false })
  );
  center.position.copy(centerPos);
  center.name = 'center-screen';
  group.add(center);

  // 让两块屏朝向驾驶员
  cluster.lookAt(eye);
  center.lookAt(eye.clone().add(new THREE.Vector3(0, -0.06, 0)));

  car.group.add(group);
  car.interiorScreens = { group, cluster, center };
  return car.interiorScreens;
}
