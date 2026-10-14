import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getTexture, getMuralTexture } from './textures';
import { makeArtifactModel } from './artifacts';
import { makeFurniture, makeStoneDoor } from './furniture';
import type { ChamberCfg, CorridorCfg, SceneConfig, Vec3 } from './types';

interface Area {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface Ramp {
  x1: number;
  z1: number;
  y1: number;
  x2: number;
  z2: number;
  hw: number;
}

export interface BuiltTomb {
  group: THREE.Group;
  hits: THREE.Object3D[];
  walkable: Area[];
  blocked: Area[]; // 家具阻挡区
  ramps: Ramp[]; // 斜坡墓道（漫游时贴地）
  spawn: THREE.Vector3; // 漫游出生点（墓道内侧）
  center: THREE.Vector3;
  radius: number;
}

/** UV 按实际尺寸平铺，避免纹理拉伸 */
function tileUV(g: THREE.BufferGeometry, su: number, sv: number): void {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}

function v3(p: Vec3): THREE.Vector3 {
  return new THREE.Vector3(p[0], p[1], p[2]);
}

interface Opening {
  side: 0 | 1 | 2 | 3; // 0=z+ 1=z- 2=x+ 3=x-
  pos: number; // 沿墙轴的世界坐标
  width: number;
  height: number;
}

/** 一面墙按门洞切分：返回若干矩形段（局部：沿墙轴中心 c、长度 l、高度区间 y0~y1） */
function wallSegs(
  center: number,
  L: number,
  wallH: number,
  ops: { pos: number; width: number; height: number }[],
): { c: number; l: number; y0: number; y1: number }[] {
  const segs: { c: number; l: number; y0: number; y1: number }[] = [];
  let cur = center - L / 2;
  const end = center + L / 2;
  for (const o of [...ops].sort((a, b) => a.pos - b.pos)) {
    const ow = o.width / 2;
    if (o.pos - ow > cur + 0.01) {
      segs.push({ c: (cur + o.pos - ow) / 2, l: o.pos - ow - cur, y0: 0, y1: wallH });
    }
    if (o.height < wallH - 0.01) {
      segs.push({ c: o.pos, l: o.width, y0: o.height, y1: wallH }); // 门洞过梁
    }
    cur = Math.max(cur, o.pos + ow);
  }
  if (end > cur + 0.01) segs.push({ c: (cur + end) / 2, l: end - cur, y0: 0, y1: wallH });
  return segs;
}

/** 判断点在室的哪面墙 */
function wallSide(c: ChamberCfg, p: THREE.Vector3): 0 | 1 | 2 | 3 {
  const dx = p.x - c.position[0];
  const dz = p.z - c.position[2];
  const nx = Math.abs(dx) / (c.size[0] / 2);
  const nz = Math.abs(dz) / (c.size[2] / 2);
  return nx > nz ? (dx > 0 ? 2 : 3) : dz > 0 ? 0 : 1;
}

function chamberGeos(c: ChamberCfg, openings: Opening[] = []): THREE.BufferGeometry[] {
  const [w, h, d] = c.size;
  const [cx, , cz] = c.position;
  const geos: THREE.BufferGeometry[] = [];
  const wallH = c.vault === 'flat' ? h : h * 0.6;
  const T = 3; // 每 3 米一个纹理重复

  const floor = new THREE.PlaneGeometry(w, d);
  tileUV(floor, w / T, d / T);
  floor.rotateX(-Math.PI / 2);
  floor.translate(cx, 0, cz);
  geos.push(floor);

  // 四面墙：按甬道位置开门洞
  for (const side of [0, 1, 2, 3] as const) {
    const isZ = side < 2;
    const L = isZ ? w : d;
    const center = isZ ? cx : cz;
    const ops = openings
      .filter((o) => o.side === side)
      .map((o) => ({ ...o, height: Math.min(o.height, wallH - 0.05) }));
    for (const seg of wallSegs(center, L, wallH, ops)) {
      const g = new THREE.PlaneGeometry(seg.l, seg.y1 - seg.y0);
      tileUV(g, seg.l / T, (seg.y1 - seg.y0) / T);
      const my = (seg.y0 + seg.y1) / 2;
      if (isZ) {
        g.translate(seg.c, my, cz + (side === 0 ? d / 2 : -d / 2));
      } else {
        g.rotateY(Math.PI / 2);
        g.translate(cx + (side === 2 ? w / 2 : -w / 2), my, seg.c);
      }
      geos.push(g);
    }
  }

  if (c.vault === 'flat') {
    const ceil = new THREE.PlaneGeometry(w, d);
    tileUV(ceil, w / T, d / T);
    ceil.rotateX(Math.PI / 2);
    ceil.translate(cx, h, cz);
    geos.push(ceil);
  } else if (c.vault === 'barrel') {
    const vault = new THREE.CylinderGeometry(1, 1, d, 24, 1, true, Math.PI / 2, Math.PI);
    vault.rotateX(Math.PI / 2);
    vault.scale(w / 2, h - wallH, 1);
    vault.translate(cx, wallH, cz);
    geos.push(vault);
  } else {
    const r = Math.min(w, d) / 2;
    const dome = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(r, h - wallH, r);
    dome.translate(cx, wallH, cz);
    geos.push(dome);
  }
  return geos;
}

/** 任意四边形面片（双三角、indexed，可与 Plane/Cylinder 合并） */
function quadGeo(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, ru: number, rv: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z]), 3),
  );
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, ru, 0, ru, rv, 0, rv]), 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return g;
}

/**
 * 甬道/墓道：支持斜坡（rise）与半圆券顶。
 * p1 端标高 rise，p2 端标高 0。
 */
function corridorGeos(p1: THREE.Vector3, p2: THREE.Vector3, cor: CorridorCfg): THREE.BufferGeometry[] {
  const dir = p2.clone().sub(p1);
  dir.y = 0;
  const len = dir.length();
  if (len < 0.01) return [];
  dir.normalize();
  const u = new THREE.Vector3(-dir.z, 0, dir.x);
  const hw = cor.width / 2;
  const rise = cor.rise;
  const vaulted = rise === 0 && cor.width <= 4; // 券顶仅用于水平甬道
  const wallH = vaulted ? Math.max(cor.height - hw, 0.4) : cor.height;
  const T = 3;
  const geos: THREE.BufferGeometry[] = [];

  const A1 = p1.clone().addScaledVector(u, hw);
  const B1 = p1.clone().addScaledVector(u, -hw);
  const A2 = p2.clone().addScaledVector(u, hw);
  const B2 = p2.clone().addScaledVector(u, -hw);

  // 地面
  geos.push(
    quadGeo(
      A1.clone().setY(rise + 0.01),
      B1.clone().setY(rise + 0.01),
      B2.clone().setY(0.01),
      A2.clone().setY(0.01),
      cor.width / T,
      len / T,
    ),
  );
  // 两壁
  for (const s of [1, -1]) {
    const P1 = p1.clone().addScaledVector(u, s * hw);
    const P2 = p2.clone().addScaledVector(u, s * hw);
    geos.push(
      quadGeo(
        P1.clone().setY(rise),
        P2.clone().setY(0),
        P2.clone().setY(wallH),
        P1.clone().setY(rise + wallH),
        len / T,
        wallH / T,
      ),
    );
  }
  // 顶：水平 → 半圆券；斜坡 → 平顶
  if (vaulted) {
    const a = Math.atan2(dir.x, dir.z);
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    const vault = new THREE.CylinderGeometry(hw, hw, len, 14, 1, true, Math.PI / 2, Math.PI);
    tileUV(vault, Math.PI, len / T);
    vault.rotateX(Math.PI / 2);
    vault.rotateY(a);
    vault.translate(mid.x, wallH, mid.z);
    geos.push(vault);
  } else {
    geos.push(
      quadGeo(
        A1.clone().setY(rise + cor.height),
        B1.clone().setY(rise + cor.height),
        B2.clone().setY(cor.height),
        A2.clone().setY(cor.height),
        cor.width / T,
        len / T,
      ),
    );
  }
  return geos;
}

/** 壁画带：四壁内侧 1.0~2.4m 高的一圈 */
function muralBandGeos(c: ChamberCfg): THREE.BufferGeometry[] {
  const [w, , d] = c.size;
  const [cx, , cz] = c.position;
  const bandH = 1.4;
  const y0 = 1.0;
  const inset = 0.03;
  const geos: THREE.BufferGeometry[] = [];
  for (const s of [1, -1]) {
    const front = new THREE.PlaneGeometry(w - 0.1, bandH);
    tileUV(front, (w - 0.1) / 4, 1);
    front.translate(cx, y0 + bandH / 2, cz + s * (d / 2 - inset));
    geos.push(front);
    const side = new THREE.PlaneGeometry(d - 0.1, bandH);
    tileUV(side, (d - 0.1) / 4, 1);
    side.rotateY(Math.PI / 2);
    side.translate(cx + s * (w / 2 - inset), y0 + bandH / 2, cz);
    geos.push(side);
  }
  return geos;
}

/** 室中心向 target 方向推进到墙面边缘的点 */
function edgePoint(c: ChamberCfg, target: THREE.Vector3): THREE.Vector3 {
  const center = v3(c.position);
  const dir = target.clone().sub(center);
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) return center;
  dir.normalize();
  const tx = Math.abs(dir.x) > 1e-6 ? c.size[0] / 2 / Math.abs(dir.x) : Infinity;
  const tz = Math.abs(dir.z) > 1e-6 ? c.size[2] / 2 / Math.abs(dir.z) : Infinity;
  return center.add(dir.multiplyScalar(Math.min(tx, tz)));
}

export function buildTomb(cfg: SceneConfig): BuiltTomb {
  const group = new THREE.Group();
  const byTex = new Map<string, THREE.BufferGeometry[]>();
  const muralGeos: THREE.BufferGeometry[] = [];
  const walkable: BuiltTomb['walkable'] = [];
  const hits: THREE.Object3D[] = [];

  const push = (tex: string, geos: THREE.BufferGeometry[]) => {
    const list = byTex.get(tex) ?? [];
    list.push(...geos);
    byTex.set(tex, list);
  };

  const chamberOf = (id: string) => cfg.chambers.find((c) => c.id === id);

  // 先算甬道端点与门洞，再生成墓室（墙上开门洞）
  interface CorInfo {
    cor: CorridorCfg;
    toC: ChamberCfg;
    fromC?: ChamberCfg;
    p1: THREE.Vector3;
    p2: THREE.Vector3;
    isEntrance: boolean;
  }
  const corInfos: CorInfo[] = [];
  for (const cor of cfg.corridors) {
    const toC = chamberOf(cor.to);
    if (!toC) continue;
    if (cor.from === 'entrance') {
      const p1 = v3(toC.position).add(new THREE.Vector3(0, 0, toC.size[2] / 2 + cor.length));
      corInfos.push({ cor, toC, p1, p2: edgePoint(toC, p1), isEntrance: true });
    } else {
      const fromC = chamberOf(cor.from);
      if (!fromC) continue;
      const p1 = edgePoint(fromC, v3(toC.position));
      corInfos.push({ cor, toC, fromC, p1, p2: edgePoint(toC, p1), isEntrance: false });
    }
  }

  const openings = new Map<string, Opening[]>();
  const addOpening = (c: ChamberCfg, p: THREE.Vector3, cor: CorridorCfg) => {
    const list = openings.get(c.id) ?? [];
    list.push({ side: wallSide(c, p), pos: wallSide(c, p) < 2 ? p.x : p.z, width: cor.width + 0.3, height: cor.height + 0.3 });
    openings.set(c.id, list);
  };
  for (const ci of corInfos) {
    addOpening(ci.toC, ci.p2, ci.cor);
    if (ci.fromC) addOpening(ci.fromC, ci.p1, ci.cor);
  }

  for (const c of cfg.chambers) {
    push(c.texture, chamberGeos(c, openings.get(c.id)));
    if (c.mural) muralGeos.push(...muralBandGeos(c));
    walkable.push({
      minX: c.position[0] - c.size[0] / 2,
      maxX: c.position[0] + c.size[0] / 2,
      minZ: c.position[2] - c.size[2] / 2,
      maxZ: c.position[2] + c.size[2] / 2,
    });
  }

  let spawn: THREE.Vector3 | null = null;
  const ramps: Ramp[] = [];
  const blocked: Area[] = [];
  for (const { cor, toC, isEntrance, p1, p2 } of corInfos) {
    push(toC.texture, corridorGeos(p1, p2, cor));

    const dir = p2.clone().sub(p1).setY(0).normalize();
    const walkFrom = isEntrance ? p1.clone().addScaledVector(dir, 1.8) : p1; // 封门以内才可行走
    walkable.push({
      minX: Math.min(walkFrom.x, p2.x) - cor.width / 2,
      maxX: Math.max(walkFrom.x, p2.x) + cor.width / 2,
      minZ: Math.min(walkFrom.z, p2.z) - cor.width / 2,
      maxZ: Math.max(walkFrom.z, p2.z) + cor.width / 2,
    });

    if (isEntrance) {
      // 斜坡墓道：漫游贴地
      if (cor.rise > 0) {
        const t = 1.8 / p1.distanceTo(p2);
        ramps.push({
          x1: walkFrom.x,
          z1: walkFrom.z,
          y1: cor.rise * (1 - t),
          x2: p2.x,
          z2: p2.z,
          hw: cor.width / 2,
        });
      }
      // 封门：外层砖墙 + 内层浇铸铁门（"先用土坯或砖砌筑，再浇灌铁水"）
      const a = Math.atan2(dir.x, dir.z);
      const brickWall = new THREE.BoxGeometry(cor.width + 0.6, cor.height + 0.8, 0.4);
      brickWall.rotateY(a);
      brickWall.translate(p1.x, cor.rise + cor.height / 2, p1.z);
      push('brick', [brickWall]);
      const ironWall = new THREE.Mesh(
        new THREE.BoxGeometry(cor.width + 0.3, cor.height + 0.4, 0.22),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.75, roughness: 0.5 }),
      );
      const ip = p1.clone().addScaledVector(dir, 0.55);
      ironWall.position.set(ip.x, cor.rise * 0.96 + cor.height / 2, ip.z);
      ironWall.rotation.y = a;
      group.add(ironWall);
      spawn = walkFrom.clone().setY(cor.rise * (1 - t0(p1, p2, walkFrom)) + 1.6);
    }

    // 石门（"中室和后室之间装有石门"）
    if (cor.door) {
      const door = makeStoneDoor(cor.width, cor.height);
      const a = Math.atan2(dir.x, dir.z);
      door.position.set(p2.x, 0, p2.z);
      door.rotation.y = a;
      group.add(door);
    }
  }

  function t0(p1: THREE.Vector3, p2: THREE.Vector3, p: THREE.Vector3): number {
    const d = p2.clone().sub(p1).setY(0);
    const l2 = d.lengthSq();
    return l2 < 1e-6 ? 0 : THREE.MathUtils.clamp(p.clone().sub(p1).setY(0).dot(d) / l2, 0, 1);
  }

  for (const [tex, geos] of byTex) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const { map, bump } = getTexture(tex);
    const mesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({
        map,
        bumpMap: bump,
        bumpScale: 3,
        side: THREE.DoubleSide,
        roughness: 0.95,
      }),
    );
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  for (const a of cfg.artifacts) {
    const { group: ag, hit } = makeArtifactModel(a);
    ag.traverse((o) => {
      if (o !== hit && o instanceof THREE.Mesh) o.castShadow = true;
    });
    group.add(ag);
    hits.push(hit);
  }

  for (const f of cfg.furnishings ?? []) {
    const fg = makeFurniture(f);
    fg.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    group.add(fg);
    // 帷帐可穿行，其余家具计入碰撞
    if (f.type !== 'canopy') {
      const b = new THREE.Box3().setFromObject(fg);
      blocked.push({ minX: b.min.x - 0.05, maxX: b.max.x + 0.05, minZ: b.min.z - 0.05, maxZ: b.max.z + 0.05 });
    }
  }

  if (muralGeos.length) {
    const merged = mergeGeometries(muralGeos, false);
    if (merged) {
      const mesh = new THREE.Mesh(
        merged,
        new THREE.MeshStandardMaterial({ map: getMuralTexture(), side: THREE.DoubleSide, roughness: 0.9 }),
      );
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getSize(new THREE.Vector3()).length() / 2;
  return { group, hits, walkable, blocked, ramps, spawn: spawn ?? center.clone().setY(1.6), center, radius };
}
