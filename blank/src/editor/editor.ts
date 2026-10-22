import { registry } from '../components/registry';
import { canPlace, createNode, findSpace, GRID, type Placement } from '../core/model';
import { Store } from '../core/store';
import type { Props } from '../components/contract';
import { isColor } from '../components/colors';
import { isValidShape, shapeOf } from '../components/shape';
import type { DEFAULT_APPEARANCE } from '../core/model';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let toastTimer: ReturnType<typeof setTimeout>;
export function toast(message: string) {
  const target = $('toast');
  target.textContent = message;
  target.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { target.hidden = true; }, 3500);
}

type Mounted = { element: HTMLElement; instance: ReturnType<NonNullable<ReturnType<typeof registry.get>>['mount']> };

export class Editor {
  selected: string | null = null;
  preview = false;
  zoom = 1;
  readonly canvas = $('canvas');
  readonly ghost = $('ghost');
  private mounted = new Map<string, Mounted>();
  private colorPreviewId: string | null = null;
  onSelection = () => {};

  constructor(readonly store: Store) {
    store.subscribe(() => this.render());
    this.canvas.addEventListener('pointerdown', event => {
      if (event.target === this.canvas && !this.preview) this.select(null);
    });
    this.canvas.addEventListener('component-action', event => toast(String((event as CustomEvent).detail || '操作已触发')));
    this.render();
  }

  get node() { return this.store.doc.nodes.find(node => node.id === this.selected); }
  select(id: string | null) {
    if (this.colorPreviewId) {
      const node = this.store.doc.nodes.find(node => node.id === this.colorPreviewId);
      if (node) this.mounted.get(node.id)?.instance.update(node.props);
      this.colorPreviewId = null;
    }
    this.applyAppearance(this.store.doc.appearance);
    this.selected = id;
    this.renderSelection();
    this.onSelection();
  }
  private renderSelection() {
    for (const [id, mounted] of this.mounted) {
      const selected = id === this.selected && !this.preview;
      mounted.element.classList.toggle('selected', selected);
      const node = this.store.doc.nodes.find(node => node.id === id)!;
      const title = registry.get(node.type)!.title;
      mounted.element.setAttribute('aria-label', this.preview ? `${title}，预览` : `${title}${selected ? '，已选中' : ''}，按方向键移动，右侧面板可调整尺寸`);
      mounted.element.querySelector<HTMLElement>('.node-label')!.hidden = !selected;
      mounted.element.querySelector<HTMLElement>('.resize-handle')!.hidden = !selected;
    }
    $('selection-status').textContent = this.node
      ? `${registry.get(this.node.type)!.title} · ${this.node.colSpan} × ${this.node.rowSpan} 格`
      : '未选择组件';
  }

  previewColors(id: string, props: Props) {
    this.colorPreviewId = id;
    this.mounted.get(id)?.instance.update(props);
  }
  applyAppearance(appearance: typeof DEFAULT_APPEARANCE) {
    this.canvas.style.setProperty('--canvas-background', appearance.background);
    this.canvas.style.setProperty('--canvas-grid', appearance.grid);
  }
  render() {
    this.colorPreviewId = null;
    this.applyAppearance(this.store.doc.appearance);
    const ids = new Set(this.store.doc.nodes.map(node => node.id));
    for (const [id, mounted] of this.mounted) {
      if (!ids.has(id)) { mounted.instance.destroy(); mounted.element.remove(); this.mounted.delete(id); }
    }
    if (this.selected && !ids.has(this.selected)) this.selected = null;
    for (const node of this.store.doc.nodes) {
      let mounted = this.mounted.get(node.id);
      const definition = registry.get(node.type)!;
      if (!mounted) {
        const element = document.createElement('div');
        element.className = 'node';
        element.dataset.id = node.id;
        element.tabIndex = this.preview ? -1 : 0;
        element.setAttribute('role', 'group');
        element.setAttribute('aria-label', `${definition.title}，按方向键移动，右侧面板可调整尺寸`);
        const label = document.createElement('span');
        label.className = 'node-label';
        const host = document.createElement('div');
        host.className = 'component-host';
        host.inert = !this.preview;
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'resize-handle';
        handle.tabIndex = -1;
        handle.setAttribute('aria-label', '拖动调整尺寸，也可使用右侧宽高输入框');
        element.append(label, host, handle);
        const instance = definition.mount(host, node.props);
        mounted = { element, instance };
        this.mounted.set(node.id, mounted);
        this.canvas.append(element);
        element.addEventListener('focus', () => { if (!this.preview && this.selected !== node.id) this.select(node.id); });
        element.addEventListener('keydown', event => {
          if ((event.key === 'Enter' || event.key === ' ') && !this.preview) { event.preventDefault(); this.select(node.id); }
        });
      }
      mounted.element.style.left = `${node.col * GRID.cell}px`;
      mounted.element.style.top = `${node.row * GRID.cell}px`;
      mounted.element.style.width = `${node.colSpan * GRID.cell}px`;
      mounted.element.style.height = `${node.rowSpan * GRID.cell}px`;
      mounted.element.style.borderRadius = `${shapeOf(node.props).radius}px`;
      mounted.element.querySelector('.node-label')!.textContent = `${definition.title} · ${node.colSpan} × ${node.rowSpan}`;
      mounted.instance.update(node.props);
      // 小尺寸组件仍可用键盘滚动内部内容，不改变已有交互控件的 tabindex。
      mounted.element.querySelector('.component-host')!.shadowRoot!.querySelectorAll<HTMLElement>('.box, .frame, article').forEach(region => {
        const scrollable = region.scrollHeight > region.clientHeight || region.scrollWidth > region.clientWidth;
        if (scrollable && !region.hasAttribute('tabindex')) { region.tabIndex = 0; region.dataset.scrollFocus = 'true'; }
        else if (!scrollable && region.dataset.scrollFocus) { region.removeAttribute('tabindex'); delete region.dataset.scrollFocus; }
      });
    }
    $('empty-state').hidden = this.store.doc.nodes.length > 0;
    $('node-count').textContent = `${this.store.doc.nodes.length} 个组件`;
    $<HTMLButtonElement>('undo').disabled = !this.store.canUndo || this.preview;
    $<HTMLButtonElement>('redo').disabled = !this.store.canRedo || this.preview;
    this.renderSelection();
    this.onSelection();
  }

  add(type: string, placement?: Placement) {
    if (this.preview) { toast('请先退出预览模式'); return; }
    const node = placement ?? findSpace(createNode(type), this.store.doc.nodes);
    if (!node || !canPlace(node, this.store.doc.nodes)) { toast('没有可用位置，请为组件留出空间'); return; }
    this.selected = node.id;
    this.store.commit({ ...this.store.doc, nodes: [...this.store.doc.nodes, node] });
    toast('组件已添加');
  }
  update(node: Placement) {
    if (this.preview) return false;
    if (!canPlace(node, this.store.doc.nodes)) { toast('无法放置：请检查重叠、边界和最小尺寸'); return false; }
    if (['accent', 'background', 'text', 'border'].some(key => !isColor(node.props[key as keyof Props]))) { toast('请输入有效的六位十六进制颜色'); return false; }
    if (!isValidShape(node.props)) { toast('圆角或边框设置无效，请检查范围'); return false; }
    this.store.commit({ ...this.store.doc, nodes: this.store.doc.nodes.map(other => other.id === node.id ? node : other) });
    return true;
  }
  remove() {
    if (!this.node || this.preview) return;
    this.store.commit({ ...this.store.doc, nodes: this.store.doc.nodes.filter(node => node.id !== this.selected) });
    toast('组件已删除，可撤销恢复');
  }
  duplicate() {
    if (!this.node || this.preview) return;
    const copy = structuredClone(this.node);
    copy.id = crypto.randomUUID();
    const placement = findSpace(copy, this.store.doc.nodes);
    if (!placement) { toast('没有足够空间复制组件'); return; }
    this.add(copy.type, placement);
  }
  setZoom(value: number) {
    this.zoom = value;
    this.canvas.style.transform = `scale(${value})`;
    $('canvas-shell').style.width = `${GRID.cols * GRID.cell * value}px`;
    $('canvas-shell').style.height = `${GRID.rows * GRID.cell * value}px`;
  }
  setPreview() {
    this.preview = !this.preview;
    document.body.classList.toggle('preview', this.preview);
    $('preview').setAttribute('aria-pressed', String(this.preview));
    $('preview').textContent = this.preview ? '✎ 返回编辑' : '▷ 预览';
    $('mode-label').textContent = this.preview ? '预览模式' : '编辑模式';
    for (const mounted of this.mounted.values()) {
      mounted.element.tabIndex = this.preview ? -1 : 0;
      mounted.element.querySelector<HTMLElement>('.component-host')!.inert = !this.preview;
    }
    this.render();
    toast(this.preview ? '预览模式：可以操作组件内部控件' : '已返回编辑模式');
  }
}
