import type { Piece } from './cutup';

interface RenderOptions {
  bgColor: string;
  width: number; // css px of the table area being captured
  height: number;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderPiecesToPngBlob(pieces: Piece[], opts: RenderOptions): Promise<Blob> {
  const scale = 2;
  const width = opts.width * scale;
  const height = opts.height * scale;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas unavailable'));

  ctx.fillStyle = opts.bgColor;
  ctx.fillRect(0, 0, width, height);

  const paper = '#f6ecd9';
  const ink = '#2b2118';
  const padX = 14 * scale;
  const fontSize = 16 * scale;
  ctx.font = `${fontSize}px Georgia, "Times New Roman", serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  for (const piece of pieces) {
    const cx = (piece.x / 100) * width;
    const cy = (piece.y / 100) * height;
    const textWidth = ctx.measureText(piece.text).width;
    const boxW = textWidth + padX * 2;
    const boxH = fontSize * 1.7;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((piece.rot * Math.PI) / 180);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRect(ctx, -boxW / 2 + 2 * scale, -boxH / 2 + 3 * scale, boxW, boxH, 4 * scale);
    ctx.fill();

    ctx.fillStyle = paper;
    roundRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 4 * scale);
    ctx.fill();

    ctx.fillStyle = ink;
    ctx.fillText(piece.text, 0, 1 * scale);

    ctx.restore();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('export failed'))), 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string) {
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename);
}
