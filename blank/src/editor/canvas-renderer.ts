import { registry } from '../components/registry';
import { shapeOf } from '../components/shape';
import type { Props } from '../components/contract';
import { GRID } from '../core/grid';
import { designSize, displayScale } from '../core/design-space';
import { childrenOf } from '../core/tree';
import { isContainer, type Document, type Placement } from '../core/types';

type Mounted = { type: string; element: HTMLElement; host: HTMLElement; instance: ReturnType<NonNullable<ReturnType<typeof registry.get>>['mount']> };
export class CanvasRenderer {
  mounted = new Map<string, Mounted>();
  private previewMode = false;
  zoom = 1;
  constructor(readonly canvas: HTMLElement, private focus: (id: string) => void) {}
  preview(id: string, props: Props) { this.mounted.get(id)?.instance.update(props); }
  clear() { for (const item of this.mounted.values()) { item.instance.destroy(); item.element.remove(); } this.mounted.clear(); }
  render(doc: Document, selected: Set<string>, preview: boolean, scopeRootId: string | null = null) {
    this.previewMode = preview;
    const ids = new Set(doc.nodes.map(node => node.id));
    for (const [id, item] of this.mounted) if (!ids.has(id)) { item.instance.destroy(); item.element.remove(); this.mounted.delete(id); }
    const visit = (parentId: string | null, target: HTMLElement) => {
      const children = childrenOf(doc.nodes, parentId);
      const parent = doc.nodes.find(node => node.id === parentId);
      children.forEach((node, index) => {
        let item = this.mounted.get(node.id);
        const definition = registry.get(node.type)!;
        if (item && item.type !== node.type) { item.instance.destroy(); item.element.remove(); this.mounted.delete(node.id); item = undefined; }
        if (!item) {
          const element = document.createElement('div'); element.className = 'node'; element.dataset.id = node.id; element.setAttribute('role', 'group');
          const label = document.createElement('span'); label.className = 'node-label';
          const host = document.createElement('div'); host.className = 'component-host';
          const handle = document.createElement('button'); handle.type = 'button'; handle.className = 'resize-handle'; handle.tabIndex = -1; handle.setAttribute('aria-label', '拖动调整尺寸，也可使用右侧宽高输入框');
          element.append(label, host, handle);
          item = { type: node.type, element, host, instance: definition.mount(host, node.props) }; this.mounted.set(node.id, item);
          element.addEventListener('focus', event => { if (event.target === element && !element.dataset.pointerFocus && !this.previewMode) this.focus(node.id); });
        }
        const current = [...target.children].filter(child => child.classList.contains('node'))[index];
        if (current !== item.element) target.insertBefore(item.element, current ?? null);
        const auto = !!parent?.layout && parent.layout.mode !== 'free';
        const stretch = auto && parent!.layout!.align === 'stretch';
        const minWidth = definition.min[0] * GRID.cell;
        Object.assign(item.element.style, {
          position: auto ? 'relative' : 'absolute', left: auto ? 'auto' : `${node.col * GRID.cell}px`, top: auto ? 'auto' : `${node.row * GRID.cell}px`,
          width: parent?.layout?.mode === 'grid' ? '100%' : stretch && parent?.layout?.direction === 'column' ? 'auto' : `${node.colSpan * GRID.cell}px`,
          height: stretch ? 'auto' : `${node.rowSpan * GRID.cell}px`, minHeight: stretch ? `${node.rowSpan * GRID.cell}px` : '0',
          minWidth: auto ? `${minWidth}px` : '0', flex: '0 0 auto', borderRadius: `${shapeOf(node.props).radius}px`,
        });
        if (node.id === scopeRootId) { const size = designSize(node); item.element.style.width = `${size.width}px`; item.element.style.height = `${size.height}px`; }
        item.element.tabIndex = preview ? -1 : 0;
        item.element.dataset.container = String(isContainer(node));
        item.element.classList.toggle('scope-root', node.id === scopeRootId);
        if (node.id === scopeRootId && !preview) item.host.style.setProperty('--container-background', 'transparent');
        else item.host.style.removeProperty('--container-background');
        item.host.classList.toggle('container-host', isContainer(node));
        item.host.inert = !preview && !isContainer(node);
        item.instance.update(node.props);
        if (isContainer(node)) {
          const layout = node.layout!;
          const size = designSize(node);
          Object.assign(item.host.shadowRoot!.querySelector<HTMLElement>('.container-surface')!.style, { width: `${size.width}px`, height: `${size.height}px`, transformOrigin: '0 0' });
          item.host.style.setProperty('--layout-padding', `${layout.padding}px`);
          item.host.style.setProperty('--layout-gap', `${layout.gap}px`);
          const body = item.host.shadowRoot!.querySelector<HTMLElement>('.container-children')!;
          const minTrack = Math.max(0, ...childrenOf(doc.nodes, node.id).map(child => registry.get(child.type)!.min[0] * GRID.cell));
          Object.assign(body.style, { display: layout.mode === 'free' ? 'block' : layout.mode, flexDirection: layout.direction,
            flexWrap: layout.wrap ? 'wrap' : 'nowrap', alignItems: layout.align, justifyContent: layout.justify,
            gridTemplateColumns: `repeat(${layout.columns}, minmax(${minTrack}px,1fr))`, gridAutoRows: 'minmax(min-content,1fr)' });
          body.dataset.empty = String(!preview && !childrenOf(doc.nodes, node.id).length);
          visit(node.id, item.host);
        }
        item.host.shadowRoot!.querySelectorAll<HTMLElement>('.box,.frame,article,.container-children').forEach(region => {
          if (region.scrollHeight > region.clientHeight || region.scrollWidth > region.clientWidth) { if (!region.hasAttribute('tabindex')) { region.tabIndex = 0; region.dataset.scrollFocus = 'true'; } }
          else if (region.dataset.scrollFocus) { region.removeAttribute('tabindex'); delete region.dataset.scrollFocus; }
        });
      });
    };
    visit(null, this.canvas);
    // 所有子项挂载后再测量，保证 Flex/Grid 重新分行后的实际显示尺寸也参与缩放。
    for (const node of doc.nodes) if (isContainer(node)) {
      const item = this.mounted.get(node.id)!;
      const style = getComputedStyle(item.host); const { x: sx, y: sy } = displayScale(node, parseFloat(style.width), parseFloat(style.height));
      item.host.shadowRoot!.querySelector<HTMLElement>('.container-surface')!.style.transform = `scale(${sx},${sy})`;
      const radius = shapeOf(node.props).radius; item.element.style.borderRadius = `${radius * sx}px / ${radius * sy}px`;
    }
    this.selection(doc.nodes, selected, preview);
  }
  selection(nodes: Placement[], selected: Set<string>, preview: boolean) {
    for (const node of nodes) {
      const item = this.mounted.get(node.id); if (!item) continue;
      const active = selected.has(node.id) && !preview;
      item.element.classList.toggle('selected', active);
      item.element.setAttribute('aria-label', `${registry.get(node.type)!.title}${active ? '，已选中' : ''}${preview ? '，预览' : '，Shift 点击多选，方向键移动'}`);
      const label = item.element.querySelector<HTMLElement>(':scope > .node-label')!;
      label.hidden = !active || item.element.classList.contains('scope-root'); label.textContent = `${node.props.title || registry.get(node.type)!.title} · ${Math.round(item.element.getBoundingClientRect().width / this.zoom)} × ${Math.round(item.element.getBoundingClientRect().height / this.zoom)} px`;
      const parent = nodes.find(other => other.id === node.parentId);
      item.element.querySelector<HTMLElement>(':scope > .resize-handle')!.hidden = !active || selected.size !== 1 || item.element.classList.contains('scope-root') || (!!parent?.layout && parent.layout.mode !== 'free');
    }
  }
  element(id: string) { return this.mounted.get(id)?.element; }
  content(id: string | null) { return id ? this.mounted.get(id)?.host.shadowRoot?.querySelector<HTMLElement>('.container-children') ?? this.canvas : this.canvas; }
}
