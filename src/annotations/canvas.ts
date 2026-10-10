import type { Annotation } from '../types';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  scaleX: number; // canvasWidth / naturalWidth
  scaleY: number; // canvasHeight / naturalHeight
  selectedId?: string | null;
}

// Convert hex color to rgba with opacity
export function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(239, 68, 68, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Draw a single annotation
export function drawAnnotation(anno: Annotation, rc: RenderContext) {
  const { ctx, canvasWidth, canvasHeight, selectedId } = rc;
  const isSelected = selectedId === anno.id;

  const color = anno.style?.color || '#ef4444';
  const lineWidth = (anno.style?.lineWidth || 3) * Math.min(rc.scaleX, rc.scaleY);

  ctx.save();

  if (anno.type === 'rectangle') {
    const rx = anno.x * canvasWidth;
    const ry = anno.y * canvasHeight;
    const rw = (anno.width || 0) * canvasWidth;
    const rh = (anno.height || 0) * canvasHeight;

    // Soft tinted background
    ctx.fillStyle = hexToRgba(color, 0.12);
    ctx.fillRect(rx, ry, rw, rh);

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, lineWidth);
    ctx.strokeRect(rx, ry, rw, rh);

    // Selection highlight handles
    if (isSelected) {
      drawSelectionBox(ctx, rx, ry, rw, rh);
    }
  } else if (anno.type === 'arrow') {
    const fromX = anno.x * canvasWidth;
    const fromY = anno.y * canvasHeight;
    const toX = (anno.x2 ?? anno.x) * canvasWidth;
    const toY = (anno.y2 ?? anno.y) * canvasHeight;

    const angle = Math.atan2(toY - fromY, toX - fromX);
    const headLength = Math.max(12, 16 * Math.min(rc.scaleX, rc.scaleY));

    // Arrow line
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, lineWidth);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    if (isSelected) {
      drawHandle(ctx, fromX, fromY);
      drawHandle(ctx, toX, toY);
    }
  } else if (anno.type === 'number') {
    const cx = anno.x * canvasWidth;
    const cy = anno.y * canvasHeight;
    const radius = Math.max(12, 16 * Math.min(rc.scaleX, rc.scaleY));

    // Outer shadow / contrast border
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Circle background
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Number text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(12, Math.round(radius * 1.1))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(anno.number || 1), cx, cy);

    if (isSelected) {
      drawSelectionBox(ctx, cx - radius - 2, cy - radius - 2, (radius + 2) * 2, (radius + 2) * 2);
    }
  } else if (anno.type === 'text') {
    const tx = anno.x * canvasWidth;
    const ty = anno.y * canvasHeight;
    const text = anno.text || 'Ghi chú';
    const fontSize = Math.max(12, (anno.style?.fontSize || 14) * Math.min(rc.scaleX, rc.scaleY));

    ctx.font = `500 ${fontSize}px system-ui, sans-serif`;
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const paddingX = 8;
    const paddingY = 6;
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = fontSize + paddingY * 2;

    // Rounded background pill
    const rx = tx;
    const ry = ty;
    drawRoundedRect(ctx, rx, ry, boxWidth, boxHeight, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, lineWidth * 0.75);
    ctx.stroke();

    // Text inside
    ctx.fillStyle = anno.style?.color || '#0f172a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(text, rx + paddingX, ry + paddingY);

    if (isSelected) {
      drawSelectionBox(ctx, rx - 2, ry - 2, boxWidth + 4, boxHeight + 4);
    }
  }

  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);

  // Corner dots
  drawHandle(ctx, x - 2, y - 2);
  drawHandle(ctx, x + w + 2, y - 2);
  drawHandle(ctx, x - 2, y + h + 2);
  drawHandle(ctx, x + w + 2, y + h + 2);
  ctx.restore();
}

// Hit-test an annotation from normalized point (nx, ny)
export function hitTestAnnotation(
  anno: Annotation,
  nx: number,
  ny: number,
  aspectRatio = 1
): boolean {
  const threshold = 0.03; // ~3% tolerance

  if (anno.type === 'rectangle') {
    const minX = Math.min(anno.x, anno.x + (anno.width || 0));
    const maxX = Math.max(anno.x, anno.x + (anno.width || 0));
    const minY = Math.min(anno.y, anno.y + (anno.height || 0));
    const maxY = Math.max(anno.y, anno.y + (anno.height || 0));

    return nx >= minX - threshold && nx <= maxX + threshold && ny >= minY - threshold && ny <= maxY + threshold;
  }

  if (anno.type === 'arrow') {
    const x1 = anno.x;
    const y1 = anno.y;
    const x2 = anno.x2 ?? anno.x;
    const y2 = anno.y2 ?? anno.y;

    // Distance from point to line segment
    const dx = x2 - x1;
    const dy = (y2 - y1) * aspectRatio;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return Math.hypot(nx - x1, (ny - y1) * aspectRatio) <= threshold;

    let t = ((nx - x1) * dx + (ny - y1) * aspectRatio * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = (y1 * aspectRatio + t * dy) / aspectRatio;

    const dist = Math.hypot(nx - projX, (ny - projY) * aspectRatio);
    return dist <= threshold;
  }

  if (anno.type === 'number') {
    const dist = Math.hypot(nx - anno.x, (ny - anno.y) * aspectRatio);
    return dist <= threshold * 1.5;
  }

  if (anno.type === 'text') {
    const w = 0.25; // estimated text box width
    const h = 0.06;
    return nx >= anno.x - 0.01 && nx <= anno.x + w && ny >= anno.y - 0.01 && ny <= anno.y + h;
  }

  return false;
}

// Rasterize annotations onto screenshot copy at native resolution
export async function rasterizeAnnotationsToImage(
  dataUrl: string,
  annotations: Annotation[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const width = img.naturalWidth || 1024;
        const height = img.naturalHeight || 640;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Draw original image
        ctx.drawImage(img, 0, 0, width, height);

        // Draw all annotations at 1:1 scale
        const rc: RenderContext = {
          ctx,
          canvasWidth: width,
          canvasHeight: height,
          scaleX: 1,
          scaleY: 1,
          selectedId: null,
        };

        for (const anno of annotations) {
          drawAnnotation(anno, rc);
        }

        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      resolve(dataUrl); // Fallback to raw dataUrl if load fails
    };
    img.src = dataUrl;
  });
}
