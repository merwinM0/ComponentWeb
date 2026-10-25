import { expect, test } from 'bun:test';
import { HOME_POINTER_GRID, homePointer } from './home-pointer';

test('交互坐标以介绍区为基准，中心不产生偏转', () => {
  expect(homePointer(480, 200, 960, 400)).toEqual({ x: 480, y: 200, cellX: 480, cellY: 192, cellWidth: 32, cellHeight: 32, shiftX: 0, shiftY: 0, tiltX: -0, tiltY: 0 });
});
test('网格吸附与光标位置独立，不会修改实际指针坐标', () => {
  const point = homePointer(123.4567, 78.1234, 960, 400)!;
  expect(point.x).toBe(123.457); expect(point.y).toBe(78.123); expect(point.cellX).toBe(96); expect(point.cellY).toBe(64);
  expect(point.cellX % HOME_POINTER_GRID).toBe(0); expect(point.cellY % HOME_POINTER_GRID).toBe(0);
});
test('移出范围也不会产生越界选框或无限偏转', () => {
  const start = homePointer(-200, -100, 960, 400)!, end = homePointer(2000, 1000, 960, 400)!;
  expect(start).toMatchObject({ x: 0, y: 0, cellX: 0, cellY: 0, shiftX: -8, shiftY: -6, tiltX: 3, tiltY: -4 });
  expect(end).toMatchObject({ x: 960, y: 400, cellX: 928, cellY: 384, cellWidth: 32, cellHeight: 16, shiftX: 8, shiftY: 6, tiltX: -3, tiltY: 4 });
});
test('窄屏与小于一格的区域仍有合法选框', () => {
  for (const [width, height] of [[288, 380], [315.5, 240.25], [10, 8]]) {
    const point = homePointer(width, height, width, height)!;
    expect(point.cellX).toBeGreaterThanOrEqual(0); expect(point.cellY).toBeGreaterThanOrEqual(0);
    expect(point.cellX + point.cellWidth).toBeLessThanOrEqual(width); expect(point.cellY + point.cellHeight).toBeLessThanOrEqual(height);
  }
});
test('无效尺寸和非有限位置不参与交互', () => {
  for (const args of [[0, 0, 0, 400], [0, 0, 400, -1], [NaN, 0, 400, 400], [0, Infinity, 400, 400], [0, 0, Infinity, 400]]) expect(homePointer(...args as [number, number, number, number])).toBeNull();
});
