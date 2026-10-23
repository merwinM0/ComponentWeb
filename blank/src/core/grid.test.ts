import { describe, expect, test } from 'bun:test';
import { CANVAS, GRID, LEGACY_GRID, catalogueSize } from './grid';
import { canPlace, createNode, initialDocument, parseDocument } from './model';
import { registry } from '../components/registry';

function legacyDocument() {
  return {
    schemaVersion: 1, grid: { ...LEGACY_GRID }, appearance: { background: '#102030', grid: '#80b0d0' },
    nodes: [{
      id: 'existing-card', type: 'content.card', col: 3, row: 3, colSpan: 12, rowSpan: 8,
      props: { title: '保留我的布局', description: '旧版记录', source: '',
        accent: '#8bd5ff', background: '#121e2b', text: '#edf6ff', border: '#34495c', radius: 16, borderWidth: 2, borderStyle: 'dashed' as const },
    }],
  };
}

describe('细网格与旧布局迁移', () => {
  test('精度细化为 8px，画布实际尺寸仍是 960×720', () => {
    expect(GRID.cell).toBe(8);
    expect(GRID.cols * GRID.cell).toBe(CANVAS.width);
    expect(GRID.rows * GRID.cell).toBe(CANVAS.height);
    expect(catalogueSize([12, 8])).toEqual([36, 24]);
  });
  test('默认组件和最小尺寸的像素值不变', () => {
    const card = createNode('content.card');
    expect([card.colSpan * GRID.cell, card.rowSpan * GRID.cell]).toEqual([288, 192]);
    expect(registry.get('content.card')!.min.map(value => value * GRID.cell)).toEqual([168, 120]);
    const sample = initialDocument().nodes[0];
    expect([sample.col * GRID.cell, sample.row * GRID.cell]).toEqual([72, 72]);
  });
  test('允许 8px 间距和 8px 尺寸微调，仍然禁止重叠', () => {
    const a = createNode('basic.button');
    const b = { ...createNode('basic.button'), col: a.colSpan + 1 };
    expect((b.col - a.colSpan) * GRID.cell).toBe(8);
    expect(canPlace(b, [a])).toBe(true);
    expect(canPlace({ ...b, col: a.colSpan - 1 }, [a])).toBe(false);
    const card = createNode('content.card');
    expect(canPlace({ ...card, colSpan: card.colSpan - 1, rowSpan: card.rowSpan - 1 }, [])).toBe(true);
  });
  test('v1 记录转为 v2 后像素位置、尺寸、ID 和样式不变', () => {
    const old = legacyDocument();
    const migrated = parseDocument(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.grid).toEqual(GRID);
    expect(migrated.appearance).toEqual(old.appearance);
    expect(migrated.nodes[0].id).toBe(old.nodes[0].id);
    expect(migrated.nodes[0].props).toEqual(old.nodes[0].props);
    for (const key of ['col', 'row', 'colSpan', 'rowSpan'] as const) {
      expect(migrated.nodes[0][key] * GRID.cell).toBe(old.nodes[0][key] * LEGACY_GRID.cell);
    }
    expect(parseDocument(JSON.stringify(migrated))).toEqual(migrated);
  });
  test('拒绝未知网格、版本与网格不匹配、旧小数坐标和越界', () => {
    const old = legacyDocument();
    expect(() => parseDocument(JSON.stringify({ ...old, grid: GRID }))).toThrow();
    expect(() => parseDocument(JSON.stringify({ ...old, schemaVersion: 2 }))).toThrow();
    expect(() => parseDocument(JSON.stringify({ ...old, grid: { ...LEGACY_GRID, cell: 12 } }))).toThrow();
    for (const col of [1 / 3, -1, LEGACY_GRID.cols]) {
      const invalid = legacyDocument(); invalid.nodes[0].col = col;
      expect(() => parseDocument(JSON.stringify(invalid))).toThrow();
    }
  });
  test('迁移后依然检测重叠', () => {
    const old = legacyDocument();
    old.nodes.push({ ...structuredClone(old.nodes[0]), id: 'overlap' });
    expect(() => parseDocument(JSON.stringify(old))).toThrow();
  });
});
