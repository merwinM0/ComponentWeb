import { parseDocument } from './model';
import { CANVAS, EDIT_SPACE, GRID } from './grid';
import { workingSize, assembleNodes, allowAssembledOverlap } from './assembly';
import { descendants } from './tree';
import { cloneForest } from './operations';
import { Store } from './store';
import { StoreRouter } from './store-router';
import type { Document, Placement } from './types';
import { editRegionError, regionOf, type EditRegion } from './edit-region';

export interface EditView { selection: string[]; zoom: number; left: number; top: number }
export interface EditFrame {
  id: string; rootId: string; name: string; store: Store; baseline: string; parent: Store; parentView: EditView;
  source: Placement; sourceTree?: string; templateId?: string;
  background: Document;
  bounds: EditRegion;
}
const clean = (doc: Document, draft = false) => parseDocument(JSON.stringify(doc), draft);
export class InlineEdit {
  frames: EditFrame[] = [];
  onNavigate = (_view: EditView) => {};
  constructor(readonly router: StoreRouter) {}
  get current() { return this.frames.at(-1); }
  get rootId() { return this.current?.rootId ?? null; }
  get root() { return this.router.doc.nodes.find(node => node.id === this.rootId); }
  get loose() { return this.current ? this.router.doc.nodes.filter(node => !node.parentId && node.id !== this.rootId) : []; }
  get dirty() { return this.frames.some(frame => JSON.stringify(frame.store.doc) !== frame.baseline); }
  private enter(doc: Document, source: Placement, view: EditView, background: Document, templateId?: string, sourceTree?: string) {
    if (this.frames.length >= 8) throw new Error('最多同时编辑 8 层组件，请先完成内层编辑');
    const parsed = clean(doc, true);
    const frame: EditFrame = { id: crypto.randomUUID(), rootId: source.id, name: source.props.title || '组件', source: structuredClone(source), sourceTree, templateId,
      store: new Store(parsed), bounds: regionOf(parsed.nodes.find(node => node.id === source.id)!), baseline: JSON.stringify(parsed), parent: this.router.active, parentView: structuredClone(view), background };
    frame.store.subscribe(() => { const root = frame.store.doc.nodes.find(node => node.id === frame.rootId); if (root) frame.bounds = regionOf(root); });
    this.frames.push(frame); this.router.activate(frame.store); this.onNavigate({ ...view, selection: [frame.rootId] });
  }
  open(id: string, view: EditView, position?: { col: number; row: number }, rendered?: { colSpan: number; rowSpan: number }) {
    if (id === this.rootId) throw new Error('本层组件已在编辑中');
    const doc = this.router.doc, source = doc.nodes.find(node => node.id === id);
    if (!source) throw new Error('组件不存在');
    const all = descendants(doc.nodes, [id]), tree = doc.nodes.filter(node => all.has(node.id));
    const nodes = structuredClone(tree), root = nodes.find(node => node.id === id)!;
    root.parentId = null;
    if (!root.design && !root.surface && rendered) root.surface = { baseWidth: rendered.colSpan * GRID.cell, baseHeight: rendered.rowSpan * GRID.cell, x: 0, y: 0, width: rendered.colSpan * GRID.cell, height: rendered.rowSpan * GRID.cell };
    const size = workingSize(root);
    root.col = Math.max(0, Math.min(position?.col ?? source.col, (EDIT_SPACE.width - size.width) / GRID.cell));
    root.row = Math.max(0, Math.min(position?.row ?? source.row, (EDIT_SPACE.height - size.height) / GRID.cell));
    const context = [...(this.current?.background.nodes ?? []), ...this.contextNodes(doc.nodes.filter(node => !all.has(node.id)))];
    this.enter({ ...doc, nodes }, source, view, { ...doc, nodes: structuredClone(context) }, undefined, JSON.stringify(tree));
  }
  openTemplate(document: Document, id: string, name: string, view: EditView) {
    if (this.frames.some(frame => frame.templateId === id)) throw new Error('该组合已在编辑，请先完成当前层');
    const doc = clean(document); const roots = doc.nodes.filter(node => !node.parentId);
    if (roots.length !== 1) throw new Error('组合快照必须有一个根组件');
    const cloned = cloneForest(doc.nodes, roots.map(node => node.id)); const source = cloned.nodes.find(node => !node.parentId)!;
    source.props.title = name;
    const background = { ...this.router.doc, nodes: structuredClone([...(this.current?.background.nodes ?? []), ...this.contextNodes(this.router.doc.nodes)]) };
    this.enter({ ...doc, nodes: cloned.nodes }, source, view, background, id);
  }
  private contextNodes(nodes: Placement[]) {
    return nodes.map(node => { if (node.id !== this.rootId) return node; const size = workingSize(node); return { ...node, colSpan: size.width / GRID.cell, rowSpan: size.height / GRID.cell }; });
  }
  assemble() {
    const frame = this.current; if (!frame) return;
    const nodes = assembleNodes(frame.store.doc.nodes, frame.rootId, frame.source, frame.bounds);
    frame.store.commit(clean({ ...frame.store.doc, nodes }, true));
  }
  snapshot() {
    const frame = this.current; if (!frame) throw new Error('当前没有正在编辑的组件');
    const error = editRegionError(frame.store.doc.nodes, frame.rootId, frame.bounds); if (error) throw new Error(error);
    const doc = clean(frame.store.doc, true);
    if (!doc.nodes.length) return doc;
    const root = doc.nodes.find(node => node.id === frame.rootId);
    const all = root ? descendants(doc.nodes, [root.id]) : new Set<string>();
    const count = doc.nodes.filter(node => !all.has(node.id)).length;
    if (!root || root.parentId || count) throw new Error(`还有 ${count || doc.nodes.length} 个未组装元素，请先组装到当前组件或删除后再完成`);
    root.col = 0; root.row = 0;
    if (!root.design && !root.elements?.length && !frame.source.surface && JSON.stringify(root.surface) === JSON.stringify(JSON.parse(frame.baseline).nodes.find((node: Placement) => node.id === frame.rootId)?.surface)) delete root.surface;
    return clean({ ...doc, nodes: allowAssembledOverlap(doc.nodes) });
  }
  finish() {
    const frame = this.current; if (!frame) return;
    if (frame.templateId) throw new Error('请先保存当前组合');
    const draft = this.snapshot(), source = frame.source;
    const all = descendants(frame.parent.doc.nodes, [source.id]), tree = frame.parent.doc.nodes.filter(node => all.has(node.id));
    if (JSON.stringify(tree) !== frame.sourceTree) throw new Error('原组件已改变，为避免覆盖更新，暂不能完成');
    const root = draft.nodes.find(node => node.id === frame.rootId);
    if (root) Object.assign(root, { parentId: source.parentId, col: source.col, row: source.row });
    const replacement = root ? [root, ...draft.nodes.filter(node => node.id !== root.id)] : [];
    const nodes = frame.parent.doc.nodes.flatMap(node => node.id === source.id ? replacement : all.has(node.id) ? [] : [node]);
    const parentFrame = this.frames.at(-2);
    if (parentFrame) { const error = editRegionError(nodes, parentFrame.rootId, parentFrame.bounds); if (error) throw new Error(error); }
    const result = clean({ ...frame.parent.doc, nodes }, this.frames.length > 1);
    if (JSON.stringify(result) !== JSON.stringify(clean(frame.parent.doc, this.frames.length > 1))) frame.parent.commit(result);
    this.leave(root ? [root.id] : []);
  }
  finishTemplate() { this.snapshot(); if (!this.current?.templateId) throw new Error('当前不是组合库编辑'); this.leave(); }
  private leave(selection?: string[]) {
    const frame = this.frames.pop()!; this.router.activate(frame.parent);
    this.onNavigate({ ...frame.parentView, selection: selection ?? frame.parentView.selection });
  }
  get pageSize() {
    if (!this.current) return CANVAS;
    const sizes = this.router.doc.nodes.filter(node => !node.parentId).map(node => ({ node, size: node.id === this.rootId ? workingSize(node) : { width: node.colSpan * GRID.cell, height: node.rowSpan * GRID.cell } }));
    return { width: Math.min(EDIT_SPACE.width, Math.max(CANVAS.width, ...sizes.map(({ node, size }) => node.col * GRID.cell + size.width + 96))),
      height: Math.min(EDIT_SPACE.height, Math.max(CANVAS.height, ...sizes.map(({ node, size }) => node.row * GRID.cell + size.height + 96))) };
  }
}
