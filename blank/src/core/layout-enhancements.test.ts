import { InlineEdit } from './inline-edit';
import { StoreRouter } from './store-router';
import { expect, test } from 'bun:test';
import { createNode, initialDocument, parseDocument } from './model';
import { Store } from './store';
import { cloneForest } from './operations';
import { captureCombination } from './combinations';
import { parseTypography, typographyCSS } from '../components/typography';
import { DEFAULT_CONSTRAINTS, parseConstraints } from './item-constraints';
import { alignmentGuides } from './alignment-guides';
import { itemStyles } from '../editor/item-styles';

test('旧记录不新增排版或子项约束，不改变原始尺寸和内容', () => {
  const doc = initialDocument(), parsed = parseDocument(JSON.stringify(doc));
  expect(parsed).toEqual(doc);
  expect(parsed.nodes.every(n => n.props.typography === undefined && n.constraints === undefined)).toBe(true);
  expect(typographyCSS()).toBe('');
});
test('排版和布局约束白名单保存、复制与组合快照相互独立', () => {
  const node = createNode('content.card');
  node.props.typography = { fontSize: 18, fontWeight: 600, lineHeight: 1.8, textAlign: 'right' };
  node.constraints = { ...DEFAULT_CONSTRAINTS, flexGrow: 2, flexShrink: 1, columnSpan: 2, rowSpan: 3, heightMode: 'content' };
  const doc = parseDocument(JSON.stringify({ ...initialDocument(), nodes: [node] }));
  expect(doc.nodes[0]).toEqual(node);
  const clone = cloneForest(doc.nodes, [node.id]).nodes[0];
  clone.props.typography!.fontSize = 24;
  clone.constraints!.columnSpan = 3;
  expect(node.props.typography.fontSize).toBe(18);
  expect(doc.nodes[0].constraints!.columnSpan).toBe(2);
  const captured = captureCombination(doc, [node.id]);
  expect(captured.nodes[0].props.typography).toEqual(node.props.typography);
  expect(captured.nodes[0].constraints).toEqual(node.constraints);
});
test('拒绝排版 CSS 注入与非法数值，清除未知字段', () => {
  for (const value of [null, [], { fontSize: '12;color:red' }, { fontSize: 0 }, { fontWeight: 550 }, { lineHeight: Infinity }, { textAlign: 'center;position:fixed' }]) expect(() => parseTypography(value)).toThrow();
  expect(parseTypography({ fontSize: 18, css: 'bad' })).toEqual({ fontSize: 18 });
  expect(typographyCSS({ fontSize: 16, textAlign: 'center' })).toContain('font-size:16px');
});
test('伸缩和跨格边界校验，未知字段不进入存档', () => {
  for (const value of [null, [], { flexGrow: -1 }, { flexShrink: '1' }, { columnSpan: 0 }, { rowSpan: 13 }, { rowSpan: 1.5 }, { heightMode: 'auto' }]) expect(() => parseConstraints(value)).toThrow();
  expect(parseConstraints({ flexGrow: 0.5, unsafe: 'css' })).toEqual({ ...DEFAULT_CONSTRAINTS, flexGrow: 0.5 });
  const node = createNode('layout.container'); node.constraints = { ...DEFAULT_CONSTRAINTS, heightMode: 'content' };
  expect(() => parseDocument(JSON.stringify({ ...initialDocument(), nodes: [node] }))).toThrow('非容器');
});
test('多项排版作为一个历史事务，可撤销重做且不改写尺寸', () => {
  const store = new Store(initialDocument()), before = structuredClone(store.doc);
  store.commit({ ...store.doc, nodes: store.doc.nodes.map(n => ({ ...n, props: { ...n.props, typography: { fontSize: 20, lineHeight: 1.5 } } })) });
  expect(store.doc.nodes.every(n => n.props.typography?.fontSize === 20)).toBe(true);
  store.undo(); expect(store.doc).toEqual(before);
  store.redo(); expect(store.doc.nodes[0].rowSpan).toBe(before.nodes[0].rowSpan);
  expect(store.doc.nodes[0].props.typography?.fontSize).toBe(20);
});
test('真实 CSS 子项样式：伸缩保留最小尺寸，跨列限制在父列数，跨行不丢失', () => {
  const parent = createNode('layout.container'), node = createNode('basic.button');
  parent.layout!.mode = 'flex';
  node.constraints = { ...DEFAULT_CONSTRAINTS, flexGrow: 2, flexShrink: 1, columnSpan: 4, rowSpan: 3 };
  expect(itemStyles(node, parent, [4, 2]).flex).toBe('2 1 auto');
  expect(itemStyles(node, parent, [4, 2]).minWidth).toBe('48px');
  parent.layout!.mode = 'grid'; parent.layout!.columns = 2;
  expect(itemStyles(node, parent, [4, 2]).gridColumn).toBe('span 2');
  expect(itemStyles(node, parent, [4, 2]).gridRow).toBe('span 3');
  parent.layout!.mode = 'free';
  expect(itemStyles(node, parent, [4, 2]).gridColumn).toBe('auto');
});
test('完成原位编辑时先解析自适应占位，冲突保留草稿，不部分提交父布局', () => {
  const root = { ...createNode('html.p'), id: 'auto', col: 2, row: 2 };
  const blocker = { ...createNode('basic.button'), id: 'other', col: 2, row: 22 };
  const store = new Store({ ...initialDocument(), nodes: [root, blocker] });
  const session = new InlineEdit(new StoreRouter(store));
  const original = structuredClone(store.doc);
  session.open(root.id, { selection: [root.id], zoom: 1, left: 0, top: 0 });
  session.resolveDocument = doc => ({ ...doc, nodes: doc.nodes.map(n => n.id === root.id ? { ...n, rowSpan: 24 } : n) });
  expect(() => session.finish()).toThrow('重叠');
  expect(session.current).toBeDefined();
  expect(store.doc).toEqual(original);
  session.resolveDocument = doc => ({ ...doc, nodes: doc.nodes.map(n => n.id === root.id ? { ...n, rowSpan: 12 } : n) });
  session.finish();
  expect(store.doc.nodes[0].rowSpan).toBe(12);
  store.undo(); expect(store.doc).toEqual(original);
});
test('拖动参考线识别边缘和中心，仅在阈值内提示且不修改几何', () => {
  const moving = { col: 10, row: 10, colSpan: 4, rowSpan: 4 };
  const peer = { col: 10.2, row: 20, colSpan: 8, rowSpan: 4 };
  const original = structuredClone(moving);
  const guides = alignmentGuides(moving, [peer], 0.25);
  expect(guides).toEqual([{ axis: 'x', at: 10.2, from: 10, to: 24 }]);
  expect(alignmentGuides(moving, [peer], 0.1)).toEqual([]);
  expect(moving).toEqual(original);
  expect(alignmentGuides(moving, [{ col: 10, row: 20, colSpan: 4, rowSpan: 4 }], 0)).toHaveLength(1);
});
