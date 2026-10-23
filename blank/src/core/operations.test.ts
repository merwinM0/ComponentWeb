import { describe, expect, test } from 'bun:test';
import { alignNodes, cloneForest, distributeNodes, groupNodes, moveNodes, placeForest, reorderNodes } from './operations';
import { createNode, initialDocument, parseDocument, validLayout, DEFAULT_LAYOUT } from './model';
import { descendants, topSelection, validateTree } from './tree';

const buttons = () => [0, 22, 50].map((col, index) => ({ ...createNode('basic.button'), col, row: index * 2 }));
describe('多选与批量排版', () => {
  test('批量移动保留相对位置，原数据不变', () => {
    const nodes = buttons(); const snapshot = structuredClone(nodes); const moved = moveNodes(nodes, nodes.map(node => node.id), 1, 2);
    expect(nodes).toEqual(snapshot); expect(moved.map(node => [node.col, node.row])).toEqual(nodes.map(node => [node.col + 1, node.row + 2])); expect(validateTree(moved)).toBeNull();
  });
  test('对齐和等间距分布正确，首尾固定', () => {
    const nodes = buttons(); const ids = nodes.map(node => node.id);
    const top = alignNodes(nodes, ids, 'top'); expect(top.map(node => node.row)).toEqual([0, 0, 0]); expect(validateTree(top)).toBeNull();
    const result = distributeNodes(nodes, ids, 'x'); expect(result.map(node => node.col)).toEqual([0, 25, 50]); expect(validateTree(result)).toBeNull();
    expect(result[1].col - result[0].col - result[0].colSpan).toBe(result[2].col - result[1].col - result[1].colSpan);
  });
  test('整组越界、碰撞和空间不足被拒绝，而不部分修改', () => {
    const nodes = buttons(); expect(validateTree(moveNodes(nodes, nodes.map(node => node.id), 30, 0))).not.toBeNull();
    expect(() => distributeNodes(nodes, nodes.slice(0, 2).map(node => node.id), 'x')).toThrow();
    const overlapping = nodes.map(node => ({ ...node, col: 0 })); expect(() => distributeNodes(overlapping, overlapping.map(node => node.id), 'x')).toThrow();
  });
});
describe('容器与嵌套', () => {
  test('自由组合保留子项的全局位置，支持多层树', () => {
    const nodes = buttons(); const group = groupNodes(nodes, nodes.slice(0, 2).map(node => node.id));
    expect(validateTree(group.nodes)).toBeNull(); const nested = group.nodes.filter(node => node.parentId === group.container.id);
    expect(nested.map(node => node.col + group.container.col)).toEqual(nodes.slice(0, 2).map(node => node.col));
    const outer = groupNodes(group.nodes, [group.container.id, nodes[2].id]); expect(validateTree(outer.nodes)).toBeNull();
    expect(descendants(outer.nodes, [outer.container.id]).size).toBe(5);
    expect(topSelection(outer.nodes, outer.nodes.map(node => node.id)).map(node => node.id)).toEqual([outer.container.id]);
  });
  test('自动布局允许同级请求坐标相同，自由布局不允许', () => {
    const parent = createNode('layout.container'); parent.layout!.mode = 'flex';
    const a = { ...createNode('basic.button'), parentId: parent.id }; const b = { ...createNode('basic.button'), parentId: parent.id };
    expect(validateTree([parent, a, b])).toBeNull(); parent.layout!.mode = 'grid'; expect(validateTree([parent, a, b])).toBeNull();
    parent.layout!.mode = 'free'; expect(validateTree([parent, a, b])).not.toBeNull();
    parent.layout!.mode = 'flex'; expect(() => moveNodes([parent, a, b], [a.id], 1, 0)).toThrow();
  });
  test('拒绝循环、孤儿、非容器父级和过深树', () => {
    const a = createNode('layout.container'), b = createNode('layout.container'); a.parentId = b.id; b.parentId = a.id;
    expect(validateTree([a, b])).toContain('循环'); b.parentId = 'missing'; expect(validateTree([b])).toContain('不存在');
    const leaf = createNode('basic.button'); expect(validateTree([leaf, { ...createNode('basic.button'), parentId: leaf.id }])).toContain('父级');
    const chain = Array.from({ length: 10 }, () => createNode('layout.container'));
    chain.forEach((node, index) => { node.parentId = index ? chain[index - 1].id : null; node.layout!.mode = 'flex'; });
    expect(validateTree(chain.slice(0, 8))).toBeNull();
    expect(validateTree(chain.slice(0, 9))).toContain('8');
    expect(validateTree(chain)).toContain('8');
  });
  test('容器布局合法性与文档树往返', () => {
    expect(validLayout(DEFAULT_LAYOUT)).toBe(true); expect(validLayout({ ...DEFAULT_LAYOUT, columns: 0 })).toBe(false); expect(validLayout({ ...DEFAULT_LAYOUT, gap: -1 })).toBe(false);
    const nodes = buttons(); const grouped = groupNodes(nodes, nodes.map(node => node.id), 'grid');
    const doc = { ...initialDocument(), nodes: grouped.nodes }; expect(parseDocument(JSON.stringify(doc))).toEqual(doc);
  });
  test('拒绝无效布局结构并清除未知配置字段', () => {
    const container = createNode('layout.container'); const doc = { ...initialDocument(), nodes: [container] };
    const polluted = { ...container, layout: { ...container.layout, unknown: '忽略' } };
    expect(parseDocument(JSON.stringify({ ...doc, nodes: [polluted] })).nodes[0].layout).toEqual(container.layout!);
    expect(() => parseDocument(JSON.stringify({ ...doc, nodes: [{ ...container, layout: [] }] }))).toThrow();
    const tiny = { ...container, colSpan: 4, rowSpan: 4, layout: { ...container.layout!, padding: 96 } };
    expect(validateTree([tiny])).toContain('内边距');
  });
  test('复制整个子树使用新 ID，保留内部引用与样式，顺序调整不丢节点', () => {
    const nodes = buttons(); const grouped = groupNodes(nodes, nodes.map(node => node.id)); const clone = cloneForest(grouped.nodes, [grouped.container.id]);
    expect(clone.nodes.length).toBe(4); expect(clone.nodes.every(node => !grouped.nodes.some(other => node.id === other.id))).toBe(true);
    expect(clone.nodes.filter(node => node.parentId === clone.roots[0]).length).toBe(3);
    const parent = createNode('layout.container'); parent.layout!.mode = 'flex';
    const placed = placeForest(clone.nodes, clone.roots, [parent], parent.id); expect(validateTree([parent, ...placed])).toBeNull();
    const reordered = reorderNodes(grouped.nodes, [nodes[2].id], nodes[0].id); expect(reordered.filter(node => node.parentId === grouped.container.id).map(node => node.id)).toEqual([nodes[2].id, nodes[0].id, nodes[1].id]);
    const doc = { ...initialDocument(), nodes: grouped.nodes }; expect(parseDocument(JSON.stringify(doc))).toEqual(doc);
  });
});
