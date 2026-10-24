import { describe, expect, test } from 'bun:test';
import { InlineEdit, type EditView } from './inline-edit';
import { Store } from './store';
import { StoreRouter } from './store-router';
import { createNode, initialDocument, parseDocument } from './model';
import { assembleNodes } from './assembly';
import { resizeEditingNode } from './edit-region';
import type { Placement } from './types';
const view: EditView = { selection: ['root'], zoom: 0.75, left: 12, top: 24 };
function setup() {
  const root = { ...createNode('layout.container'), id: 'root', col: 2, row: 2, colSpan: 30, rowSpan: 20, design: { width: 360, height: 240 } };
  root.props.borderWidth = 0; root.layout!.padding = 0;
  const child = { ...createNode('basic.button'), id: 'child', parentId: root.id, col: 1, row: 1 };
  const other = { ...createNode('basic.button'), id: 'other', col: 40, row: 2 };
  const workspace = new Store({ ...initialDocument(), nodes: [root, child, other] }), router = new StoreRouter(workspace), session = new InlineEdit(router);
  return { workspace, router, session };
}
function update(router: StoreRouter, id: string, patch: Partial<Placement>) { router.commit(parseDocument(JSON.stringify({ ...router.doc, nodes: router.doc.nodes.map(node => node.id === id ? { ...node, ...patch } : node) }), true)); }

describe('工作区原位组件编辑', () => {
  test('保留其他组件为只读背景，视图不切换，草稿历史与工作区隔离', () => {
    const { workspace, router, session } = setup(), original = structuredClone(workspace.doc); let next: EditView | undefined;
    session.onNavigate = state => { next = state; }; session.open('root', view, { col: 2, row: 2 });
    expect(next).toEqual(view); expect(session.current!.background.nodes.map(node => node.id)).toEqual(['other']);
    expect(router.doc.nodes.map(node => node.id)).toEqual(['root', 'child']);
    update(router, 'child', { props: { ...router.doc.nodes[1].props, title: '原位新文字' } });
    expect(workspace.doc).toEqual(original); expect(workspace.canUndo).toBe(false); expect(session.dirty).toBe(true);
    router.undo(); expect(session.dirty).toBe(false); router.redo(); session.finish();
    expect(workspace.doc.nodes[1].props.title).toBe('原位新文字'); workspace.undo(); expect(workspace.doc).toEqual(original);
  });
  test('已有对象可自由拖动，完成后回原位置并保留外部显示框', () => {
    const { workspace, router, session } = setup(); session.open('root', view); update(router, 'root', { col: 90, row: 70 });
    expect(session.pageSize.width).toBeGreaterThan(960); expect(session.root!.col).toBe(90);
    session.finish(); expect(workspace.doc.nodes[0]).toMatchObject({ id: 'root', col: 2, row: 2, colSpan: 30, rowSpan: 20 });
    expect(workspace.canUndo).toBe(false);
  });
  test('散件在编辑框内可临时叠放，未组装时不能完成或保存快照', () => {
    const { workspace, router, session } = setup(); session.open('root', view);
    const loose = { ...createNode('basic.input'), id: 'loose', col: 2, row: 2 };
    router.commit(parseDocument(JSON.stringify({ ...router.doc, nodes: [...router.doc.nodes, loose] }), true));
    expect(session.loose).toHaveLength(1); expect(() => session.finish()).toThrow('未组装'); expect(() => session.snapshot()).toThrow('未组装');
    expect(session.frames).toHaveLength(1); expect(workspace.canUndo).toBe(false);
    update(router, 'loose', { col: 2, row: 2 }); session.assemble();
    expect(session.loose).toHaveLength(0); session.finish();
    expect(workspace.doc.nodes.find(node => node.id === 'loose')!.parentId).toBe('root');
    expect(workspace.doc.nodes[0].layout!.overlap).toBe(true);
  });
  test('删除多余散件后可退出，不要求创建额外容器', () => {
    const { router, session } = setup(); session.open('root', view);
    router.commit({ ...router.doc, nodes: [...router.doc.nodes, { ...createNode('basic.button'), col: 2, row: 2 }] });
    expect(() => session.finish()).toThrow('未组装'); router.undo(); session.finish(); expect(session.current).toBeUndefined();
  });
  test('编辑原生组件不强制组合化；仅新增内容组装时才保留外部 ID 包装', () => {
    const { workspace, router, session } = setup(); session.open('child', view, { col: 3, row: 3 }, { colSpan: 14, rowSpan: 4 });
    update(router, 'child', { props: { ...session.root!.props, title: '改后的按钮' } }); session.finish();
    expect(workspace.doc.nodes.find(node => node.id === 'child')!.type).toBe('basic.button');
    session.open('child', view); update(router, 'child', resizeEditingNode(session.root!, 600, 240)); router.commit({ ...router.doc, nodes: [...router.doc.nodes, { ...createNode('html.p'), id: 'text', col: session.root!.col, row: session.root!.row }] });
    session.assemble(); const wrapper = session.root!;
    expect(wrapper.id).toBe('child'); expect(wrapper.type).toBe('layout.container'); expect(wrapper.colSpan).toBe(14);
    expect(router.doc.nodes.some(node => node.type === 'basic.button' && node.id !== 'child' && node.parentId === 'child')).toBe(true);
    session.finish(); expect(workspace.doc.nodes.find(node => node.id === 'child')!.parentId).toBe('root');
  });
  test('可多次组装同一容器，不重复套壳；保留内部标签自定义数据', () => {
    const root = { ...createNode('basic.button'), id: 'root', col: 2, row: 2, surface: { baseWidth: 600, baseHeight: 240, x: 0, y: 0, width: 600, height: 240 }, elements: [{ path: [0, 0], tag: 'span', text: '自定义标签' }] };
    let nodes = assembleNodes([root, { ...createNode('html.p'), id: 'p', col: 2, row: 2 }], root.id, root);
    const wrapper = nodes.find(node => node.id === root.id)!;
    expect(nodes.filter(node => node.type === 'layout.container')).toHaveLength(1);
    expect(nodes.find(node => node.type === 'basic.button')!.elements).toEqual(root.elements);
    nodes = assembleNodes([...nodes, { ...createNode('basic.input'), col: 20, row: 10 }], root.id, root);
    expect(nodes.filter(node => node.type === 'layout.container')).toHaveLength(1);
    expect(nodes.find(node => node.id === root.id)!.colSpan).toBe(wrapper.colSpan);
  });
  test('多层原位编辑逐级组装，内层完成只修改父草稿，不能绕过外层门禁', () => {
    const { workspace, router, session } = setup(), original = structuredClone(workspace.doc);
    session.open('root', view); const parentDraft = router.active;
    router.commit({ ...router.doc, nodes: [...router.doc.nodes, { ...createNode('basic.input'), id: 'parent-loose', col: 2, row: 10 }] });
    session.open('child', view, { col: 3, row: 3 });
    expect(session.current!.background.nodes.some(node => node.id === 'parent-loose')).toBe(true);
    update(router, 'child', resizeEditingNode(session.root!, 600, 240));
    router.commit({ ...router.doc, nodes: [...router.doc.nodes, { ...createNode('html.p'), id: 'nested-loose', col: 3, row: 3 }] });
    expect(() => session.finish()).toThrow('未组装'); session.assemble(); session.finish();
    expect(router.active).toBe(parentDraft); expect(workspace.doc).toEqual(original);
    expect(() => session.finish()).toThrow('未组装'); session.assemble(); session.finish();
    expect(workspace.doc.nodes.some(node => node.id === 'nested-loose')).toBe(true); expect(session.current).toBeUndefined();
    workspace.undo(); expect(workspace.doc).toEqual(original);
  });
  test('删除根后剩余元素必须重组；全部删空后完成会删除原子树', () => {
    const { workspace, router, session } = setup(); session.open('root', view);
    router.commit({ ...router.doc, nodes: [{ ...createNode('html.p'), id: 'replacement', col: 2, row: 2 }] });
    expect(() => session.finish()).toThrow('未组装'); session.assemble(); expect(session.rootId).toBe('root'); session.finish();
    expect(workspace.doc.nodes.find(node => node.id === 'replacement')!.parentId).toBe('root');
    session.open('root', view); router.commit({ ...router.doc, nodes: [] }); session.finish();
    expect(workspace.doc.nodes.map(node => node.id)).toEqual(['other']); workspace.undo(); expect(workspace.doc.nodes.some(node => node.id === 'replacement')).toBe(true);
  });
  test('显式放大后删除根再重组，仍沿用已批准的编辑框，不收紧或扩展', () => {
    const { router, session } = setup(); session.open('root', view);
    update(router, 'root', resizeEditingNode(session.root!, 600, 480));
    const piece = { ...createNode('basic.button'), id: 'retained', col: 30, row: 25 };
    router.commit({ ...router.doc, nodes: [piece] });
    expect(session.current!.bounds.cols * 12).toBe(600);
    session.assemble(); expect(session.root!.design).toEqual({ width: 600, height: 480 });
    expect(session.root!.colSpan).toBe(30); expect(router.doc.nodes.find(node => node.id === piece.id)!.parentId).toBe('root');
  });
  test('最终外框碰撞或源组件冲突时不部分提交或丢失编辑状态', () => {
    const { workspace, router, session } = setup(), original = structuredClone(workspace.doc);
    session.open('root', view); update(router, 'root', { colSpan: 60 }); expect(() => session.finish()).toThrow('重叠');
    expect(workspace.doc).toEqual(original); expect(session.frames).toHaveLength(1);
    update(router, 'root', { colSpan: 30 }); workspace.commit({ ...workspace.doc, nodes: workspace.doc.nodes.map(node => node.id === 'root' ? { ...node, props: { ...node.props, title: '外部更新' } } : node) });
    expect(() => session.finish()).toThrow('已改变'); expect(session.frames).toHaveLength(1);
  });
  test('最多同时编辑八层，超限不切换路由或丢失当前草稿', () => {
    const { workspace, router, session } = setup(); session.open('root', view);
    for (let index = 1; index <= 8; index++) {
      const node = { ...createNode('basic.button'), id: `level-${index}`, col: session.root!.col, row: session.root!.row };
      router.commit({ ...router.doc, nodes: [...router.doc.nodes, node] });
      if (index < 8) session.open(node.id, view);
    }
    const active = router.active; expect(session.frames).toHaveLength(8);
    expect(() => session.open('level-8', view)).toThrow('8 层'); expect(router.active).toBe(active);
    expect(session.rootId).toBe('level-7'); expect(workspace.canUndo).toBe(false);
  });
  test('组合库原位编辑也需组装，退出前不改变工作区或覆盖原模板', () => {
    const { workspace, router, session } = setup(), original = structuredClone(workspace.doc);
    const snapshot = { ...original, nodes: original.nodes.filter(node => node.id !== 'other').map(node => node.id === 'root' ? { ...node, col: 0, row: 0 } : node) };
    session.openTemplate(snapshot, 'template-id', '库中组合', view);
    expect(router.doc.nodes.every(node => !original.nodes.some(item => item.id === node.id))).toBe(true);
    expect(() => session.openTemplate(snapshot, 'template-id', '库中组合', view)).toThrow('已在编辑');
    router.commit({ ...router.doc, nodes: [...router.doc.nodes, { ...createNode('html.p'), col: 0, row: 0 }] });
    expect(() => session.finishTemplate()).toThrow('未组装'); session.assemble(); expect(session.snapshot().nodes).toHaveLength(3); session.finishTemplate();
    expect(workspace.doc).toEqual(original);
  });
});
