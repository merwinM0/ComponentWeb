import { describe, expect, test } from 'bun:test';
import { designSize, displayScale, validDesign } from './design-space';
import { createNode, initialDocument, parseDocument } from './model';
import { contentSize } from './tree';
import { groupNodes, cloneForest } from './operations';
import { InlineEdit } from './inline-edit';
import { Store } from './store';
import { StoreRouter } from './store-router';
import { FINE_GRID, LEGACY_GRID, CLASSIC_GRID } from './grid';

const view = { selection: [], zoom: 1, left: 0, top: 0 };
function fixture() {
  const root = { ...createNode('layout.container'), id: 'root', col: 2, row: 2, colSpan: 25, rowSpan: 15, design: { width: 600, height: 360 } };
  root.layout!.padding = 0; root.props.borderWidth = 0;
  const child = { ...createNode('basic.button'), id: 'child', parentId: root.id, col: 30, row: 10 };
  return { ...initialDocument(), nodes: [root, child] };
}

describe('组合内部设计空间与外部显示尺寸', () => {
  test('缩小外部边界不移动、不裁剪子项，校验仍使用内部设计尺寸', () => {
    const doc = fixture(); const sourceChild = structuredClone(doc.nodes[1]);
    const small = parseDocument(JSON.stringify({ ...doc, nodes: doc.nodes.map(node => node.id === 'root' ? { ...node, colSpan: 8, rowSpan: 4 } : node) }));
    expect(small.nodes[1]).toEqual(sourceChild); expect(contentSize(small.nodes[0])).toEqual({ cols: 50, rows: 30 });
    expect(displayScale(small.nodes[0])).toEqual({ x: 96 / 600, y: 48 / 360 });
    expect(() => parseDocument(JSON.stringify({ ...doc, nodes: doc.nodes.map(node => node.id === 'root' ? { ...node, design: { width: 192, height: 360 } } : node) }))).toThrow('超出');
  });
  test('旧 v3 容器补齐原像素基准，不改变显示范围和任何子项坐标', () => {
    const doc = fixture(); delete doc.nodes[0].design;
    doc.nodes[0].colSpan = 50; doc.nodes[0].rowSpan = 30;
    const result = parseDocument(JSON.stringify({ ...doc, schemaVersion: 3, grid: CLASSIC_GRID }));
    expect(result.nodes[0].design).toEqual({ width: 600, height: 360 });
    expect(result.nodes[1]).toEqual(doc.nodes[1]); expect(displayScale(result.nodes[0])).toEqual({ x: 1, y: 1 });
  });
  test('24px / 8px 旧记录先迁移像素几何，再建立设计基准', () => {
    for (const [schemaVersion, grid] of [[1, LEGACY_GRID], [2, FINE_GRID]] as const) {
      const doc = fixture(); doc.nodes[0].colSpan = 30; doc.nodes[0].rowSpan = 20; doc.nodes[1].parentId = null; doc.nodes[1].col = 40; doc.nodes[1].row = 2;
      const nodes = doc.nodes.map(node => { const copy = { ...node }; delete copy.design;
        for (const key of ['col', 'row', 'colSpan', 'rowSpan'] as const) copy[key] *= 12 / grid.cell;
        return copy;
      });
      const result = parseDocument(JSON.stringify({ ...doc, schemaVersion, grid, nodes }));
      expect(result.nodes[0].design).toEqual({ width: 360, height: 240 });
      expect(result.nodes[1]).toEqual(doc.nodes[1]);
    }
  });
  test('组合的初始基准是实际包围盒，复制保留各层独立基准', () => {
    const a = createNode('basic.button'), b = { ...createNode('basic.button'), col: 20, row: 8 };
    const group = groupNodes([a, b], [a.id, b.id]);
    expect(designSize(group.container)).toEqual({ width: group.container.colSpan * 12, height: group.container.rowSpan * 12 });
    expect(displayScale(group.container)).toEqual({ x: 1, y: 1 });
    const copied = cloneForest(group.nodes, [group.container.id]);
    expect(copied.nodes.find(node => !node.parentId)!.design).toEqual(group.container.design);
    expect(copied.nodes.find(node => !node.parentId)!.design).not.toBe(group.container.design);
  });
  test('原位编辑沿用原结构，扩大基准不改变外部范围，重新进入不反向缩小', () => {
    const workspace = new Store(fixture()), router = new StoreRouter(workspace), designer = new InlineEdit(router);
    const original = structuredClone(workspace.doc);
    designer.open('root', view, undefined, { colSpan: 25, rowSpan: 15 });
    expect(designer.root!.design).toEqual({ width: 600, height: 360 }); expect(router.doc.nodes[1]).toEqual(original.nodes[1]);
    router.commit({ ...router.doc, nodes: router.doc.nodes.map(node => node.id === 'root' ? { ...node, design: { width: 960, height: 720 } } : node) });
    expect(workspace.doc).toEqual(original); designer.finish();
    expect(workspace.doc.nodes[0]).toMatchObject({ col: 2, row: 2, colSpan: 25, rowSpan: 15, design: { width: 960, height: 720 } });
    expect(workspace.doc.nodes[1]).toEqual(original.nodes[1]);
    designer.open('root', view); expect(designer.root!.design).toEqual({ width: 960, height: 720 }); designer.finish();
    workspace.undo(); expect(workspace.doc).toEqual(original);
    workspace.redo(); expect(workspace.doc.nodes[0].design).toEqual({ width: 960, height: 720 });
  });
  test('内部设计空间可大于工作区，外部显示范围保持原大小', () => {
    const doc = fixture(); doc.nodes[0].design = { width: 1920, height: 1440 };
    const result = parseDocument(JSON.stringify(doc)); expect(result.nodes[0].design).toEqual({ width: 1920, height: 1440 });
    expect(result.nodes[0].colSpan).toBe(25); expect(result.nodes[1]).toEqual(doc.nodes[1]);
  });
  test('设计元数据拒绝非法数值，清除未知字段，叶子节点不保留设计配置', () => {
    const doc = fixture();
    for (const value of [null, [], {}, { width: 0, height: 48 }, { width: '600', height: 360 }, { width: 3841, height: 720 }, { width: 600, height: NaN }]) {
      expect(validDesign(value)).toBe(false);
      expect(() => parseDocument(JSON.stringify({ ...doc, nodes: [{ ...doc.nodes[0], design: value }] }))).toThrow('设计尺寸');
    }
    const parsed = parseDocument(JSON.stringify({ ...doc, nodes: doc.nodes.map(node => ({ ...node, design: { width: 600, height: 360, injected: true } })) }));
    expect(parsed.nodes[0].design).toEqual({ width: 600, height: 360 }); expect(parsed.nodes[1].design).toBeUndefined();
  });
});
