import { describe, expect, test } from 'bun:test';
import { Designer, type DesignerView } from './designer';
import { Store } from './store';
import { StoreRouter } from './store-router';
import { createNode, initialDocument, parseDocument } from './model';
import { Combinations } from './combinations';

const view: DesignerView = { selection: ['panel'], zoom: 0.75, left: 12, top: 24 };
function setup() {
  const panel = { ...createNode('layout.container'), id: 'panel', col: 2, row: 2, colSpan: 30, rowSpan: 20 };
  panel.layout!.padding = 0; panel.props.borderWidth = 0;
  const child = { ...createNode('basic.button'), id: 'leaf', parentId: panel.id, col: 1, row: 1 };
  const other = { ...createNode('basic.button'), id: 'other', col: 40, row: 2 };
  const workspace = new Store({ ...initialDocument(), nodes: [panel, child, other] });
  const router = new StoreRouter(workspace); const designer = new Designer(router);
  return { workspace, router, designer };
}
function rename(router: StoreRouter, id: string, title: string) { router.commit({ ...router.doc, nodes: router.doc.nodes.map(node => node.id === id ? { ...node, props: { ...node.props, title } } : node) }); }

describe('独立组件设计页', () => {
  test('编辑草稿不修改工作区；应用后保留原位置和 ID，并可一次撤销', () => {
    const { workspace, router, designer } = setup(); const original = structuredClone(workspace.doc);
    designer.openNode('panel', view); expect(designer.rootId).toBe('panel'); expect(designer.root!.col).toBe(0); expect(designer.root!.row).toBe(0);
    rename(router, 'leaf', '设计后的按钮'); expect(designer.dirty).toBe(true); expect(workspace.doc).toEqual(original); expect(workspace.canUndo).toBe(false);
    router.undo(); expect(designer.dirty).toBe(false); router.redo(); designer.apply();
    expect(designer.frames).toHaveLength(0); expect(router.active).toBe(workspace);
    expect(workspace.doc.nodes.find(node => node.id === 'panel')!.col).toBe(2);
    expect(workspace.doc.nodes.find(node => node.id === 'leaf')!.props.title).toBe('设计后的按钮');
    workspace.undo(); expect(workspace.doc).toEqual(original);
  });
  test('未修改的容器直接返回，不制造父页历史记录', () => {
    const { workspace, designer } = setup(); const original = structuredClone(workspace.doc);
    designer.openNode('panel', view); designer.apply(); expect(workspace.doc).toEqual(original); expect(workspace.canUndo).toBe(false);
  });
  test('普通组件在草稿中转为组合容器，取消不改变原组件', () => {
    const { workspace, router, designer } = setup(); const original = structuredClone(workspace.doc);
    designer.openNode('leaf', view); expect(designer.root!.type).toBe('layout.container'); expect(router.doc.nodes).toHaveLength(2);
    const inner = router.doc.nodes.find(node => node.id !== 'leaf')!; expect(inner.parentId).toBe('leaf'); expect(inner.type).toBe('basic.button');
    designer.close(); expect(workspace.doc).toEqual(original);
    designer.openNode('leaf', view); designer.apply(); expect(workspace.doc.nodes.find(node => node.id === 'leaf')!.type).toBe('layout.container');
    expect(workspace.doc.nodes.find(node => node.id === 'leaf')!.parentId).toBe('panel'); workspace.undo(); expect(workspace.doc).toEqual(original);
  });
  test('普通组件按实际渲染尺寸设计，转为组合后不会缩回请求尺寸', () => {
    const { workspace, router, designer } = setup();
    workspace.commit({ ...workspace.doc, nodes: workspace.doc.nodes.map(node => node.id === 'panel' ? { ...node, layout: { ...node.layout!, mode: 'grid' } } : node) });
    designer.openNode('leaf', view, { colSpan: 20, rowSpan: 4 });
    expect(designer.root!.colSpan).toBe(20); expect(router.doc.nodes.find(node => node.type === 'basic.button')!.colSpan).toBe(20);
    designer.apply(); expect(workspace.doc.nodes.find(node => node.parentId === 'leaf')!.colSpan).toBe(20);
  });
  test('可视尺寸放不下已有内容时回退请求尺寸，不裁剪数据', () => {
    const { workspace, router, designer } = setup();
    workspace.commit({ ...workspace.doc, nodes: workspace.doc.nodes.map(node => node.id === 'leaf' ? { ...node, col: 10 } : node) });
    designer.openNode('panel', view, { colSpan: 20, rowSpan: 20 });
    expect(designer.root!.colSpan).toBe(30); expect(router.doc.nodes.find(node => node.id === 'leaf')!.col).toBe(10);
  });
  test('深层应用只进入父草稿，最后一次应用才改变主工作区', () => {
    const { workspace, router, designer } = setup(); const original = structuredClone(workspace.doc);
    designer.openNode('panel', view); const parentDraft = router.active; designer.openNode('leaf', view);
    rename(router, router.doc.nodes.find(node => node.type === 'basic.button')!.id, '深层变化'); designer.apply();
    expect(router.active).toBe(parentDraft); expect(workspace.doc).toEqual(original); expect(designer.frames).toHaveLength(1);
    designer.apply(); expect(workspace.doc.nodes.some(node => node.props.title === '深层变化')).toBe(true);
    workspace.undo(); expect(workspace.doc).toEqual(original);
  });
  test('放弃父页同时丢弃已应用到该草稿的下层更改', () => {
    const { workspace, router, designer } = setup(); const original = structuredClone(workspace.doc);
    designer.openNode('panel', view); designer.openNode('leaf', view); rename(router, 'leaf', '只在草稿中'); designer.apply();
    designer.discardTo(0); expect(workspace.doc).toEqual(original); expect(workspace.canUndo).toBe(false); expect(designer.dirty).toBe(false);
  });
  test('父页碰撞或源组件冲突时不部分提交，也不关闭设计页', () => {
    const { workspace, router, designer } = setup(); const original = structuredClone(workspace.doc);
    designer.openNode('panel', view); router.commit({ ...router.doc, nodes: router.doc.nodes.map(node => node.id === 'panel' ? { ...node, colSpan: 50 } : node) });
    expect(() => designer.apply()).toThrow('重叠'); expect(workspace.doc).toEqual(original); expect(designer.frames).toHaveLength(1);
    designer.close(); designer.openNode('panel', view);
    workspace.commit({ ...workspace.doc, nodes: workspace.doc.nodes.map(node => node.id === 'panel' ? { ...node, props: { ...node.props, title: '父页新版本' } } : node) });
    expect(() => designer.apply()).toThrow('已改变'); expect(designer.frames).toHaveLength(1); expect(workspace.doc.nodes[0].props.title).toBe('父页新版本');
  });
  test('单独创建可应用到指定父级，无空间时保留草稿供调整', () => {
    const { workspace, router, designer } = setup(); designer.create(view, 'insert', 'panel');
    expect(() => designer.apply()).toThrow('没有足够空间'); expect(workspace.doc.nodes).toHaveLength(3);
    const id = designer.rootId!; router.commit({ ...router.doc, nodes: router.doc.nodes.map(node => node.id === id ? { ...node, colSpan: 14, rowSpan: 4 } : node) });
    designer.apply(); expect(workspace.doc.nodes.find(node => node.id === id)!.parentId).toBe('panel'); expect(designer.frames).toHaveLength(0);
    expect(parseDocument(JSON.stringify(workspace.doc))).toEqual(workspace.doc);
  });
  test('新组合设计与已保存组合编辑都不会自动污染工作区', () => {
    const { workspace, designer } = setup(); const original = structuredClone(workspace.doc);
    const values = new Map<string, string>(); const combinations = new Combinations({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } });
    designer.create(view, 'library'); const snapshot = designer.snapshot(); combinations.save('独立设计', snapshot); designer.close();
    const saved = combinations.items[0]; designer.openTemplate(saved.document, saved.id, saved.name, view);
    expect(() => designer.openTemplate(saved.document, saved.id, saved.name, view)).toThrow('已在设计');
    rename(designer.router, designer.rootId!, '新组合内容'); combinations.update(saved.id, '独立设计新版', designer.snapshot()); designer.close();
    expect(combinations.items).toHaveLength(1); expect(combinations.items[0].id).toBe(saved.id); expect(combinations.items[0].name).toBe('独立设计新版');
    expect(workspace.doc).toEqual(original);
  });
  test('设计根必须留在原点，导航恢复父页视图，路由不重复订阅旧历史', () => {
    const { workspace, router, designer } = setup(); let restored: DesignerView | undefined; designer.onNavigate = state => { restored = state; };
    let notifications = 0; router.subscribe(() => notifications++);
    designer.openNode('panel', view); const afterOpen = notifications; workspace.commit({ ...workspace.doc, appearance: { ...workspace.doc.appearance, background: '#000000' } });
    expect(notifications).toBe(afterOpen);
    router.commit({ ...router.doc, nodes: router.doc.nodes.map(node => node.id === 'panel' ? { ...node, col: 1 } : node) });
    expect(() => designer.snapshot()).toThrow('原点'); designer.close(); expect(restored).toEqual(view); expect(router.active).toBe(workspace);
  });
});
