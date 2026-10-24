import { expect, test } from 'bun:test';
import { createNode } from './model';
import { regionOf, editRegionError, resizeEditingNode, workingSize, moveEditingRegion } from './edit-region';
import { assembleNodes } from './assembly';
import { fitsNativeSurface, nativeSurface } from './element-edits';
import { validateTree } from './tree';

test('普通组件和布局容器都可显式调整编辑框，显示尺寸保持独立', () => {
  for (const type of ['content.card', 'layout.container']) {
    const node = createNode(type), source = structuredClone(node), resized = resizeEditingNode(node, 600, 480);
    expect(workingSize(resized)).toEqual({ width: 600, height: 480 });
    expect(resized.colSpan).toBe(source.colSpan); expect(resized.rowSpan).toBe(source.rowSpan); expect(node).toEqual(source);
  }
});
test('越界添加、拖动和组装被拒绝，不能反向撑大编辑框', () => {
  const root = { ...createNode('basic.button'), id: 'root', col: 2, row: 2 };
  const piece = { ...createNode('basic.button'), id: 'piece', col: 20, row: 2 };
  const before = structuredClone(root);
  expect(editRegionError([root, piece], root.id)).toContain('先扩大');
  expect(() => assembleNodes([root, piece], root.id, root)).toThrow('先扩大');
  expect(root).toEqual(before);
  const enlarged = resizeEditingNode(root, 480, 240);
  expect(editRegionError([enlarged, piece], root.id)).toBeNull();
  const assembled = assembleNodes([enlarged, piece], root.id, root);
  expect(workingSize(assembled.find(node => node.id === root.id)!)).toEqual({ width: 480, height: 240 });
  expect(validateTree(assembled, true)).toBeNull();
});
test('布局容器的边框与内边距也是放置边界', () => {
  const root = { ...createNode('layout.container'), id: 'root', col: 4, row: 4 };
  const area = regionOf(root, true), piece = createNode('basic.button');
  expect(editRegionError([root, { ...piece, col: root.col, row: root.row }], root.id)).toContain('超出');
  expect(editRegionError([root, { ...piece, col: area.col, row: area.row }], root.id)).toBeNull();
});
test('缩小容器不能裁掉已有子组件，需先整理内容', () => {
  const root = { ...createNode('layout.container'), id: 'root' }; root.layout!.padding = 0; root.props.borderWidth = 0;
  const child = { ...createNode('basic.button'), parentId: root.id, col: 20 };
  expect(validateTree([resizeEditingNode(root, 240, 192), child], true)).toContain('超出');
  expect(validateTree([resizeEditingNode(root, 480, 192), child], true)).toBeNull();
});
test('移动整个编辑框时散件跟随，不改变相对坐标或组件大小', () => {
  const root = { ...createNode('content.card'), id: 'root', col: 2, row: 2 }, piece = { ...createNode('basic.button'), col: 3, row: 3 };
  const original = [root, piece], moved = moveEditingRegion([{ ...root, col: 10, row: 8 }, piece], original, root.id);
  expect(moved[1]).toMatchObject({ col: 11, row: 9 }); expect(editRegionError(moved, root.id)).toBeNull();
  expect(workingSize(moved[0])).toEqual(workingSize(root)); expect(original[1].col).toBe(3);
});
test('旧版外扩和偏移数据显式放大时保留布局基准，不重新拉长偏移标签', () => {
  const root = { ...createNode('content.card'), surface: { baseWidth: 288, baseHeight: 192, x: 0, y: 0, width: 504, height: 240 }, elements: [{ path: [0, 1], tag: 'h3', style: { x: 240 } }] };
  const resized = resizeEditingNode(root, 600, 480);
  expect(resized.surface).toMatchObject({ baseWidth: 288, baseHeight: 192, width: 600, height: 480 });
  expect(resized.elements).toEqual(root.elements); expect(root.surface.width).toBe(504);
});
test('标签范围只做校验，不能通过标签移动或改字号扩大原生组件', () => {
  const frame = nativeSurface(createNode('content.card'));
  expect(fitsNativeSurface({ ...frame, x: 24, y: 24, width: 120, height: 48 }, frame)).toBe(true);
  expect(fitsNativeSurface({ ...frame, x: -12 }, frame)).toBe(false);
  expect(fitsNativeSurface({ ...frame, width: frame.width + 12 }, frame)).toBe(false);
  expect(fitsNativeSurface({ ...frame, height: frame.height + 12 }, frame)).toBe(false);
});
