import * as THREE from 'three';
import type { ArtifactCfg } from './types';

function std(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...opts });
}

function jadeBurialSuit(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.9), std(0x3a332a));
  base.position.y = 0.18;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.26, 1.3, 4, 12),
    std(0x7ba889, { roughness: 0.35, metalness: 0.05 }),
  );
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), body.material);
  head.position.set(0.95, 0.58, 0);
  g.add(base, body, head);
  return g;
}

function boshanLu(): THREE.Group {
  const g = new THREE.Group();
  const bronze = std(0x9a7433, { metalness: 0.85, roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.08, 20), bronze);
  base.position.y = 0.04;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.35, 12), bronze);
  stem.position.y = 0.25;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bronze);
  bowl.position.y = 0.55;
  const mountain = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.42, 8), bronze);
  mountain.position.y = 0.76;
  g.add(base, stem, bowl, mountain);
  return g;
}

function changxinLamp(): THREE.Group {
  const g = new THREE.Group();
  const gold = std(0xb08d3f, { metalness: 0.9, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.5, 16), gold);
  body.position.y = 0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), gold);
  head.position.y = 0.6;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), gold);
  arm.rotation.z = -0.7;
  arm.position.set(0.2, 0.55, 0);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.08, 16), gold);
  dish.position.set(0.38, 0.72, 0);
  g.add(body, head, arm, dish);
  return g;
}

function fallback(): THREE.Group {
  const g = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), std(0x3a332a));
  pedestal.position.y = 0.25;
  const item = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), std(0xc9a45c, { metalness: 0.6 }));
  item.position.y = 0.75;
  g.add(pedestal, item);
  return g;
}

const builders: Record<string, () => THREE.Group> = {
  'jade-burial-suit': jadeBurialSuit,
  'boshan-lu': boshanLu,
  'changxin-gongdeng': changxinLamp,
};

export function makeArtifactModel(a: ArtifactCfg): { group: THREE.Group; hit: THREE.Mesh } {
  const g = new THREE.Group();
  g.add((builders[a.id] ?? fallback)());

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd77a }),
  );
  marker.position.y = 1.25;
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hit.position.y = 0.6;
  hit.userData = { artifact: a, marker };
  g.add(marker, hit);

  g.position.set(a.position[0], a.position[1], a.position[2]);
  return { group: g, hit };
}
