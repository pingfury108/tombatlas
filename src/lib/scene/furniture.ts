import * as THREE from 'three';
import { getTexture } from './textures';
import type { FurnishingCfg } from './types';

function std(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...opts });
}

const WOOD = std(0x4a3524);
const WOOD_DARK = std(0x38271a);
const LACQUER = std(0x7a1f1f, { roughness: 0.45 });
const STONE = std(0x3a332a);
const MARBLE = std(0xd8d2c4, { roughness: 0.35 }); // 汉白玉
const BRONZE = std(0x8a6b32, { metalness: 0.8, roughness: 0.4 });
const FABRIC = std(0x8a2f2a, { roughness: 0.95, side: THREE.DoubleSide }); // 帷帐缯帛
const CLAY = [0x8a6a4a, 0x7a5a3d, 0x96684a, 0x6e5238].map((c) => std(c, { roughness: 0.9 }));

const jarProfile = [
  [0, 0],
  [0.13, 0.01],
  [0.19, 0.12],
  [0.22, 0.3],
  [0.19, 0.45],
  [0.12, 0.52],
  [0.13, 0.56],
].map(([x, y]) => new THREE.Vector2(x, y));

function jar(mat: THREE.Material, scale = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.LatheGeometry(jarProfile, 14), mat);
  m.scale.setScalar(scale);
  return m;
}

/** 汉白玉棺床 + 髹漆棺椁（一棺一椁） */
function coffinBed(): THREE.Group {
  const g = new THREE.Group();
  const platform = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 1.6), MARBLE);
  platform.position.y = 0.2;
  const guo = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.05), WOOD_DARK); // 外椁
  guo.position.set(0, 0.75, -0.22);
  const guan = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 0.75), LACQUER); // 内棺
  guan.position.set(0, 0.85, -0.22);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.08, 0.82), LACQUER);
  lid.position.set(0, 1.11, -0.22);
  g.add(platform, guo, guan, lid);
  return g;
}

/** 一排陶瓮 */
function potteryRow(count: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const m = jar(CLAY[i % CLAY.length], 0.9 + Math.random() * 0.35);
    m.position.set(i * 0.55 - ((count - 1) * 0.55) / 2, 0, (Math.random() - 0.5) * 0.12);
    g.add(m);
  }
  return g;
}

/** 方形大酒缸（北耳室"十几个方形陶制大酒缸"） */
function squareVats(count: number): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const vat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.72), CLAY[i % CLAY.length]);
    vat.position.set(i * 0.85 - ((count - 1) * 0.85) / 2, 0.43, 0);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.8), vat.material);
    rim.position.set(vat.position.x, 0.88, 0);
    g.add(vat, rim);
  }
  return g;
}

/** 石磨（北耳室磨房） */
function mill(): THREE.Group {
  const g = new THREE.Group();
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.14, 18), STONE);
  lower.position.y = 0.3;
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.12, 18), std(0x4a443a));
  upper.position.y = 0.43;
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), WOOD);
  stand.position.y = 0.11;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), WOOD);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.55, 0.46, 0);
  g.add(stand, lower, upper, handle);
  return g;
}

/** 漆案 */
function table(): THREE.Group {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.6), LACQUER);
  top.position.y = 0.32;
  g.add(top);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), WOOD);
      leg.position.set(sx * 0.52, 0.15, sz * 0.24);
      g.add(leg);
    }
  }
  return g;
}

/** 车轮（倚墙放置） */
function wheel(): THREE.Group {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.045, 8, 24), WOOD);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12), WOOD);
  hub.rotation.x = Math.PI / 2;
  g.add(rim, hub);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.12, 6), WOOD);
    spoke.rotation.z = (i * Math.PI) / 6;
    g.add(spoke);
  }
  g.position.y = 0.62;
  g.rotation.x = 0.08;
  return g;
}

/** 乘车：舆 + 轴 + 双轮 + 前伸车辕（南耳室车马厩） */
function chariot(): THREE.Group {
  const g = new THREE.Group();
  const yu = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.32, 0.95), WOOD_DARK); // 车舆
  yu.position.y = 0.85;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.05, 1.05), WOOD);
  rail.position.y = 1.03;
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.9, 8), WOOD);
  axle.rotation.z = Math.PI / 2;
  axle.position.y = 0.55;
  g.add(yu, rail, axle);
  for (const s of [1, -1]) {
    const w = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.045, 8, 22), WOOD);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 10), WOOD);
    hub.rotation.z = Math.PI / 2;
    w.add(rim, hub);
    for (let i = 0; i < 8; i++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.02, 6), WOOD);
      spoke.rotation.z = (i * Math.PI) / 8;
      w.add(spoke);
    }
    w.rotation.y = Math.PI / 2;
    w.position.set(s * 0.95, 0.55, 0);
    g.add(w);
  }
  for (const s of [1, -1]) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 8), WOOD);
    shaft.rotation.x = 1.93; // 前端落地
    shaft.position.set(s * 0.35, 0.45, 0.9);
    g.add(shaft);
  }
  return g;
}

/** 瓦顶木构房屋（甬道、耳室、中室均建有） */
function timberHouse(): THREE.Group {
  const g = new THREE.Group();
  const W = 5.4;
  const D = 3.6;
  const COL_H = 2.4;
  // 柱网：面阔三间
  for (const x of [-W / 2, -W / 6, W / 6, W / 2]) {
    for (const z of [-D / 2, D / 2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, COL_H, 10), std(0x5a2e1a));
      col.position.set(x, COL_H / 2, z);
      g.add(col);
    }
  }
  for (const z of [-D / 2, D / 2]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.12, 0.12), WOOD_DARK);
    beam.position.set(0, COL_H + 0.06, z);
    g.add(beam);
  }
  // 两面坡瓦顶
  const tileTex = getTexture('tile').map.clone();
  tileTex.repeat.set(3, 1.2);
  const tileMat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.9 });
  for (const s of [1, -1]) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 1.0, 0.06, 2.4), tileMat);
    roof.rotation.x = s * 0.28;
    roof.position.set(0, COL_H + 0.5, (s * (D / 2 + 0.35)) / 2);
    g.add(roof);
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(W + 1.0, 0.14, 0.14), WOOD_DARK);
  ridge.position.set(0, COL_H + 0.82, 0);
  g.add(ridge);
  return g;
}

/** 帷帐（中室"张设两具帷帐"） */
function canopy(): THREE.Group {
  const g = new THREE.Group();
  const W = 2.4;
  const D = 1.8;
  const H = 2.1;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, H, 8), BRONZE);
      pole.position.set((sx * W) / 2, H / 2, (sz * D) / 2);
      g.add(pole);
    }
  }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.3, D + 0.3), FABRIC);
  top.rotation.x = -Math.PI / 2;
  top.position.y = H;
  g.add(top);
  for (const s of [1, -1]) {
    const drape = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.3, 0.9), FABRIC);
    drape.position.set(0, H - 0.45, (s * (D + 0.3)) / 2);
    g.add(drape);
  }
  return g;
}

/** 铜器组合：鼎 + 壶 + 盆（中室饮宴器具） */
function bronzeSet(): THREE.Group {
  const g = new THREE.Group();
  // 鼎：三足两耳
  const dingBody = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 12, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.6), BRONZE);
  dingBody.position.y = 0.42;
  g.add(dingBody);
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.32, 8), BRONZE);
    const a = (i * Math.PI * 2) / 3;
    leg.position.set(Math.cos(a) * 0.18, 0.16, Math.sin(a) * 0.18);
    g.add(leg);
  }
  for (const s of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12, Math.PI), BRONZE);
    ear.position.set(s * 0.2, 0.68, 0);
    g.add(ear);
  }
  // 壶
  const hu = jar(BRONZE, 1.1);
  hu.position.set(0.65, 0, 0.15);
  g.add(hu);
  // 盆
  const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.12, 16), BRONZE);
  pan.position.set(-0.55, 0.06, 0.2);
  g.add(pan);
  return g;
}

/** 木架 + 小陶罐 */
function shelf(): THREE.Group {
  const g = new THREE.Group();
  for (const sx of [1, -1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), WOOD);
    post.position.set(sx * 0.55, 0.6, 0);
    g.add(post);
  }
  for (const y of [0.4, 0.9]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.36), WOOD);
    plank.position.y = y;
    g.add(plank);
    for (let i = 0; i < 3; i++) {
      const m = jar(CLAY[(i + (y > 0.5 ? 1 : 0)) % CLAY.length], 0.45);
      m.position.set(-0.36 + i * 0.36, y + 0.02, 0);
      g.add(m);
    }
  }
  return g;
}

/** 浴室组合：盆 + 罍 + 灯 + 熏炉 + 搓澡石 + 石俑 */
function bathSet(): THREE.Group {
  const g = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.22, 16), BRONZE);
  basin.position.set(0.3, 0.11, 0.2);
  const lei = jar(BRONZE, 1.2); // 铜罍
  lei.position.set(-0.6, 0, 0.55);
  // 灯：高柄灯盘
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.4, 8), BRONZE);
  stem.position.set(0.6, 0.2, -0.35);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.06, 12), BRONZE);
  dish.position.set(0.6, 0.43, -0.35);
  // 熏炉：小博山炉
  const xunStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.18, 8), BRONZE);
  xunStem.position.set(0.65, 0.09, 0.5);
  const xunTop = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 8), BRONZE);
  xunTop.position.set(0.65, 0.28, 0.5);
  const stone = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.2), MARBLE); // 搓澡石
  stone.position.set(-0.3, 0.04, 0.4);
  // 石男仆俑
  const figure = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.62, 10), STONE);
  body.position.y = 0.35;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), STONE);
  head.position.y = 0.76;
  figure.add(body, head);
  figure.position.set(-0.4, 0, -0.35);
  g.add(basin, lei, stem, dish, xunStem, xunTop, stone, figure);
  return g;
}

/** 立马（殉马抽象低模） */
function horse(): THREE.Group {
  const g = new THREE.Group();
  const mat = CLAY[1];
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 10), mat);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.85;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.5, 8), mat);
  neck.rotation.z = -0.6;
  neck.position.set(0.48, 1.15, 0);
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.25, 4, 8), mat);
  head.rotation.z = -1.1;
  head.position.set(0.72, 1.38, 0);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.45, 6), mat);
  tail.rotation.z = 0.7;
  tail.position.set(-0.5, 0.85, 0);
  g.add(body, neck, head, tail);
  for (const [sx, sz] of [
    [0.32, 0.12],
    [0.32, -0.12],
    [-0.32, 0.12],
    [-0.32, -0.12],
  ] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.75, 6), mat);
    leg.position.set(sx, 0.38, sz);
    g.add(leg);
  }
  g.rotation.y = Math.PI / 2; // 默认面向 +z（与车辕方向一致）
  return g;
}

/** 铜器群：釜 + 甗 + 钟 + 罍（中室饮宴器具） */
function vessels(): THREE.Group {
  const g = new THREE.Group();
  // 釜：深腹
  const fuProfile = [
    [0, 0],
    [0.16, 0.02],
    [0.24, 0.18],
    [0.26, 0.3],
    [0.2, 0.38],
    [0.18, 0.42],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const fu = new THREE.Mesh(new THREE.LatheGeometry(fuProfile, 16), BRONZE);
  fu.position.set(-0.9, 0, 0);
  // 甗：下鬲上甑
  const yan = new THREE.Group();
  const li = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), BRONZE);
  li.scale.y = 0.75;
  li.position.y = 0.22;
  yan.add(li);
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.16, 6), BRONZE);
    const a = (i * Math.PI * 2) / 3;
    leg.position.set(Math.cos(a) * 0.12, 0.08, Math.sin(a) * 0.12);
    yan.add(leg);
  }
  const zeng = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.22, 14), BRONZE);
  zeng.position.y = 0.45;
  yan.add(zeng);
  yan.position.set(-0.3, 0, 0.1);
  // 钟
  const bellProfile = [
    [0, 0],
    [0.18, 0.01],
    [0.22, 0.06],
    [0.23, 0.32],
    [0.15, 0.46],
    [0.05, 0.52],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellProfile, 16), BRONZE);
  bell.position.set(0.35, 0, -0.05);
  // 罍：大罐
  const lei = jar(BRONZE, 1.7);
  lei.position.set(1.0, 0, 0.1);
  g.add(fu, yan, bell, lei);
  return g;
}

/** 侍从俑一排 */
function figurines(count: number): THREE.Group {
  const g = new THREE.Group();
  const mat = std(0x6a4a30);
  for (let i = 0; i < count; i++) {
    const f = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.34, 8), mat);
    body.position.y = 0.2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat);
    head.position.y = 0.43;
    f.add(body, head);
    f.position.set(i * 0.32 - ((count - 1) * 0.32) / 2, 0, 0);
    g.add(f);
  }
  return g;
}

/** 后室随葬品：铜剑 + 五铢钱堆 + 金饼 */
function graveGoods(): THREE.Group {
  const g = new THREE.Group();
  // 铜剑（平放）
  const sword = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.7), std(0x9a8a5a, { metalness: 0.85, roughness: 0.35 }));
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.04), BRONZE);
  guard.position.z = 0.37;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), WOOD_DARK);
  grip.rotation.x = Math.PI / 2;
  grip.position.z = 0.47;
  sword.add(blade, guard, grip);
  sword.position.set(-0.25, 0.02, 0);
  // 五铢钱堆
  for (const [x, z, h] of [
    [0.35, 0.15, 0.09],
    [0.5, 0.1, 0.06],
    [0.42, -0.12, 0.12],
  ] as const) {
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, h, 12), std(0x9a7a3a, { metalness: 0.7, roughness: 0.5 }));
    pile.position.set(x, h / 2, z);
    g.add(pile);
  }
  // 金饼
  for (let i = 0; i < 4; i++) {
    const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.02, 14), std(0xd4a017, { metalness: 0.95, roughness: 0.25 }));
    cake.position.set(0.05 + (i % 2) * 0.14, 0.01 + Math.floor(i / 2) * 0.021, 0.35);
    g.add(cake);
  }
  g.add(sword);
  return g;
}

/** 石门：门框 + 两扇门（一扇半开），铺首衔环 */
export function makeStoneDoor(width: number, height: number): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = std(0x55504a, { roughness: 0.9 });
  for (const s of [1, -1]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.25, height + 0.2, 0.32), stoneMat);
    jamb.position.set(s * (width / 2 + 0.12), (height + 0.2) / 2, 0);
    g.add(jamb);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 0.7, 0.28, 0.36), stoneMat);
  lintel.position.y = height + 0.32;
  g.add(lintel);
  const slabW = width / 2 - 0.02;
  const mkSlab = () => {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slabW, height - 0.04, 0.08), stoneMat);
    const boss = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 16), BRONZE); // 铺首衔环
    boss.position.set(0, 0, 0.06);
    slab.add(boss);
    return slab;
  };
  const left = mkSlab(); // 关闭
  left.position.set(-slabW / 2, height / 2, 0);
  g.add(left);
  const rightPivot = new THREE.Group(); // 半开
  const right = mkSlab();
  right.position.set(-slabW / 2, height / 2, 0);
  rightPivot.add(right);
  rightPivot.position.set(width / 2, 0, 0);
  rightPivot.rotation.y = -0.55;
  g.add(rightPivot);
  return g;
}

export function makeFurniture(f: FurnishingCfg): THREE.Group {
  let inner: THREE.Group;
  switch (f.type) {
    case 'coffin-bed':
      inner = coffinBed();
      break;
    case 'pottery-row':
      inner = potteryRow(f.count);
      break;
    case 'square-vats':
      inner = squareVats(f.count);
      break;
    case 'table':
      inner = table();
      break;
    case 'wheel':
      inner = wheel();
      break;
    case 'chariot':
      inner = chariot();
      break;
    case 'timber-house':
      inner = timberHouse();
      break;
    case 'canopy':
      inner = canopy();
      break;
    case 'bronze-set':
      inner = bronzeSet();
      break;
    case 'mill':
      inner = mill();
      break;
    case 'bath-set':
      inner = bathSet();
      break;
    case 'horse':
      inner = horse();
      break;
    case 'vessels':
      inner = vessels();
      break;
    case 'figurines':
      inner = figurines(f.count);
      break;
    case 'grave-goods':
      inner = graveGoods();
      break;
    default:
      inner = shelf();
  }
  const g = new THREE.Group();
  g.add(inner);
  g.rotation.y = f.rotation;
  g.position.set(f.position[0], f.position[1], f.position[2]);
  return g;
}
