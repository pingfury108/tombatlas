import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildTomb } from './builder';
import { createControls, type Mode } from './controls';
import { setupHotspots } from './hotspots';
import type { SceneConfig } from './types';

export function initTombScene(root: HTMLElement): void {
  const cfg = JSON.parse(root.dataset.config ?? '{}') as SceneConfig;
  const viewport = root.querySelector<HTMLElement>('.ts-viewport');
  const hint = root.querySelector<HTMLElement>('.ts-hint');
  const panel = root.querySelector<HTMLElement>('.ts-panel');
  if (!viewport || !panel) return;

  const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 768;
  let dpr = Math.min(devicePixelRatio || 1, isMobile ? 1.5 : 2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  if (!isMobile) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }
  viewport.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0806);
  scene.fog = new THREE.FogExp2(0x0a0806, 0.02);
  // 环境反射：让金属文物有质感，强度压低保持墓室昏暗氛围
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 300);
  const built = buildTomb(cfg);
  scene.add(built.group);

  scene.add(new THREE.HemisphereLight(0x4a4438, 0x1a140d, 0.35));
  // 火光：每室一盏暖色点光，轻微闪烁；最大的两室投射阴影（仅桌面端）
  const torchLights: { light: THREE.PointLight; base: number; phase: number }[] = [];
  const sorted = [...cfg.chambers].sort((a, b) => b.size[0] * b.size[2] - a.size[0] * a.size[2]);
  for (const c of cfg.chambers) {
    const intensity = Math.max(c.size[0], c.size[2]) * 6.5;
    const light = new THREE.PointLight(0xff9a4d, intensity, 0, 1.8);
    light.position.set(c.position[0], c.size[1] * 0.75, c.position[2]);
    if (!isMobile && sorted.indexOf(c) < 2) {
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.01;
    }
    scene.add(light);
    torchLights.push({ light, base: intensity, phase: Math.random() * 100 });
  }

  // 尘埃粒子
  const dustCount = isMobile ? 120 : 300;
  const dustPos = new Float32Array(dustCount * 3);
  const dustBase = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustBase[i * 3] = built.center.x + (Math.random() - 0.5) * built.radius * 1.6;
    dustBase[i * 3 + 1] = 0.2 + Math.random() * 2.8;
    dustBase[i * 3 + 2] = built.center.z + (Math.random() - 0.5) * built.radius * 1.6;
  }
  dustPos.set(dustBase);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0xffe0b0,
      size: 0.02,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(dust);

  const setHint = (t: string) => { if (hint) hint.textContent = t; };
  const controls = createControls({ camera, dom: viewport, built, isMobile, fsTarget: root, onHint: setHint });

  const panelName = panel.querySelector<HTMLElement>('.ts-panel-name')!;
  const panelDesc = panel.querySelector<HTMLElement>('.ts-panel-desc')!;
  const panelLink = panel.querySelector<HTMLAnchorElement>('.ts-panel-link')!;
  panel.querySelector('.ts-panel-close')?.addEventListener('click', () => (panel.hidden = true));

  const hotspots = setupHotspots({
    dom: viewport,
    camera,
    hits: built.hits,
    getMode: () => controls.mode,
    onSelect: (info) => {
      if (!info) {
        panel.hidden = true;
        return;
      }
      panelName.textContent = info.name;
      panelDesc.textContent = info.desc;
      panelLink.href = info.url;
      panel.hidden = false;
    },
  });

  root.querySelectorAll<HTMLButtonElement>('.ts-toolbar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      controls.setMode(btn.dataset.mode as Mode);
      root.querySelectorAll('.ts-toolbar button').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  function resize() {
    const w = viewport!.clientWidth;
    const h = viewport!.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(viewport);
  resize();

  root.classList.add('ts-ready');
  setHint('拖拽旋转 · 滚轮缩放');

  // 帧率监控：低于 40fps 自动降 DPR
  let frames = 0;
  let statTime = 0;
  let last = performance.now();
  let elapsed = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    controls.update(dt);
    hotspots.update(elapsed);
    // 火光闪烁
    for (const t of torchLights) {
      t.light.intensity = t.base * (0.88 + 0.12 * Math.sin(elapsed * 13 + t.phase) * Math.sin(elapsed * 7.3 + t.phase));
    }
    // 尘埃缓浮
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(elapsed * 0.4 + i) * 0.15;
    }
    dustGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    frames++;
    statTime += dt;
    if (statTime >= 2) {
      const fps = frames / statTime;
      frames = 0;
      statTime = 0;
      if (fps < 40 && dpr > 1) {
        dpr = Math.max(1, dpr - 0.25);
        renderer.setPixelRatio(dpr);
      }
    }
  });
}
