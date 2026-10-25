import { expect, test } from 'bun:test';
import { createNode, findSpace, initialDocument, parseDocument } from './model';
import { CONTAINER_SKINS, skinSvg } from '../components/container/skins';
import { containerGeometry } from './container-geometry';
import { contentSize, validateTree } from './tree';
import { regionOf, editRegionError, resizeEditingNode } from './edit-region';
import { cloneForest } from './operations';
import { captureCombination } from './combinations';
import { Store } from './store';
import { StoreRouter } from './store-router';
import { InlineEdit } from './inline-edit';

function panel() { const root = createNode('layout.container'); root.id = 'panel'; root.col = 2; root.row = 2; root.colSpan = 30; root.rowSpan = 20; root.design = { width: 360, height: 240 }; return root; }

test('旧矩形几何与存档不变，padding 和 border 只计算一次', () => {
  const root = panel(), geometry = containerGeometry(root);
  expect(geometry.content).toEqual({ x: 13, y: 13, width: 334, height: 214 });
  expect(contentSize(root)).toEqual({ cols: 334 / 12, rows: 214 / 12 });
  expect(parseDocument(JSON.stringify({ ...initialDocument(), nodes: [root] })).nodes[0]).toEqual(root);
});
test('三款安全区与内容区使用统一模型，非对称预留不改变外部占位', () => {
  for (const skin of CONTAINER_SKINS) {
    const root = { ...panel(), skin: skin.id };
    const geometry = containerGeometry(root), area = regionOf(root, true);
    expect(geometry.content.x).toBe(skin.insets.left + 13);
    expect(geometry.content.y).toBe(skin.insets.top + 13);
    expect(area.col).toBe(root.col + geometry.content.x / 12);
    expect(area.row).toBe(root.row + geometry.content.y / 12);
    expect(area.cols).toBe(contentSize(root).cols);
    expect(area.rows).toBe(contentSize(root).rows);
    expect(regionOf(root)).toEqual({ col: 2, row: 2, cols: 30, rows: 20 });
  }
});
test('SVG 自由子项拒绝进入票根或尾角，添加找空位使用新内容尺寸', () => {
  const root = { ...panel(), skin: 'ticket' as const };
  const child = { ...createNode('basic.button'), parentId: root.id, col: 0, row: 0 };
  expect(validateTree([root, child])).toBeNull();
  const insideOldRectangle = { ...child, col: 22 };
  expect(validateTree([root, insideOldRectangle])).toContain('内容区');
  const found = findSpace(child, [root]); expect(found?.col).toBe(0);
  const tooWide = { ...child, colSpan: 24 };
  expect(findSpace(tooWide, [root])).toBeUndefined();
  const loose = { ...child, parentId: null, ...regionOf(root, true) };
  expect(editRegionError([root, loose], root.id)).toBeNull();
  expect(editRegionError([root, { ...loose, row: root.row }], root.id)).toContain('不能超出');
});
test('背景最小设计尺寸、未知 ID、非容器和注入字段均被校验', () => {
  const doc = { ...initialDocument(), nodes: [panel()] };
  for (const skin of ['unknown', '<svg onload=alert(1)>', {}, null]) expect(() => parseDocument(JSON.stringify({ ...doc, nodes: [{ ...panel(), skin }] }))).toThrow('背景类型');
  const button = { ...createNode('basic.button'), skin: 'paper' };
  expect(() => parseDocument(JSON.stringify({ ...doc, nodes: [button] }))).toThrow('背景类型');
  const root = { ...panel(), skin: 'paper' as const, design: { width: 120, height: 96 } };
  expect(() => parseDocument(JSON.stringify({ ...doc, nodes: [root] }))).toThrow('至少');
  expect(() => skinSvg('paper', 120, 96)).toThrow('最小');
  expect(() => skinSvg('paper', NaN, 240)).toThrow();
  expect(() => skinSvg('paper', 360, 240, 13)).toThrow();
});
test('皮肤切换不能默默挤出原子项，缩小设计尺寸仍校验安全区', () => {
  const root = panel(), child = { ...createNode('basic.button'), parentId: root.id, col: 12, row: 12 };
  const doc = { ...initialDocument(), nodes: [root, child] };
  expect(() => parseDocument(JSON.stringify(doc))).not.toThrow();
  expect(() => parseDocument(JSON.stringify({ ...doc, nodes: [{ ...root, skin: 'bubble' }, child] }))).toThrow('内容区');
  const resized = resizeEditingNode({ ...root, skin: 'paper' }, 192, 144);
  expect(validateTree([resized, child])).toContain('内容区');
});
test('皮肤与颜色可保存、复制、组合和历史恢复，不影响工作台主题', () => {
  const root = { ...panel(), skin: 'bubble' as const, props: { ...panel().props, ...CONTAINER_SKINS[2].palette } };
  const doc = { ...initialDocument(), nodes: [root] };
  const parsed = parseDocument(JSON.stringify(doc)); expect(parsed.nodes[0]).toEqual(root);
  expect(cloneForest(parsed.nodes, [root.id]).nodes[0].skin).toBe('bubble');
  expect(captureCombination(parsed, [root.id]).nodes[0].skin).toBe('bubble');
  const store = new Store({ ...doc, nodes: [panel()] }); store.commit(parsed); store.undo();
  expect(store.doc.nodes[0].skin).toBeUndefined(); store.redo(); expect(store.doc.nodes[0].skin).toBe('bubble');
  expect(store.doc.appearance).toEqual(initialDocument().appearance);
});
test('删除 SVG 编辑根后按上次安全区重组，保留背景与原尺寸', () => {
  const root = { ...panel(), skin: 'bubble' as const };
  const workspace = new Store({ ...initialDocument(), nodes: [root] }), router = new StoreRouter(workspace), session = new InlineEdit(router);
  session.open(root.id, { selection: [root.id], zoom: 1, left: 0, top: 0 });
  const area = session.current!.contentBounds;
  const loose = { ...createNode('basic.button'), col: area.col, row: area.row };
  router.commit({ ...router.doc, nodes: [...router.doc.nodes, loose] });
  router.commit({ ...router.doc, nodes: [loose] });
  session.assemble();
  expect(session.root!.skin).toBe('bubble');
  expect(session.root!.design).toEqual({ width: 360, height: 240 });
  const child = router.doc.nodes.find(n => n.id === loose.id)!;
  expect(child.parentId).toBe(root.id); expect(child.col).toBe(0); expect(child.row).toBe(0);
  session.finish(); expect(workspace.doc.nodes[0].skin).toBe('bubble');
});
