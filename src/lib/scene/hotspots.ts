import * as THREE from 'three';

interface HotspotOpts {
  dom: HTMLElement;
  camera: THREE.PerspectiveCamera;
  hits: THREE.Object3D[];
  onSelect: (info: { name: string; desc: string; url: string } | null) => void;
  getMode: () => string;
}

export function setupHotspots({ dom, camera, hits, onSelect, getMode }: HotspotOpts) {
  const ray = new THREE.Raycaster();
  let downX = 0;
  let downY = 0;

  dom.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    downY = e.clientY;
  });
  dom.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // 拖拽不算点击
    const ndc = new THREE.Vector2();
    if (getMode() === 'roam' && document.pointerLockElement === dom) {
      ndc.set(0, 0); // 漫游模式用准星
    } else {
      const r = dom.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    }
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hits, false)[0];
    if (hit) {
      const a = hit.object.userData.artifact;
      onSelect({ name: a.name, desc: a.desc, url: a.url });
    } else {
      onSelect(null);
    }
  });

  const markers = hits.map((h) => h.userData.marker as THREE.Mesh);
  return {
    update(elapsed: number) {
      const s = 1 + 0.25 * Math.sin(elapsed * 3);
      for (const m of markers) m.scale.setScalar(s);
    },
  };
}
