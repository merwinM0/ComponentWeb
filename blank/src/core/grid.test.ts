import { describe, expect, test } from 'bun:test';
import { CANVAS, GRID, LEGACY_GRID, FINE_GRID, catalogueSize } from './grid';
import { canPlace, createNode, initialDocument, parseDocument } from './model';
import { registry } from '../components/registry';

function oldDocument(version: 1 | 2) {
  const grid = version === 1 ? LEGACY_GRID : FINE_GRID;
  return { schemaVersion: version, grid, appearance: { background: '#102030', grid: '#80b0d0' }, nodes: [{
    id: 'existing-card', type: 'content.card', col: 72 / grid.cell, row: 72 / grid.cell,
    colSpan: (version === 1 ? 288 : 296) / grid.cell, rowSpan: 192 / grid.cell,
    props: { title: '保留我的布局', description: '旧记录', source: '', accent: '#8bd5ff', background: '#121e2b', text: '#edf6ff', border: '#34495c', radius: 16, borderWidth: 2, borderStyle: 'dashed' as const },
  }] };
}

describe('12px 网格与历史迁移', () => {
  test('网格调整为 80×60，画布保持 960×720', () => {
    expect(GRID.cell).toBe(12); expect(GRID.cols * GRID.cell).toBe(CANVAS.width); expect(GRID.rows * GRID.cell).toBe(CANVAS.height);
    expect(catalogueSize([12, 8])).toEqual([24, 16]);
  });
  test('默认组件和最小物理尺寸不变', () => {
    const card = createNode('content.card');
    expect([card.colSpan * GRID.cell, card.rowSpan * GRID.cell]).toEqual([288, 192]);
    expect(registry.get('content.card')!.min.map(value => value * GRID.cell)).toEqual([168, 120]);
    const sample = initialDocument().nodes[0]; expect([sample.col * GRID.cell, sample.row * GRID.cell]).toEqual([72, 72]);
  });
  test('支持 12px 间距与尺寸调整，仍禁止同级重叠', () => {
    const a = createNode('basic.button'); const b = { ...createNode('basic.button'), col: a.colSpan + 1 };
    expect((b.col - a.colSpan) * GRID.cell).toBe(12); expect(canPlace(b, [a])).toBe(true);
    expect(canPlace({ ...b, col: a.colSpan - 1 }, [a])).toBe(false);
  });
  for (const version of [1, 2] as const) test(`v${version} 迁移为 v3，保留精确像素几何和样式`, () => {
    const old = oldDocument(version); const migrated = parseDocument(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(3); expect(migrated.grid).toEqual(GRID); expect(migrated.appearance).toEqual(old.appearance);
    expect(migrated.nodes[0].props).toEqual(old.nodes[0].props); expect(migrated.nodes[0].parentId).toBeNull();
    for (const key of ['col', 'row', 'colSpan', 'rowSpan'] as const) expect(migrated.nodes[0][key] * GRID.cell).toBeCloseTo(old.nodes[0][key] * old.grid.cell);
    expect(parseDocument(JSON.stringify(migrated))).toEqual(migrated);
  });
  test('拒绝未知网格、版本错配和旧格式小数坐标', () => {
    const old = oldDocument(1);
    expect(() => parseDocument(JSON.stringify({ ...old, grid: GRID }))).toThrow();
    expect(() => parseDocument(JSON.stringify({ ...old, schemaVersion: 3 }))).toThrow();
    old.nodes[0].col = 1 / 3; expect(() => parseDocument(JSON.stringify(old))).toThrow();
  });
});
