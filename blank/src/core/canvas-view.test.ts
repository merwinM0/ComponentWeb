import { expect, test } from 'bun:test';
import { fitCanvasScale } from './canvas-view';
import { CANVAS } from './grid';

test('默认设计画布为 16:9，而不是上一版超大 4:3', () => {
  expect(CANVAS.width / CANVAS.height).toBe(16 / 9); expect(CANVAS.width).toBeLessThan(1920); expect(CANVAS.height).toBeLessThan(1080);
});
test('适应模式按可见工作区统一缩放，完整显示并尽量使用可用空间', () => {
  for (const [width, height] of [[500, 400], [900, 600], [1334, 794], [2700, 1300]]) {
    const scale = fitCanvasScale(width, height, CANVAS)!;
    expect(CANVAS.width * scale).toBeLessThanOrEqual(width - 4 + 1e-6); expect(CANVAS.height * scale).toBeLessThanOrEqual(height - 4 + 1e-6);
    expect(Math.min(width - 4 - CANVAS.width * scale, height - 4 - CANVAS.height * scale)).toBeCloseTo(0);
    expect(CANVAS.width * scale / (CANVAS.height * scale)).toBeCloseTo(16 / 9);
  }
});
test('旧大画布同样只调整显示倍率，不要求重写或裁剪内容', () => {
  const size = { width: 3840, height: 2880 }, copy = { ...size }, scale = fitCanvasScale(900, 600, size)!;
  expect(size).toEqual(copy); expect(scale).toBeLessThan(1); expect(size.height * scale).toBeLessThanOrEqual(596);
});
test('隐藏或无效工作区不会得到 NaN、无限倍率或错误尺寸', () => {
  for (const [width, height] of [[0, 600], [900, 0], [4, 4], [NaN, 600], [900, Infinity]]) expect(fitCanvasScale(width, height, CANVAS)).toBeNull();
  expect(fitCanvasScale(900, 600, { width: -1, height: 50 })).toBeNull();
});
