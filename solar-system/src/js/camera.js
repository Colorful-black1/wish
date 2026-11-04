/* ==========================================================================
   camera.js — 轨道相机、缓动飞行、投影与拾取
   相机永远看向一个目标点，用 (yaw, pitch, dist) 三个量描述；
   飞行时四个量同时缓动，仰角锁在 ±80°，避免翻面。
   ========================================================================== */
(function () {
  'use strict';

  var D2R = Math.PI / 180;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  // 最短角差
  function shortestDelta(from, to) {
    var d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function easeInOut(t) {
    return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  }

  function createCamera() {
    var cam = {
      yaw: -0.9,
      pitch: 0.34,
      dist: 70,
      target: [0, 0, 0],
      fovDeg: 40,
      flight: null,
      reducedMotion: false,
      minDist: 1e-5,
      maxDist: 1e7,
    };

    var _basis = new Float32Array(9);
    var _pos = [0, 0, 0];

    cam.tanHalf = function () {
      return Math.tan(cam.fovDeg * D2R * 0.5);
    };

    cam.state = function () {
      return { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, target: cam.target.slice() };
    };

    cam.set = function (s) {
      if (s.yaw !== undefined) cam.yaw = s.yaw;
      if (s.pitch !== undefined) cam.pitch = clamp(s.pitch, -80 * D2R, 80 * D2R);
      if (s.dist !== undefined) cam.dist = clamp(s.dist, cam.minDist, cam.maxDist);
      if (s.target) cam.target = s.target.slice();
    };

    cam.setImmediate = function (s) {
      cam.flight = null;
      cam.set(s);
    };

    cam.flyTo = function (s, durationMs) {
      var to = {
        yaw: s.yaw !== undefined ? s.yaw : cam.yaw,
        pitch: s.pitch !== undefined ? clamp(s.pitch, -80 * D2R, 80 * D2R) : cam.pitch,
        dist: s.dist !== undefined ? clamp(s.dist, cam.minDist, cam.maxDist) : cam.dist,
        target: (s.target || cam.target).slice(),
      };
      if (cam.reducedMotion || !durationMs) {
        cam.set(to);
        cam.flight = null;
        return;
      }
      cam.flight = {
        from: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, target: cam.target.slice() },
        to: to,
        dYaw: shortestDelta(cam.yaw, to.yaw),
        elapsed: 0,
        duration: durationMs,
      };
    };

    cam.isFlying = function () {
      return !!cam.flight;
    };

    cam.update = function (dtMs) {
      if (!cam.flight) return;
      var f = cam.flight;
      f.elapsed += dtMs;
      var t = clamp(f.elapsed / f.duration, 0, 1);
      var e = easeInOut(t);
      cam.yaw = f.from.yaw + f.dYaw * e;
      cam.pitch = f.from.pitch + (f.to.pitch - f.from.pitch) * e;
      // 距离走对数，视觉上是匀速推进
      var d0 = Math.log(Math.max(f.from.dist, 1e-9));
      var d1 = Math.log(Math.max(f.to.dist, 1e-9));
      cam.dist = Math.exp(d0 + (d1 - d0) * e);
      for (var i = 0; i < 3; i++) {
        cam.target[i] = f.from.target[i] + (f.to.target[i] - f.from.target[i]) * e;
      }
      if (t >= 1) {
        cam.set(f.to);
        cam.flight = null;
      }
    };

    // 位置与基向量（列：右、上、前）
    cam.compute = function () {
      var cp = Math.cos(cam.pitch);
      var dirX = cp * Math.cos(cam.yaw);
      var dirY = cp * Math.sin(cam.yaw);
      var dirZ = Math.sin(cam.pitch);

      _pos[0] = cam.target[0] + cam.dist * dirX;
      _pos[1] = cam.target[1] + cam.dist * dirY;
      _pos[2] = cam.target[2] + cam.dist * dirZ;

      // forward = target − pos = −dir
      var fx = -dirX,
        fy = -dirY,
        fz = -dirZ;
      // right = normalize(cross(forward, worldUp))
      var rx = fy * 1 - fz * 0;
      var ry = fz * 0 - fx * 1;
      var rz = 0;
      var rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
      rx /= rl;
      ry /= rl;
      rz /= rl;
      // up = cross(right, forward)
      var ux = ry * fz - rz * fy;
      var uy = rz * fx - rx * fz;
      var uz = rx * fy - ry * fx;

      _basis[0] = rx;
      _basis[1] = ry;
      _basis[2] = rz;
      _basis[3] = ux;
      _basis[4] = uy;
      _basis[5] = uz;
      _basis[6] = fx;
      _basis[7] = fy;
      _basis[8] = fz;
      return _basis;
    };

    cam.position = function () {
      return _pos;
    };

    cam.basis = function () {
      return _basis;
    };

    /**
     * 世界点 → 屏幕像素。返回 {x, y, z, visible}，z 为相机前方深度。
     */
    cam.project = function (p, w, h) {
      var b = cam.compute();
      var dx = p[0] - _pos[0];
      var dy = p[1] - _pos[1];
      var dz = p[2] - _pos[2];
      var vx = dx * b[0] + dy * b[1] + dz * b[2];
      var vy = dx * b[3] + dy * b[4] + dz * b[5];
      var vz = dx * b[6] + dy * b[7] + dz * b[8];
      if (vz <= 1e-9) return { x: 0, y: 0, z: vz, visible: false };
      var th = cam.tanHalf();
      var aspect = w / h;
      var ndcX = vx / (vz * th * aspect);
      var ndcY = vy / (vz * th);
      return {
        x: (ndcX * 0.5 + 0.5) * w,
        y: (1 - (ndcY * 0.5 + 0.5)) * h,
        z: vz,
        visible: true,
      };
    };

    // 半径 r 的球在屏幕上大约占多少像素（半径）
    cam.screenRadius = function (p, r, h) {
      var b = cam.compute();
      var dx = p[0] - _pos[0];
      var dy = p[1] - _pos[1];
      var dz = p[2] - _pos[2];
      var vz = dx * b[6] + dy * b[7] + dz * b[8];
      if (vz <= 1e-9) return 0;
      return (r / (vz * cam.tanHalf())) * 0.5 * h;
    };

    /**
     * 拾取：按屏幕距离挑最靠前的一个，命中容差至少 12 CSS px。
     * items: [{pos:[x,y,z], radius, id}]
     */
    cam.pick = function (items, px, py, w, h, minTol) {
      minTol = minTol || 12;
      var best = null;
      var bestScore = Infinity;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.radius <= 0) continue;
        var sp = cam.project(it.pos, w, h);
        if (!sp.visible) continue;
        var sr = cam.screenRadius(it.pos, it.radius, h);
        var tol = Math.max(sr + 3, minTol);
        var d = Math.hypot(px - sp.x, py - sp.y);
        if (d > tol) continue;
        // 越靠屏幕中心越优先（避免大天体吞掉小天体）
        var score = d / tol + sp.z * 1e-6;
        if (score < bestScore) {
          bestScore = score;
          best = it;
        }
      }
      return best;
    };

    return cam;
  }

  window.HELIOS_CAMERA = { createCamera: createCamera, easeInOut: easeInOut };
})();
