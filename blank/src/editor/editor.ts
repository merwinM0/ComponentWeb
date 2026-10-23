import { createNode, findSpace, GRID, parseDocument, type Document, type Placement } from '../core/model';
import { CANVAS } from '../core/grid';
import { Store } from '../core/store';
import { bounds, childrenOf, descendants, topSelection } from '../core/tree';
import { isContainer, type ContainerLayout } from '../core/types';
import { alignNodes, cloneForest, distributeNodes, groupNodes, moveNodes, placeForest, reorderNodes, type Alignment } from '../core/operations';
import type { Props } from '../components/contract';
import { CanvasRenderer } from './canvas-renderer';
import { $, toast } from './dom';
export { $, toast } from './dom';

export class Editor {
  selectedIds = new Set<string>();
  preview = false;
  zoom = 1;
  readonly canvas = $('canvas');
  readonly ghost = $('ghost');
  readonly renderer: CanvasRenderer;
  onSelection = () => {};
  onSaveCombination = () => {};
  private colorPreviewId: string | null = null;
  constructor(readonly store: Store) {
    this.renderer = new CanvasRenderer(this.canvas, id => { if (!this.preview && !this.selectedIds.has(id)) this.select(id); });
    Object.assign(this.canvas.style, { width: `${CANVAS.width}px`, height: `${CANVAS.height}px` });
    this.canvas.style.setProperty('--grid-cell', `${GRID.cell}px`); this.canvas.style.setProperty('--grid-major', '48px');
    $('grid-dimensions').textContent = `${GRID.cols} × ${GRID.rows}`; $('grid-cell-label').textContent = `${GRID.cell} px 网格`;
    this.setZoom(1);
    store.subscribe(() => this.render());
    this.canvas.addEventListener('component-action', event => toast(String((event as CustomEvent).detail || '操作已触发')));
    this.render();
  }
  get selected() { return [...this.selectedIds].at(-1) ?? null; }
  get selection() { return topSelection(this.store.doc.nodes, this.selectedIds); }
  get node() { return this.selectedIds.size === 1 ? this.store.doc.nodes.find(node => node.id === this.selected) : undefined; }
  select(id: string | null, toggle = false) {
    if (this.preview) return;
    const ids = toggle ? new Set(this.selectedIds) : new Set<string>();
    if (id) { if (toggle && ids.has(id)) ids.delete(id); else ids.add(id); }
    this.setSelection(ids);
  }
  setSelection(ids: Iterable<string>) {
    if (this.colorPreviewId) { const node = this.store.doc.nodes.find(node => node.id === this.colorPreviewId); if (node) this.renderer.preview(node.id, node.props); this.colorPreviewId = null; }
    this.applyAppearance(this.store.doc.appearance);
    this.selectedIds = new Set(topSelection(this.store.doc.nodes, ids).map(node => node.id));
    this.renderer.selection(this.store.doc.nodes, this.selectedIds, this.preview);
    this.selectionStatus(); this.onSelection();
  }
  selectAll(parentId: string | null = null) { this.setSelection(childrenOf(this.store.doc.nodes, parentId).map(node => node.id)); }
  private selectionStatus() {
    $('selection-status').textContent = this.selectedIds.size > 1 ? `已选择 ${this.selectedIds.size} 个组件 · Shift 点击增减选择` : this.node ? `${this.node.props.title || '组件'} · ${this.renderer.element(this.node.id)?.offsetWidth} × ${this.renderer.element(this.node.id)?.offsetHeight} px` : '未选择组件 · 空白处拖动框选';
    document.querySelectorAll<HTMLButtonElement>('[data-selection-action]').forEach(button => { button.disabled = this.preview || !this.selectedIds.size; });
  }
  previewColors(id: string, props: Props) { this.colorPreviewId = id; this.renderer.preview(id, props); }
  applyAppearance(appearance: Document['appearance']) { this.canvas.style.setProperty('--canvas-background', appearance.background); this.canvas.style.setProperty('--canvas-grid', appearance.grid); }
  render() {
    this.colorPreviewId = null; this.applyAppearance(this.store.doc.appearance);
    this.selectedIds = new Set([...this.selectedIds].filter(id => this.store.doc.nodes.some(node => node.id === id)));
    this.renderer.render(this.store.doc, this.selectedIds, this.preview);
    $('empty-state').hidden = !!this.store.doc.nodes.length;
    $('node-count').textContent = `${this.store.doc.nodes.length} 个组件`;
    $<HTMLButtonElement>('undo').disabled = !this.store.canUndo || this.preview; $<HTMLButtonElement>('redo').disabled = !this.store.canRedo || this.preview;
    this.selectionStatus(); this.onSelection();
  }
  commit(nodes: Placement[], ids?: Iterable<string>) {
    if (this.preview) return false;
    try {
      const doc = parseDocument(JSON.stringify({ ...this.store.doc, nodes }));
      const unchanged = JSON.stringify(doc) === JSON.stringify(this.store.doc);
      if (ids) this.selectedIds = new Set(ids);
      this.store.commit(doc);
      if (unchanged) { this.renderer.selection(this.store.doc.nodes, this.selectedIds, this.preview); this.selectionStatus(); this.onSelection(); }
      return true;
    } catch (error) { toast(error instanceof Error ? error.message : '操作失败'); return false; }
  }
  attempt(action: () => Placement[], ids?: Iterable<string>) {
    try { return this.commit(action(), ids); } catch (error) { toast((error as Error).message); return false; }
  }
  add(type: string, placement?: Placement, parentId: string | null = null) {
    if (this.preview) return;
    const node = placement ?? findSpace({ ...createNode(type), parentId }, this.store.doc.nodes);
    if (!node) { toast('没有可用空间，可调整容器尺寸或使用自动布局'); return; }
    this.commit([...this.store.doc.nodes, node], [node.id]);
  }
  update(node: Placement) { return this.commit(this.store.doc.nodes.map(other => other.id === node.id ? node : other)); }
  move(dx: number, dy: number) { return this.attempt(() => moveNodes(this.store.doc.nodes, this.selectedIds, dx, dy)); }
  align(value: Alignment) { this.attempt(() => alignNodes(this.store.doc.nodes, this.selectedIds, value)); }
  distribute(axis: 'x' | 'y') { this.attempt(() => distributeNodes(this.store.doc.nodes, this.selectedIds, axis)); }
  group(mode: ContainerLayout['mode'] = 'free') {
    try { const result = groupNodes(this.store.doc.nodes, this.selectedIds, mode); this.commit(result.nodes, [result.container.id]); } catch (error) { toast((error as Error).message); }
  }
  remove() { const all = descendants(this.store.doc.nodes, this.selectedIds); this.commit(this.store.doc.nodes.filter(node => !all.has(node.id)), []); }
  duplicate() {
    if (!this.selectedIds.size) return;
    try {
      const roots = this.selection;
      if (roots.some(node => node.parentId !== roots[0].parentId)) throw new Error('复制时请选择同一父级的组件');
      const copies = cloneForest(this.store.doc.nodes, this.selectedIds);
      this.commit([...this.store.doc.nodes, ...placeForest(copies.nodes, copies.roots, this.store.doc.nodes, roots[0].parentId)], copies.roots);
    } catch (error) { toast((error as Error).message); }
  }
  insertSnapshot(snapshot: Document, parentId: string | null = null, position?: { col: number; row: number }) {
    try {
      const copies = cloneForest(snapshot.nodes, snapshot.nodes.filter(node => !node.parentId).map(node => node.id));
      this.commit([...this.store.doc.nodes, ...placeForest(copies.nodes, copies.roots, this.store.doc.nodes, parentId, position)], copies.roots);
    } catch (error) { toast((error as Error).message); }
  }
  logicalRect(id: string) {
    const rect = this.renderer.element(id)!.getBoundingClientRect(); const canvas = this.canvas.getBoundingClientRect();
    return { col: (rect.left - canvas.left) / this.zoom / GRID.cell, row: (rect.top - canvas.top) / this.zoom / GRID.cell, colSpan: rect.width / this.zoom / GRID.cell, rowSpan: rect.height / this.zoom / GRID.cell };
  }
  origin(parentId: string | null) {
    const target = this.renderer.content(parentId); const rect = target.getBoundingClientRect(); const canvas = this.canvas.getBoundingClientRect();
    return { col: (rect.left - canvas.left) / this.zoom / GRID.cell - target.scrollLeft / GRID.cell, row: (rect.top - canvas.top) / this.zoom / GRID.cell - target.scrollTop / GRID.cell };
  }
  reparent(parentId: string | null) {
    const roots = this.selection; const selected = new Set(roots.map(node => node.id));
    if (parentId && descendants(this.store.doc.nodes, selected).has(parentId)) { toast('不能将组件放入自己或后代'); return; }
    const origin = this.origin(parentId); const parent = this.store.doc.nodes.find(node => node.id === parentId);
    const geometries = new Map(roots.map(node => [node.id, this.logicalRect(node.id)]));
    this.commit(this.store.doc.nodes.map(node => selected.has(node.id) ? { ...node, parentId,
      col: parent?.layout?.mode !== 'free' && parent ? 0 : geometries.get(node.id)!.col - origin.col,
      row: parent?.layout?.mode !== 'free' && parent ? 0 : geometries.get(node.id)!.row - origin.row } : node));
  }
  ungroup() {
    const node = this.node; if (!node || !isContainer(node)) return;
    const origin = this.origin(node.parentId);
    const geometries = new Map(childrenOf(this.store.doc.nodes, node.id).map(child => [child.id, this.logicalRect(child.id)]));
    const nodes = this.store.doc.nodes.filter(other => other.id !== node.id).map(other => geometries.has(other.id) ? { ...other, parentId: node.parentId,
      col: geometries.get(other.id)!.col - origin.col, row: geometries.get(other.id)!.row - origin.row,
      colSpan: geometries.get(other.id)!.colSpan, rowSpan: geometries.get(other.id)!.rowSpan } : other);
    this.commit(nodes, geometries.keys());
  }
  changeLayout(layout: ContainerLayout) {
    const node = this.node; if (!node || !isContainer(node)) return;
    let nodes = this.store.doc.nodes;
    if (node.layout!.mode !== 'free' && layout.mode === 'free') {
      const origin = this.origin(node.id);
      const delta = (layout.padding - node.layout!.padding) / GRID.cell;
      const positions = new Map(childrenOf(nodes, node.id).map(child => [child.id, this.logicalRect(child.id)]));
      nodes = nodes.map(child => positions.has(child.id) ? { ...child, ...positions.get(child.id)!, col: positions.get(child.id)!.col - origin.col - delta, row: positions.get(child.id)!.row - origin.row - delta } : child);
    }
    if (!this.commit(nodes.map(other => other.id === node.id ? { ...other, layout } : other))) this.onSelection();
  }
  reorder(step: number) {
    const roots = this.selection; if (!roots.length) return;
    const siblings = childrenOf(this.store.doc.nodes, roots[0].parentId); const index = siblings.findIndex(node => node.id === roots[0].id);
    const before = step < 0 ? siblings[Math.max(0, index - 1)]?.id ?? null : siblings[index + roots.length + 1]?.id ?? null;
    this.commit(reorderNodes(this.store.doc.nodes, this.selectedIds, before));
  }
  setZoom(value: number) {
    this.zoom = value; this.canvas.style.transform = `scale(${value})`;
    $('canvas-shell').style.width = `${CANVAS.width * value}px`; $('canvas-shell').style.height = `${CANVAS.height * value}px`;
  }
  setPreview() {
    this.preview = !this.preview; document.body.classList.toggle('preview', this.preview);
    $('preview').setAttribute('aria-pressed', String(this.preview)); $('preview').textContent = this.preview ? '✎ 返回编辑' : '▷ 预览'; $('mode-label').textContent = this.preview ? '预览模式' : '编辑模式'; this.render();
  }
}
