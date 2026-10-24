import { expect, test } from 'bun:test';
import { growDesign, insertionSpace } from './design-bounds';
import { createNode, initialDocument, parseDocument } from './model';
function fixture() {
  const root = { ...createNode('layout.container'), id: 'root', colSpan: 20, rowSpan: 10, design: { width: 240, height: 120 } };
  root.layout!.padding = 0; root.props.borderWidth = 0;
  const child = { ...createNode('basic.button'), id: 'child', parentId: root.id };
  return [root, child];
}
test('原位编辑在原基准外放置内容时自动扩展，保持外部尺寸且不修改原文档', () => {
  const original = fixture(), snapshot = structuredClone(original);
  const moved = original.map(node => node.id === 'child' ? { ...node, col: 20, row: 12 } : node);
  const grown = growDesign(moved, original, 'root');
  expect(grown[0]).toMatchObject({ colSpan: 20, rowSpan: 10, design: { width: 408, height: 192 } });
  expect(parseDocument(JSON.stringify({ ...initialDocument(), nodes: grown })).nodes).toEqual(grown);
  expect(original).toEqual(snapshot);
});
test('明确缩小设计尺寸仍须校验；普通工作区和无关子树不自动扩展', () => {
  const original = fixture(); const moved = original.map(node => node.id === 'child' ? { ...node, col: 20 } : { ...node, design: { width: 300, height: 120 } });
  expect(growDesign(moved, original, 'root')).toBe(moved);
  expect(() => parseDocument(JSON.stringify({ ...initialDocument(), nodes: moved }))).toThrow('超出');
  expect(growDesign(moved, original, null)).toBe(moved); expect(growDesign(moved, original, 'other')).toBe(moved);
});
test('超出完整工作区时不无限扩大基准，也不裁掉或偷偷移动内容', () => {
  const original = fixture(); const moved = original.map(node => node.id === 'child' ? { ...node, col: 319, row: 239 } : node);
  const grown = growDesign(moved, original, 'root');
  expect(grown[0].design).toEqual({ width: 3840, height: 2880 }); expect(grown[1]).toEqual(moved[1]);
  expect(() => parseDocument(JSON.stringify({ ...initialDocument(), nodes: grown }))).toThrow('超出');
});
test('新增和复制在整张设计网格寻找空位，只有提交时才扩展原基准', () => {
  const original = fixture(); const space = insertionSpace(original, 'root', 'root');
  expect(space[0].design).toEqual({ width: 3840, height: 2880 }); expect(original[0].design).toEqual({ width: 240, height: 120 });
  expect(insertionSpace(original, 'other', 'root')).toBe(original); expect(insertionSpace(original, null, null)).toBe(original);
});
