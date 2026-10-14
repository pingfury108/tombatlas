import * as THREE from 'three';

export interface TexSet {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

const cache = new Map<string, TexSet>();
const SIZE = 512;

function speckle(ctx: CanvasRenderingContext2D, n: number, alpha: number): void {
  for (let i = 0; i < n; i++) {
    const v = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * Math.random()})`;
    ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 2, 2);
  }
}

function cracks(ctx: CanvasRenderingContext2D, n: number): void {
  ctx.strokeStyle = 'rgba(20,15,10,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < n; i++) {
    let x = Math.random() * SIZE;
    let y = Math.random() * SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 3 + (Math.random() * 4) | 0;
    for (let s = 0; s < segs; s++) {
      x += (Math.random() - 0.5) * 60;
      y += Math.random() * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function grime(ctx: CanvasRenderingContext2D): void {
  // 自上而下积灰变暗
  const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
  grad.addColorStop(0, 'rgba(0,0,0,0.25)');
  grad.addColorStop(0.4, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function makeCanvas(kind: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;

  if (kind === 'stone') {
    // 凿石：错缝大石料 + 凿痕 + 裂纹（石灰岩灰调）
    ctx.fillStyle = '#45403a';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const rows = 6;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -70;
      const y = r * (SIZE / rows);
      while (x < SIZE) {
        const w = 90 + Math.random() * 70;
        const v = 92 + Math.random() * 30;
        ctx.fillStyle = `rgb(${v},${v - 5},${v - 13})`;
        ctx.fillRect(x + 3, y + 3, w - 6, SIZE / rows - 6);
        // 凿痕斜线
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 8; k++) {
          const sx = x + 6 + Math.random() * (w - 12);
          ctx.beginPath();
          ctx.moveTo(sx, y + 4);
          ctx.lineTo(sx + 14, y + SIZE / rows - 4);
          ctx.stroke();
        }
        // 石料边缘阴影
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, w - 6, SIZE / rows - 6);
        x += w;
      }
    }
    cracks(ctx, 10);
    speckle(ctx, 2200, 0.08);
    grime(ctx);
  } else if (kind === 'brick') {
    // 青砖
    ctx.fillStyle = '#413830';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const bh = 26;
    const bw = 76;
    for (let r = 0, y = 0; y < SIZE; r++, y += bh) {
      for (let x = (r % 2) * -(bw / 2); x < SIZE; x += bw) {
        const v = 92 + Math.random() * 30;
        ctx.fillStyle = `rgb(${v},${v - 13},${v - 24})`;
        ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
    }
    cracks(ctx, 6);
    speckle(ctx, 1800, 0.07);
    grime(ctx);
  } else if (kind === 'tile') {
    // 板瓦：横向瓦垄
    ctx.fillStyle = '#33302a';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const row = 42;
    for (let y = 0; y < SIZE; y += row) {
      for (let x = 0; x < SIZE; x += 30) {
        const v = 70 + Math.random() * 22;
        ctx.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
        ctx.fillRect(x + 1, y + 1, 28, row - 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(x + 15, y + row - 2, 14, Math.PI, 0);
        ctx.stroke();
      }
    }
    speckle(ctx, 1200, 0.08);
    grime(ctx);
  } else {
    // 夯土
    ctx.fillStyle = '#5c4a35';
    ctx.fillRect(0, 0, SIZE, SIZE);
    speckle(ctx, 6000, 0.13);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 24 + Math.random() * 50, 3);
    }
    // 小石子
    for (let i = 0; i < 60; i++) {
      const v = 120 + Math.random() * 60;
      ctx.fillStyle = `rgba(${v},${v - 15},${v - 30},0.6)`;
      ctx.beginPath();
      ctx.arc(Math.random() * SIZE, Math.random() * SIZE, 1 + Math.random() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    grime(ctx);
  }
  return c;
}

export function getTexture(kind: string): TexSet {
  let t = cache.get(kind);
  if (!t) {
    const canvas = makeCanvas(kind);
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const bump = new THREE.CanvasTexture(canvas);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    t = { map, bump };
    cache.set(kind, t);
  }
  return t;
}

/** 汉风壁画带：赭红底 + 几何镶边 + 云气纹 + 人物剪影（程序化示意） */
let muralCache: THREE.CanvasTexture | null = null;
export function getMuralTexture(): THREE.CanvasTexture {
  if (muralCache) return muralCache;
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  // 赭红底
  ctx.fillStyle = '#5a2e20';
  ctx.fillRect(0, 0, W, H);

  // 上下几何镶边：菱格纹
  const band = 26;
  ctx.fillStyle = '#2f1a12';
  ctx.fillRect(0, 0, W, band);
  ctx.fillRect(0, H - band, W, band);
  ctx.fillStyle = '#c9b48a';
  for (let x = 0; x < W; x += 16) {
    for (const y of [4, H - band + 4]) {
      ctx.beginPath();
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x + 16, y + 9);
      ctx.lineTo(x + 8, y + 18);
      ctx.lineTo(x, y + 9);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 云气纹：连续的 S 形卷曲线
  const swirl = (x0: number, y0: number, scale: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0 + 30 * scale, y0 - 34 * scale, x0 + 74 * scale, y0 - 30 * scale, x0 + 80 * scale, y0);
    ctx.bezierCurveTo(x0 + 84 * scale, y0 + 20 * scale, x0 + 60 * scale, y0 + 26 * scale, x0 + 52 * scale, y0 + 12 * scale);
    ctx.stroke();
    // 卷尾小圆
    ctx.beginPath();
    ctx.arc(x0 + 78 * scale, y0 - 2, 5 * scale, 0, Math.PI * 2);
    ctx.stroke();
  };
  for (let x = 10; x < W - 90; x += 110) {
    swirl(x, 96 + (Math.random() - 0.5) * 12, 1, 'rgba(201,180,138,0.85)');
    swirl(x + 46, 132 + (Math.random() - 0.5) * 12, 0.7, 'rgba(138,47,35,0.9)');
  }

  // 人物剪影行（朝拜 / 仪仗意象）
  ctx.fillStyle = '#241209';
  for (let x = 30; x < W - 20; x += 64) {
    const y = 196;
    ctx.beginPath(); // 头
    ctx.arc(x, y - 26, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); // 袍身
    ctx.moveTo(x - 10, y);
    ctx.quadraticCurveTo(x - 8, y - 22, x, y - 18);
    ctx.quadraticCurveTo(x + 8, y - 22, x + 10, y);
    ctx.closePath();
    ctx.fill();
  }

  // 做旧斑驳
  speckle(ctx, 1500, 0.1);
  ctx.fillStyle = 'rgba(90,46,32,0.5)';
  for (let i = 0; i < 24; i++) {
    ctx.fillRect(Math.random() * W, Math.random() * H, 8 + Math.random() * 30, 4 + Math.random() * 10);
  }

  muralCache = new THREE.CanvasTexture(c);
  muralCache.wrapS = THREE.RepeatWrapping;
  muralCache.colorSpace = THREE.SRGBColorSpace;
  muralCache.anisotropy = 4;
  return muralCache;
}
