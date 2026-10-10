import { describe, it, expect } from 'vitest';
import { hitTestAnnotation, hexToRgba } from '../src/annotations/canvas';
import type { Annotation } from '../src/types';

describe('Annotations Math & Hit Testing', () => {
  it('AT-04: Hit test cho khung chữ nhật (rectangle) với tọa độ chuẩn hóa', () => {
    const rectAnno: Annotation = {
      id: 'r1',
      type: 'rectangle',
      x: 0.2,
      y: 0.2,
      width: 0.4,
      height: 0.3,
    };

    // Điểm nằm trong khung (0.3, 0.3)
    expect(hitTestAnnotation(rectAnno, 0.3, 0.3)).toBe(true);

    // Điểm nằm trên viền
    expect(hitTestAnnotation(rectAnno, 0.2, 0.2)).toBe(true);

    // Điểm nằm xa ngoài khung
    expect(hitTestAnnotation(rectAnno, 0.8, 0.8)).toBe(false);
  });

  it('AT-04: Hit test cho mũi tên (arrow)', () => {
    const arrowAnno: Annotation = {
      id: 'a1',
      type: 'arrow',
      x: 0.1,
      y: 0.1,
      x2: 0.5,
      y2: 0.5,
    };

    // Điểm nằm trên thân mũi tên (0.3, 0.3)
    expect(hitTestAnnotation(arrowAnno, 0.3, 0.3)).toBe(true);

    // Điểm nằm xa mũi tên
    expect(hitTestAnnotation(arrowAnno, 0.1, 0.9)).toBe(false);
  });

  it('AT-04: Hit test cho số thứ tự (number marker)', () => {
    const numAnno: Annotation = {
      id: 'n1',
      type: 'number',
      x: 0.5,
      y: 0.5,
      number: 1,
    };

    expect(hitTestAnnotation(numAnno, 0.5, 0.5)).toBe(true);
    expect(hitTestAnnotation(numAnno, 0.52, 0.51)).toBe(true);
    expect(hitTestAnnotation(numAnno, 0.8, 0.8)).toBe(false);
  });

  it('hexToRgba chuyển đổi mã màu hex chính xác', () => {
    expect(hexToRgba('#ef4444', 0.5)).toBe('rgba(239, 68, 68, 0.5)');
    expect(hexToRgba('#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
  });
});
