import { createNode, findSpace, parseDocument } from './model';
import { Store } from './store';
import { StoreRouter } from './store-router';
import { descendants } from './tree';
import { isContainer, type Document, type Placement } from './types';

export interface DesignerView { selection: string[]; zoom: number; left: number; top: number }
export interface DesignFrame {
  id: string;
  kind: 'node' | 'insert' | 'library' | 'template';
  rootId: string;
  store: Store;
  baseline: string;
  parent: Store;
  parentView: DesignerView;
  source?: Placement;
  sourceTree?: string;
  insertParent: string | null;
  templateId?: string;
  templateName?: string;
}
const clean = (doc: Document) => parseDocument(JSON.stringify(doc));
export class Designer {
  frames: DesignFrame[] = [];
  onNavigate = (_view: DesignerView) => {};
  constructor(readonly router: StoreRouter) {}
  get current() { return this.frames.at(-1); }
  get rootId() { return this.current?.rootId ?? null; }
  get dirty() { return this.frames.some(frame => JSON.stringify(frame.store.doc) !== frame.baseline); }
  get root() { return this.router.doc.nodes.find(node => node.id === this.rootId); }
  private enter(doc: Document, info: Omit<DesignFrame, 'id' | 'store' | 'baseline' | 'parent' | 'rootId'>) {
    if (this.frames.length >= 8) throw new Error('最多同时打开 8 级组件设计页');
    const parsed = clean(doc); const roots = parsed.nodes.filter(node => !node.parentId);
    if (roots.length !== 1 || !isContainer(roots[0])) throw new Error('设计页必须有一个布局容器作为根组件');
    const frame: DesignFrame = { ...info, parentView: structuredClone(info.parentView), id: crypto.randomUUID(), rootId: roots[0].id, store: new Store(parsed), baseline: JSON.stringify(parsed), parent: this.router.active };
    this.frames.push(frame); this.router.activate(frame.store); this.onNavigate({ selection: [frame.rootId], zoom: 1, left: 0, top: 0 });
  }
  openNode(id: string, view: DesignerView, rendered?: { colSpan: number; rowSpan: number }) {
    if (id === this.rootId) throw new Error('当前已在这个组件的设计页');
    const doc = this.router.doc; const source = doc.nodes.find(node => node.id === id);
    if (!source) throw new Error('组件不存在');
    const all = descendants(doc.nodes, [id]); const tree = doc.nodes.filter(node => all.has(node.id));
    let nodes = structuredClone(tree);
    const root = nodes.find(node => node.id === id)!;
    root.parentId = null; root.col = 0; root.row = 0;
    if (rendered) { root.colSpan = rendered.colSpan; root.rowSpan = rendered.rowSpan; }
    if (!isContainer(root)) {
      const wrapper = createNode('layout.container'); wrapper.id = root.id; wrapper.colSpan = root.colSpan; wrapper.rowSpan = root.rowSpan;
      wrapper.props.title = root.props.title || '组件组合'; wrapper.props.radius = root.props.radius; wrapper.props.borderWidth = 0;
      wrapper.layout!.padding = 0;
      root.id = crypto.randomUUID(); root.parentId = wrapper.id;
      nodes = [wrapper, root];
    }
    if (rendered) {
      try { clean({ ...doc, nodes }); }
      catch {
        // 现有内容可能超出自动布局后的可视尺寸；保留原请求尺寸，不裁掉内容。
        const draftRoot = nodes.find(node => !node.parentId)!; draftRoot.colSpan = source.colSpan; draftRoot.rowSpan = source.rowSpan;
        if (!isContainer(source)) { root.colSpan = source.colSpan; root.rowSpan = source.rowSpan; }
      }
    }
    this.enter({ ...doc, nodes }, { kind: 'node', parentView: view, insertParent: source.parentId, source: structuredClone(source), sourceTree: JSON.stringify(tree) });
  }
  create(view: DesignerView, kind: 'insert' | 'library', parentId: string | null = null) {
    const root = createNode('layout.container'); root.props.title = kind === 'library' ? '未命名组合' : '新组件'; root.props.borderWidth = 0; root.layout!.padding = 0;
    this.enter({ ...this.router.doc, nodes: [root] }, { kind, insertParent: parentId, parentView: view });
  }
  openTemplate(document: Document, id: string, name: string, view: DesignerView) {
    if (this.frames.some(frame => frame.templateId === id)) throw new Error('这个组合已在设计中，请先返回对应页面');
    const doc = clean(document); const root = doc.nodes.find(node => !node.parentId);
    if (!root || doc.nodes.filter(node => !node.parentId).length !== 1) throw new Error('组合快照格式无效');
    if (!isContainer(root)) {
      const wrapper = createNode('layout.container'); wrapper.colSpan = root.colSpan; wrapper.rowSpan = root.rowSpan; wrapper.props.title = name; wrapper.props.borderWidth = 0; wrapper.layout!.padding = 0;
      root.parentId = wrapper.id; root.col = 0; root.row = 0; doc.nodes.push(wrapper);
    }
    this.enter(doc, { kind: 'template', templateId: id, templateName: name, parentView: view, insertParent: null });
  }
  snapshot() {
    const frame = this.current; if (!frame) throw new Error('没有打开的组件设计页');
    const doc = clean(frame.store.doc); const roots = doc.nodes.filter(node => !node.parentId);
    if (roots.length !== 1 || roots[0].id !== frame.rootId || !isContainer(roots[0]) || roots[0].col !== 0 || roots[0].row !== 0) throw new Error('设计页根组件必须保留在原点');
    return doc;
  }
  apply() {
    const frame = this.current; if (!frame) return;
    if (frame.kind === 'library' || frame.kind === 'template') throw new Error('请先保存到我的组合');
    const draft = this.snapshot(); const root = draft.nodes.find(node => node.id === frame.rootId)!;
    let nodes: Placement[];
    if (frame.kind === 'node') {
      const source = frame.source!; const all = descendants(frame.parent.doc.nodes, [source.id]);
      const currentTree = frame.parent.doc.nodes.filter(node => all.has(node.id));
      if (JSON.stringify(currentTree) !== frame.sourceTree) throw new Error('父页中的原组件已改变，请取消后重新进入，避免覆盖更新');
      if (isContainer(source) && JSON.stringify(frame.store.doc) === frame.baseline) { this.close([source.id]); return; }
      Object.assign(root, { parentId: source.parentId, col: source.col, row: source.row });
      const replacement = [root, ...draft.nodes.filter(node => node.id !== root.id)];
      nodes = frame.parent.doc.nodes.flatMap(node => node.id === source.id ? replacement : all.has(node.id) ? [] : [node]);
    } else {
      // 插入由真实组件边界寻找空位；父级自动布局则追加子项。
      const parentId = frame.insertParent;
      if (parentId && !frame.parent.doc.nodes.some(node => node.id === parentId && isContainer(node))) throw new Error('原父容器已不存在');
      const placed = findInsertion(root, frame.parent.doc.nodes, parentId);
      if (!placed) throw new Error('父页没有足够空间，请缩小组件、另存组合或取消返回');
      Object.assign(root, placed); nodes = [...frame.parent.doc.nodes, ...draft.nodes];
    }
    const result = clean({ ...frame.parent.doc, nodes }); // 先整体校验，失败时草稿与父页均保留。
    frame.parent.commit(result); this.close([root.id]);
  }
  close(selection?: string[]) {
    const frame = this.frames.pop(); if (!frame) return;
    this.router.activate(frame.parent); this.onNavigate({ ...frame.parentView, selection: selection ?? frame.parentView.selection });
  }
  discardTo(depth: number) { while (this.frames.length > depth) this.close(); }
}

function findInsertion(root: Placement, nodes: Placement[], parentId: string | null) {
  return findSpace({ ...root, parentId }, nodes);
}
