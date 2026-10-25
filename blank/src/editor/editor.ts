import { createNode, findSpace, GRID, parseDocument, type Document, type Placement } from '../core/model';
import { CANVAS, canvasSize, matchesGrid } from '../core/grid';
import { fitCanvasScale } from '../core/canvas-view';
import { ThemePreferences } from '../core/theme';
import { applyGridAppearance } from './theme';
import type { InlineEdit } from '../core/inline-edit';
import { workingSize } from '../core/assembly';
import type { ElementEdit } from '../core/element-edits';
import type { StorePort } from '../core/store';
import { bounds, childrenOf, descendants, topSelection } from '../core/tree';
import { isContainer, type ContainerLayout } from '../core/types';
import { alignNodes, cloneForest, distributeNodes, groupNodes, moveNodes, placeForest, reorderNodes, type Alignment } from '../core/operations';
import type { Props } from '../components/contract';
import { CanvasRenderer } from './canvas-renderer';
import { hitNode, logicalRect, contentOrigin, arrangeVisual } from './coordinates';
import { editRegionError, regionOf, resizeEditingNode, moveEditingRegion } from '../core/edit-region';
import { $, toast } from './dom';
export { $, toast } from './dom';

export class Editor {
  selectedIds = new Set<string>();
  preview = false;
  active = true;
  zoom = 1;
  fitView = true;
  readonly canvas = $('canvas');
  readonly ghost = $('ghost');
  readonly renderer: CanvasRenderer;
  onSelection = () => {};
  onSaveCombination = () => {};
  onEditComponent = (_id: string) => {};
  onNewComponent = (_parentId?: string | null) => {};
  onEditSavedCombination = (_id: string) => {};
  onAssemble = () => {};
  selectedTag: { id: string; path: number[] } | null = null;
  onSelectTag = (_id: string, _path: number[]) => {};
  onChangeTag = (_id: string, _edit: ElementEdit | null) => {};
  readonly contextRenderer: CanvasRenderer;
  private lastScope: string | null = null;
  private lastContext: object | null = null;
  private colorPreviewId: string | null = null;
  constructor(readonly store: StorePort, readonly session?: InlineEdit, active = true, readonly preferences = new ThemePreferences()) {
    this.active = active;
    this.contextRenderer = new CanvasRenderer($('context-layer'), () => {});
    this.renderer = new CanvasRenderer(this.canvas, id => { if (!this.preview && !this.selectedIds.has(id)) this.select(id); });
    Object.assign(this.canvas.style, { width: `${CANVAS.width}px`, height: `${CANVAS.height}px` });
    this.canvas.style.setProperty('--grid-cell', `${GRID.cell}px`); this.canvas.style.setProperty('--grid-major', '48px');
    $('grid-cell-label').textContent = `${GRID.cell} px 网格`;
    this.setZoom(1);
    let appearanceContext = store.contextToken ?? store, documentAppearance = JSON.stringify(store.doc.appearance);
    store.subscribe(() => {
      const context = store.contextToken ?? store, value = JSON.stringify(store.doc.appearance);
      const changed = context === appearanceContext && value !== documentAppearance;
      appearanceContext = context; documentAppearance = value;
      // 保留画布配色的撤销 / 重做；切换布局或草稿不覆盖浏览器的当前外观。
      if (changed) this.preferences.setAppearance(store.doc.appearance);
      this.render();
    });
    this.preferences.subscribe(() => { this.applyAppearance(this.appearance); this.onSelection(); });
    this.canvas.addEventListener('component-action', event => toast(String((event as CustomEvent).detail || '操作已触发')));
    const refit = () => { if (this.active && this.fitView && !this.session?.current) this.fitCanvas(); };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refit).observe($('viewport'));
    else window.addEventListener('resize', refit);
    this.render();
  }
  get scopeRootId() { return this.session?.rootId ?? null; }
  get scopeRoot() { return this.store.doc.nodes.find(node => node.id === this.scopeRootId); }
  get pageSize() { return this.session?.pageSize ?? canvasSize(this.store.doc.grid); }
  hitNode(target: HTMLElement, deep = false) { return hitNode(this, target, deep); }
  pageError(nodes: Placement[]): string | null {
    if (!this.scopeRootId) return null;
    return editRegionError(nodes, this.scopeRootId, this.session?.current?.bounds);
  }
  get selected() { return [...this.selectedIds].at(-1) ?? null; }
  get selection() { return topSelection(this.store.doc.nodes, this.selectedIds); }
  get node() { return this.selectedIds.size === 1 ? this.store.doc.nodes.find(node => node.id === this.selected) : undefined; }
  select(id: string | null, toggle = false) {
    if (!this.active || this.preview) return;
    const ids = toggle ? new Set(this.selectedIds) : new Set<string>();
    if (id) { if (toggle && ids.has(id)) ids.delete(id); else ids.add(id); }
    this.setSelection(ids);
  }
  setSelection(ids: Iterable<string>) {
    if (this.colorPreviewId) { const node = this.store.doc.nodes.find(node => node.id === this.colorPreviewId); if (node) this.renderer.preview(node.id, node.props); this.colorPreviewId = null; }
    this.selectedTag = null;
    this.applyAppearance(this.appearance);
    this.selectedIds = new Set(topSelection(this.store.doc.nodes, ids).map(node => node.id));
    this.renderer.selection(this.store.doc.nodes, this.selectedIds, this.preview);
    this.selectionStatus(); this.onSelection();
  }
  selectAll(parentId: string | null = null) { this.setSelection(childrenOf(this.store.doc.nodes, parentId).map(node => node.id)); }
  private selectionStatus() {
    $('selection-status').textContent = this.selectedIds.size > 1 ? `已选择 ${this.selectedIds.size} 个组件 · Shift 点击增减选择` : this.node ? `${this.node.props.title || '组件'} · ${Math.round(this.logicalRect(this.node.id).colSpan * GRID.cell)} × ${Math.round(this.logicalRect(this.node.id).rowSpan * GRID.cell)} px` : '未选择组件 · 空白处拖动框选';
    document.querySelectorAll<HTMLButtonElement>('[data-selection-action]').forEach(button => { button.disabled = this.preview || !this.selectedIds.size; });
  }
  previewColors(id: string, props: Props) { this.colorPreviewId = id; this.renderer.preview(id, props);  }
  get appearance() { return this.preferences.appearance; }
  changeAppearance(appearance: Document['appearance']) {
    if (!this.active || this.preview) return;
    this.store.commit({ ...this.store.doc, appearance }, this.appearance);
    this.preferences.setAppearance(appearance); if (this.preferences.warning) toast(this.preferences.warning);
  }
  applyAppearance(appearance: Document['appearance']) {
    this.canvas.style.setProperty('--canvas-background', appearance.background); this.canvas.style.setProperty('--canvas-grid', appearance.grid);
    applyGridAppearance(this.preferences, appearance);
  }
  render() {
    if (!this.active) return;
    const context = this.store.contextToken ?? this.store;
    if (this.lastScope !== this.scopeRootId || this.lastContext !== context) { this.renderer.clear(); this.selectedTag = null; this.lastScope = this.scopeRootId; this.lastContext = context; }
    const size = this.pageSize; Object.assign(this.canvas.style, { width: `${size.width}px`, height: `${size.height}px` });
    if (this.fitView && !this.session?.current) this.fitCanvas(); else this.setZoom(this.zoom);
    $('canvas-size-label').textContent = this.session?.current ? '原位编辑' : matchesGrid(this.store.doc.grid, GRID) ? '16:9 横屏' : '旧画布兼容';
    this.colorPreviewId = null; this.applyAppearance(this.appearance);
    this.selectedIds = new Set([...this.selectedIds].filter(id => this.store.doc.nodes.some(node => node.id === id)));
    if (this.selectedTag && (!this.selectedIds.has(this.selectedTag.id) || !this.store.doc.nodes.some(node => node.id === this.selectedTag!.id && !isContainer(node)))) this.selectedTag = null;
    if (this.session?.current) this.contextRenderer.render(this.session.current.background, new Set(), true);
    else this.contextRenderer.clear();
    this.renderer.render(this.store.doc, this.selectedIds, this.preview, this.scopeRootId);
    $('empty-state').hidden = !!this.store.doc.nodes.length || !!this.scopeRootId;
    $('node-count').textContent = this.scopeRootId ? `${this.store.doc.nodes.length} 个编辑对象` : `${this.store.doc.nodes.length} 个组件`;
    $<HTMLButtonElement>('undo').disabled = !this.store.canUndo || this.preview; $<HTMLButtonElement>('redo').disabled = !this.store.canRedo || this.preview;
    this.selectionStatus(); this.onSelection();
  }
  prepareNodes(nodes: Placement[]) { return this.scopeRootId ? moveEditingRegion(nodes, this.store.doc.nodes, this.scopeRootId) : nodes; }
  resizeEditing(width: number, height: number) { return this.attempt(() => this.store.doc.nodes.map(node => node.id === this.scopeRootId ? resizeEditingNode(node, width, height) : node)); }
  commit(nodes: Placement[], ids?: Iterable<string>) {
    if (!this.active || this.preview) return false;
    try {
      nodes = this.prepareNodes(nodes);
      const pageError = this.pageError(nodes); if (pageError) throw new Error(pageError);
      const doc = parseDocument(JSON.stringify({ ...this.store.doc, nodes }), !!this.scopeRootId);
      const root = doc.nodes.find(node => node.id === this.scopeRootId), old = this.scopeRoot;
      if (root && !isContainer(root) && old && JSON.stringify(root) !== JSON.stringify(old)) this.renderer.checkNative(root, true);
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
    const target = parentId ?? (this.scopeRoot && isContainer(this.scopeRoot) ? this.scopeRootId : null);
    const created = createNode(type), position = this.scopeRootId ? this.stagingPosition(created, target) : undefined;
    const node = placement ? { ...placement, parentId: placement.parentId ?? target } : this.scopeRootId ? position && { ...created, parentId: target, ...position } : findSpace({ ...created, parentId: target }, this.store.doc.nodes, this.store.doc.grid);
    if (!node) { toast(this.scopeRootId ? '组件放不进当前编辑框，请先扩大被编辑组件' : '没有可用空间，可调整容器尺寸或使用自动布局'); return; }
    this.commit([...this.store.doc.nodes, node], [node.id]);
  }
  stagingPosition(node: Pick<Placement, 'colSpan' | 'rowSpan'>, parentId: string | null = null) {
    const root = this.scopeRoot;
    const parent = this.store.doc.nodes.find(item => item.id === parentId), area = parent ? { ...regionOf(parent, true), col: 0, row: 0 } : root ? regionOf(root, true) : this.session?.current?.bounds;
    if (!area) return undefined;
    if (node.colSpan > area.cols + 1e-6 || node.rowSpan > area.rows + 1e-6) return undefined;
    if (parent?.layout?.mode !== 'free' && parent) return { col: 0, row: 0 };
    const count = this.session?.loose.length ?? 0;
    return { col: area.col + Math.min(count % 4, area.cols - node.colSpan), row: area.row + Math.min(Math.floor(count / 4), area.rows - node.rowSpan) };
  }
  update(node: Placement) { return this.commit(this.store.doc.nodes.map(other => other.id === node.id ? node : other)); }
  move(dx: number, dy: number) { return this.attempt(() => moveNodes(this.store.doc.nodes, this.selectedIds, dx, dy)); }
  align(value: Alignment) { this.attempt(() => arrangeVisual(this, nodes => alignNodes(nodes, this.selectedIds, value))); }
  distribute(axis: 'x' | 'y') { this.attempt(() => arrangeVisual(this, nodes => distributeNodes(nodes, this.selectedIds, axis))); }
  group(mode: ContainerLayout['mode'] = 'free') {
    if (this.scopeRootId) { this.onAssemble(); return; }
    try { const result = groupNodes(this.store.doc.nodes, this.selectedIds, mode); this.commit(result.nodes, [result.container.id]); } catch (error) { toast((error as Error).message); }
  }
  remove() { const all = descendants(this.store.doc.nodes, this.selectedIds); this.commit(this.store.doc.nodes.filter(node => !all.has(node.id)), []); }
  duplicate() {
    if (!this.selectedIds.size) return;
    try {
      const roots = this.selection;
      if (roots.some(node => node.parentId !== roots[0].parentId)) throw new Error('复制时请选择同一父级的组件');
      const copies = cloneForest(this.store.doc.nodes, this.selectedIds);
      const target = this.scopeRootId ? this.scopeRoot && isContainer(this.scopeRoot) ? this.scopeRootId : null : roots[0].parentId;
      if (this.scopeRootId && copies.roots.length === 1 && roots[0].id === this.scopeRootId) { const size = workingSize(roots[0]); const copy = copies.nodes.find(node => node.id === copies.roots[0])!; copy.colSpan = size.width / GRID.cell; copy.rowSpan = size.height / GRID.cell; }
      const position = this.scopeRootId ? this.stagingPosition(bounds(copies.nodes.filter(node => copies.roots.includes(node.id))), target) : undefined;
      if (this.scopeRootId && !position) throw new Error('副本放不进编辑框，请先扩大组件');
      this.commit([...this.store.doc.nodes, ...placeForest(copies.nodes, copies.roots, this.store.doc.nodes, target, position, this.store.doc.grid)], copies.roots);
    } catch (error) { toast((error as Error).message); }
  }
  insertSnapshot(snapshot: Document, parentId: string | null = null, position?: { col: number; row: number }) {
    try {
      const copies = cloneForest(snapshot.nodes, snapshot.nodes.filter(node => !node.parentId).map(node => node.id));
      const target = parentId ?? (this.scopeRoot && isContainer(this.scopeRoot) ? this.scopeRootId : null);
      const placed = position ?? (this.scopeRootId ? this.stagingPosition(bounds(copies.nodes.filter(node => copies.roots.includes(node.id))), target) : undefined);
      if (this.scopeRootId && !placed) throw new Error('组合放不进编辑框，请先扩大组件');
      this.commit([...this.store.doc.nodes, ...placeForest(copies.nodes, copies.roots, this.store.doc.nodes, target, placed, this.store.doc.grid)], copies.roots);
    } catch (error) { toast((error as Error).message); }
  }
  logicalRect(id: string) { return logicalRect(this, id); }
  origin(parentId: string | null) { return contentOrigin(this, parentId); }
  reparent(parentId: string | null) {
    const roots = this.selection; const selected = new Set(roots.map(node => node.id));
    if (parentId && descendants(this.store.doc.nodes, selected).has(parentId)) { toast('不能将组件放入自己或后代'); return; }
    const origin = this.origin(parentId); const parent = this.store.doc.nodes.find(node => node.id === parentId);
    const geometries = new Map(roots.map(node => [node.id, this.logicalRect(node.id)]));
    this.commit(this.store.doc.nodes.map(node => selected.has(node.id) ? { ...node, parentId,
      col: parent?.layout?.mode !== 'free' && parent ? 0 : (geometries.get(node.id)!.col - origin.col) / origin.scaleX,
      row: parent?.layout?.mode !== 'free' && parent ? 0 : (geometries.get(node.id)!.row - origin.row) / origin.scaleY } : node));
  }
  ungroup() {
    const node = this.node; if (!node || !isContainer(node)) return;
    const origin = this.origin(node.parentId);
    const geometries = new Map(childrenOf(this.store.doc.nodes, node.id).map(child => [child.id, this.logicalRect(child.id)]));
    const nodes = this.store.doc.nodes.filter(other => other.id !== node.id).map(other => geometries.has(other.id) ? { ...other, parentId: node.parentId,
      col: (geometries.get(other.id)!.col - origin.col) / origin.scaleX, row: (geometries.get(other.id)!.row - origin.row) / origin.scaleY,
      colSpan: geometries.get(other.id)!.colSpan / origin.scaleX, rowSpan: geometries.get(other.id)!.rowSpan / origin.scaleY } : other);
    this.commit(nodes, geometries.keys());
  }
  changeLayout(layout: ContainerLayout) {
    const node = this.node; if (!node || !isContainer(node)) return;
    let nodes = this.store.doc.nodes;
    if (node.layout!.mode !== 'free' && layout.mode === 'free') {
      const origin = this.origin(node.id);
      const delta = (layout.padding - node.layout!.padding) / GRID.cell;
      const positions = new Map(childrenOf(nodes, node.id).map(child => [child.id, this.logicalRect(child.id)]));
      nodes = nodes.map(child => positions.has(child.id) ? { ...child, colSpan: positions.get(child.id)!.colSpan / origin.scaleX, rowSpan: positions.get(child.id)!.rowSpan / origin.scaleY,
        col: (positions.get(child.id)!.col - origin.col) / origin.scaleX - delta, row: (positions.get(child.id)!.row - origin.row) / origin.scaleY - delta } : child);
    }
    if (!this.commit(nodes.map(other => other.id === node.id ? { ...other, layout } : other))) this.onSelection();
  }
  reorder(step: number) {
    const roots = this.selection; if (!roots.length) return;
    const siblings = childrenOf(this.store.doc.nodes, roots[0].parentId); const index = siblings.findIndex(node => node.id === roots[0].id);
    const before = step < 0 ? siblings[Math.max(0, index - 1)]?.id ?? null : siblings[index + roots.length + 1]?.id ?? null;
    this.commit(reorderNodes(this.store.doc.nodes, this.selectedIds, before));
  }
  fitCanvas() {
    const viewport = $('viewport'), scale = fitCanvasScale(viewport.clientWidth, viewport.clientHeight, this.pageSize);
    if (scale !== null) this.setZoom(scale, true);
  }
  setZoom(value: number, fitting = this.fitView) {
    this.fitView = fitting; this.zoom = value; this.renderer.zoom = value; this.contextRenderer.zoom = value; this.canvas.style.transform = `scale(${value})`;
    const size = this.pageSize; $('canvas-shell').style.width = `${size.width * value}px`; $('canvas-shell').style.height = `${size.height * value}px`;
    $('viewport').classList.toggle('fit-view', fitting);
    $<HTMLSelectElement>('zoom').value = fitting ? 'fit' : String(value);
    $<HTMLOptionElement>('zoom-fit').textContent = fitting ? `适应（${Math.round(value * 100)}%）` : '适应工作区';
    $('canvas-size-label').title = `逻辑尺寸 ${size.width} × ${size.height} px；显示 ${Math.round(value * 100)}%`;
  }
  setPreview() {
    this.preview = !this.preview; document.body.classList.toggle('preview', this.preview);
    $('preview').setAttribute('aria-pressed', String(this.preview)); $('preview').textContent = this.preview ? '✎ 返回编辑' : '▷ 预览'; $('mode-label').textContent = this.preview ? '预览模式' : '编辑模式'; this.render();
  }
}
