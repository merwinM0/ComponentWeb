import { describe, expect, test } from 'bun:test';
import { CANVAS, GRID, LEGACY_GRID, FINE_GRID, CLASSIC_GRID, LARGE_GRID, catalogueSize } from './grid';
import { canPlace, createNode, initialDocument, parseDocument } from './model';
import { registry } from '../components/registry';

function oldDocument(version: 1 | 2 | 3) {
  const grid = version === 1 ? LEGACY_GRID : version === 2 ? FINE_GRID : CLASSIC_GRID;
  return { schemaVersion: version, grid, appearance: { background: '#102030', grid: '#80b0d0' }, nodes: [{
    id: 'existing-card', type: 'content.card', col: 72 / grid.cell, row: 72 / grid.cell,
    colSpan: (version === 1 ? 288 : 296) / grid.cell, rowSpan: 192 / grid.cell,
    props: { title: '保留我的布局', description: '旧记录', source: '', accent: '#8bd5ff', background: '#121e2b', text: '#edf6ff', border: '#34495c', radius: 16, borderWidth: 2, borderStyle: 'dashed' as const },
  }] };
}

describe('桌面横屏比例、12px 网格与历史迁移', () => {
  test('默认画布为适度的 16:9 基准，网格步长不变', () => {
    expect(CANVAS).toEqual({ width: 1344, height: 756 }); expect(GRID).toEqual({ cols: 112, rows: 63, cell: 12 });
    expect(GRID.cols * GRID.cell).toBe(CANVAS.width); expect(GRID.rows * GRID.cell).toBe(CANVAS.height);
    expect(CANVAS.width / CANVAS.height).toBe(16 / 9);
    expect(catalogueSize([12, 8])).toEqual([24, 16]);
  });
  test('扩大只增加边界，默认组件位置、尺寸和最小物理尺寸不变', () => {
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
  for (const version of [1, 2, 3] as const) test(`v${version} 迁移为 v5，保留精确像素几何和样式`, () => {
    const old = oldDocument(version); const migrated = parseDocument(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(5); expect(migrated.grid).toEqual(GRID); expect(migrated.appearance).toEqual(old.appearance);
    expect(migrated.nodes[0].props).toEqual(old.nodes[0].props); expect(migrated.nodes[0].parentId).toBeNull();
    for (const key of ['col', 'row', 'colSpan', 'rowSpan'] as const) expect(migrated.nodes[0][key] * GRID.cell).toBeCloseTo(old.nodes[0][key] * old.grid.cell);
    expect(parseDocument(JSON.stringify(migrated))).toEqual(migrated);
  });
  test('v3 嵌套、标签修改、原生尺寸基准、亚网格坐标和 ID 全部原样保留', () => {
    const root = { ...createNode('layout.container'), col: 2, row: 2, design: { width: 720, height: 480 } };
    const child = { ...createNode('basic.button'), parentId: root.id, col: 1.5, row: 2.25, elements: [{ path: [0, 0], tag: 'span', text: '旧标签', style: { color: '#123456' } }], surface: { baseWidth: 168, baseHeight: 48, x: 0, y: 0, width: 168, height: 48 } };
    const doc = parseDocument(JSON.stringify({ ...initialDocument(), nodes: [root, child] }));
    const migrated = parseDocument(JSON.stringify({ ...doc, schemaVersion: 3, grid: CLASSIC_GRID }));
    expect(migrated.nodes).toEqual(doc.nodes); expect(migrated.appearance).toEqual(doc.appearance); expect(migrated.schemaVersion).toBe(5);
    expect(parseDocument(JSON.stringify(migrated))).toEqual(migrated);
  });
  test('16:9 画布的真实边缘可放置和保存，边界外仍拒绝', () => {
    const node = { ...createNode('basic.button'), col: 90, row: 50 };
    expect(canPlace(node, [])).toBe(true);
    const edge = { ...node, col: GRID.cols - node.colSpan, row: GRID.rows - node.rowSpan };
    expect(canPlace(edge, [])).toBe(true); expect(canPlace({ ...edge, col: edge.col + 1 }, [])).toBe(false);
    const doc = { ...initialDocument(), nodes: [edge] }; expect(parseDocument(JSON.stringify(doc))).toEqual(doc);
  });
  test('v4 普通旧布局恢复 16:9，不沿用错误的超大像素范围', () => {
    const doc = initialDocument(), old = { ...doc, schemaVersion: 4, grid: LARGE_GRID };
    const migrated = parseDocument(JSON.stringify(old)); expect(migrated.grid).toEqual(GRID); expect(migrated.nodes).toEqual(doc.nodes);
  });
  test('v4 远处内容保留原范围和像素数据，不裁剪、不压缩节点', () => {
    const node = { ...createNode('basic.button'), col: 250, row: 150 };
    const migrated = parseDocument(JSON.stringify({ ...initialDocument(), schemaVersion: 4, grid: LARGE_GRID, nodes: [node] }));
    expect(migrated.grid).toEqual(LARGE_GRID); expect(migrated.nodes[0]).toEqual(node);
    expect(migrated.nodes[0]).toMatchObject({ id: node.id, col: 250, row: 150, colSpan: node.colSpan, rowSpan: node.rowSpan });
    expect(canPlace(node, [], LARGE_GRID)).toBe(true); expect(canPlace(node, [])).toBe(false);
  });
  test('新画布不能掩盖原本已越界的旧存档', () => {
    for (const version of [1, 2, 3] as const) {
      const old = oldDocument(version); old.nodes[0].col = old.grid.cols - old.nodes[0].colSpan + 1;
      expect(() => parseDocument(JSON.stringify(old))).toThrow();
    }
  });
  test('兼容 v3 临时编辑草稿原有的大编辑范围，不把它裁回旧主画布', () => {
    const old = oldDocument(3); old.nodes[0].col = 90; old.nodes[0].row = 80;
    expect(parseDocument(JSON.stringify(old), true).nodes[0]).toMatchObject({ col: 90, row: 80 });
  });
  test('拒绝未知网格、版本错配和旧格式小数坐标', () => {
    const old = oldDocument(1);
    expect(() => parseDocument(JSON.stringify({ ...old, grid: GRID }))).toThrow();
    expect(() => parseDocument(JSON.stringify({ ...old, schemaVersion: 3 }))).toThrow();
    expect(() => parseDocument(JSON.stringify({ ...initialDocument(), grid: CLASSIC_GRID }))).toThrow();
    old.nodes[0].col = 1 / 3; expect(() => parseDocument(JSON.stringify(old))).toThrow();
  });
});
