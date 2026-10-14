import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { BuiltTomb } from './builder';

export type Mode = 'orbit' | 'roam';

interface ControlsOpts {
  camera: THREE.PerspectiveCamera;
  dom: HTMLElement;
  built: BuiltTomb;
  isMobile: boolean;
  fsTarget: HTMLElement;
  onHint: (text: string) => void;
}

const EYE = 1.6;
const SPEED = 2.4;
const MARGIN = 0.3;

export function createControls({ camera, dom, built, isMobile, fsTarget, onHint }: ControlsOpts) {
  const orbit = new OrbitControls(camera, dom);
  orbit.target.copy(built.center).setY(1.5);
  orbit.enableDamping = true;
  orbit.maxDistance = built.radius * 3;
  orbit.maxPolarAngle = Math.PI / 2 - 0.02;

  let mode: Mode = 'orbit';
  let yaw = 0;
  let pitch = 0;
  const keys = new Set<string>();
  // 移动端摇杆状态
  const joy = { id: -1, sx: 0, sy: 0, dx: 0, dy: 0 };
  const look = { id: -1, lx: 0, ly: 0 };

  camera.rotation.order = 'YXZ';

  function setOrbitView() {
    camera.position.copy(built.center).add(new THREE.Vector3(0, built.radius * 1.2, built.radius * 1.6));
    orbit.target.copy(built.center).setY(1.5);
    orbit.update();
  }

  function enterRoam() {
    camera.position.copy(built.spawn); // 出生点已含坡道标高
    yaw = 0; // 面向 -z（墓内深处）
    pitch = 0;
    if (!isMobile) dom.requestPointerLock?.();
  }

  // 全屏：优先原生 Fullscreen API，不支持（如 iPhone Safari）时退化为 fixed 铺满视口
  let pseudoFs = false;
  function enterFullscreen() {
    fsTarget.requestFullscreen?.().catch(() => {
      pseudoFs = true;
      fsTarget.classList.add('ts-fs');
    });
    if (!fsTarget.requestFullscreen) {
      pseudoFs = true;
      fsTarget.classList.add('ts-fs');
    }
  }
  function exitFullscreen() {
    if (pseudoFs) {
      pseudoFs = false;
      fsTarget.classList.remove('ts-fs');
    }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  function setMode(m: Mode) {
    mode = m;
    orbit.enabled = m === 'orbit';
    if (m === 'orbit') {
      exitFullscreen();
      setOrbitView();
      onHint('拖拽旋转 · 滚轮缩放');
      document.exitPointerLock?.();
    } else {
      enterFullscreen();
      enterRoam();
      onHint(isMobile ? '左侧滑动移动 · 右侧滑动转视角' : 'WASD 移动 · 点击画面锁定鼠标转视角 · Esc 退出');
    }
  }

  function inWalkable(x: number, z: number): boolean {
    const inArea = built.walkable.some(
      (b) => x > b.minX + MARGIN && x < b.maxX - MARGIN && z > b.minZ + MARGIN && z < b.maxZ - MARGIN,
    );
    if (!inArea) return false;
    return !built.blocked.some((b) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ);
  }

  /** 地面高度：斜坡墓道内按线性插值，其余为 0 */
  function groundY(x: number, z: number): number {
    for (const r of built.ramps) {
      const dx = r.x2 - r.x1;
      const dz = r.z2 - r.z1;
      const l2 = dx * dx + dz * dz;
      if (l2 < 1e-6) continue;
      const t = ((x - r.x1) * dx + (z - r.z1) * dz) / l2;
      if (t < 0 || t > 1) continue;
      const perp = Math.abs(-(x - r.x1) * dz + (z - r.z1) * dx) / Math.sqrt(l2);
      if (perp <= r.hw) return r.y1 * (1 - t);
    }
    return 0;
  }

  function move(dx: number, dz: number) {
    const p = camera.position;
    if (inWalkable(p.x + dx, p.z + dz)) {
      p.x += dx;
      p.z += dz;
    } else if (inWalkable(p.x + dx, p.z)) {
      p.x += dx;
    } else if (inWalkable(p.x, p.z + dz)) {
      p.z += dz;
    }
  }

  dom.addEventListener('click', () => {
    if (mode === 'roam' && !isMobile && document.pointerLockElement !== dom) dom.requestPointerLock?.();
  });
  document.addEventListener('mousemove', (e) => {
    if (mode !== 'roam' || document.pointerLockElement !== dom) return;
    yaw -= e.movementX * 0.0025;
    pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0025, -1.2, 1.2);
  });
  document.addEventListener('keydown', (e) => keys.add(e.code));
  document.addEventListener('keyup', (e) => keys.delete(e.code));

  dom.addEventListener('touchstart', (e) => {
    if (mode !== 'roam') return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.clientX < dom.clientWidth / 2 && joy.id < 0) {
        joy.id = t.identifier; joy.sx = t.clientX; joy.sy = t.clientY; joy.dx = joy.dy = 0;
      } else if (look.id < 0) {
        look.id = t.identifier; look.lx = t.clientX; look.ly = t.clientY;
      }
    }
  }, { passive: true });
  dom.addEventListener('touchmove', (e) => {
    if (mode !== 'roam') return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joy.id) {
        joy.dx = THREE.MathUtils.clamp((t.clientX - joy.sx) / 50, -1, 1);
        joy.dy = THREE.MathUtils.clamp((t.clientY - joy.sy) / 50, -1, 1);
      } else if (t.identifier === look.id) {
        yaw -= (t.clientX - look.lx) * 0.006;
        pitch = THREE.MathUtils.clamp(pitch - (t.clientY - look.ly) * 0.006, -1.2, 1.2);
        look.lx = t.clientX; look.ly = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  const endTouch = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joy.id) { joy.id = -1; joy.dx = joy.dy = 0; }
      if (t.identifier === look.id) look.id = -1;
    }
  };
  dom.addEventListener('touchend', endTouch);
  dom.addEventListener('touchcancel', endTouch);

  function update(dt: number) {
    if (mode === 'orbit') {
      orbit.update();
      return;
    }
    if (mode === 'roam') {
      camera.rotation.set(pitch, yaw, 0);
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - joy.dy;
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joy.dx;
      if (f || s) {
        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);
        const v = SPEED * dt;
        move((-sin * f + cos * s) * v, (-cos * f - sin * s) * v);
      }
      const gy = groundY(camera.position.x, camera.position.z) + EYE;
      camera.position.y += (gy - camera.position.y) * Math.min(1, dt * 10); // 坡道平滑贴地
    }
  }

  setOrbitView();
  return { setMode, update, get mode() { return mode; } };
}
