import * as THREE from 'three';

export function createFloorGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070c18';
  ctx.fillRect(0, 0, size, size);

  // Subtle tile subdivisions
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  const step = 64;
  for (let i = 0; i <= size; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Major institutional tile seam
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);

  // Corner micro ticks
  ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
  ctx.fillRect(0, 0, 8, 2);
  ctx.fillRect(0, 0, 2, 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 12);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createScreenTexture(
  title: string,
  subtitle: string,
  accentHex: string,
  lines: string[],
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Screen dark glass backing
  ctx.fillStyle = '#050a14';
  ctx.fillRect(0, 0, w, h);

  // Top accent bar
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, w, 5);

  // Subtle grid background
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 32; x < w; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 42);
    ctx.lineTo(x, h - 16);
    ctx.stroke();
  }
  for (let y = 56; y < h; y += 32) {
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(w - 16, y);
    ctx.stroke();
  }

  // Header text
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 22px "Outfit", sans-serif';
  ctx.fillText(title, 20, 36);

  ctx.fillStyle = accentHex;
  ctx.font = '500 13px "JetBrains Mono", monospace';
  ctx.fillText(subtitle, 20, 58);

  // Honest status lines
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '400 14px "JetBrains Mono", monospace';
  lines.slice(0, 5).forEach((line, idx) => {
    ctx.fillText(line, 24, 98 + idx * 28);
  });

  // Footer border
  ctx.strokeStyle = accentHex;
  ctx.globalAlpha = 0.35;
  ctx.strokeRect(8, 10, w - 16, h - 20);
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createRoomLabelTexture(
  code: string,
  shortName: string,
  accentHex: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(8, 13, 26, 0.92)';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.fillStyle = accentHex;
  ctx.font = '600 22px "JetBrains Mono", monospace';
  ctx.fillText(code, 26, 46);

  ctx.fillStyle = '#f1f5f9';
  ctx.font = '700 34px "Outfit", sans-serif';
  ctx.fillText(shortName.toUpperCase(), 26, 94);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
