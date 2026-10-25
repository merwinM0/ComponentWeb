import { renderContainerSurface } from './container-surface';
import { applyTypography } from '../components/typography';
import { itemStyles } from './item-styles';
import { registry } from '../components/registry';
import { shapeOf } from '../components/shape';
import { colorsOf } from '../components/colors';
import type { Props } from '../components/contract';
import { GRID } from '../core/grid';
import { displayScale } from '../core/design-space';
import { childrenOf } from '../core/tree';
import { isContainer, type Document, type Placement } from '../core/types';
import { workingSize } from '../core/assembly';
import { nativeSurface, fitsNativeSurface, type ElementEdit } from '../core/element-edits';
import { applyTags, restoreTags } from './element-dom';
import { measureNative, scaleNative } from './native-surface';

type Mounted = { type: string; node: Placement; element: HTMLElement; host: HTMLElement; instance: ReturnType<NonNullable<ReturnType<typeof registry.get>>['mount']> };
export class CanvasRenderer {
  mounted = new Map<string, Mounted>();
  private previewMode = false;
  zoom = 1;
  constructor(readonly canvas: HTMLElement, private focus: (id: string) => void) {}
  preview(id: string, props: Props) { const item = this.mounted.get(id); if (item) { restoreTags(item.host); item.instance.update(props); applyTypography(item.host, props.typography); applyTags(item.host, item.node.elements); item.element.style.setProperty('--editing-background', colorsOf(props).background); } }
  tagHost(id: string) { const item = this.mounted.get(id); return item && !isContainer(item.node) ? item.host : undefined; }
  nativeFrame(id: string) {
    const item = this.mounted.get(id)!, style = getComputedStyle(item.host);
    return item.node.surface ?? { baseWidth: parseFloat(style.width), baseHeight: parseFloat(style.height), x: 0, y: 0, width: parseFloat(style.width), height: parseFloat(style.height) };
  }
  checkNative(node: Placement, scope: boolean) {
    const item = this.mounted.get(node.id); if (!item || isContainer(item.node)) return;
    const old = item.node, width = item.element.style.width, height = item.element.style.height;
    try {
      restoreTags(item.host); item.instance.update(node.props); applyTypography(item.host, node.props.typography); applyTags(item.host, node.elements);
      if (scope) { const size = workingSize(node); item.element.style.width = `${size.width}px`; item.element.style.height = `${size.height}px`; }
      scaleNative(item.host, node, scope);
      if (!fitsNativeSurface(measureNative(item.host, node), nativeSurface(node))) throw new Error('标签超出组件边界，请先扩大编辑框，或缩小、移回内部标签');
    } finally {
      restoreTags(item.host); item.instance.update(old.props); applyTypography(item.host, old.props.typography); applyTags(item.host, old.elements); item.element.style.width = width; item.element.style.height = height; scaleNative(item.host, old, scope);
    }
  }
  previewElements(id: string, edits: ElementEdit[]) {
    const item = this.mounted.get(id)!, style = getComputedStyle(item.host);
    const base = item.node.surface ? item.node : { ...item.node, surface: { baseWidth: parseFloat(style.width), baseHeight: parseFloat(style.height), x: 0, y: 0, width: parseFloat(style.width), height: parseFloat(style.height) } };
    restoreTags(item.host); applyTags(item.host, edits); return measureNative(item.host, base);
  }
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
          item = { type: node.type, node, element, host, instance: definition.mount(host, node.props) }; this.mounted.set(node.id, item);
          element.addEventListener('focus', event => { if (event.target === element && !element.dataset.pointerFocus && !this.previewMode) this.focus(node.id); });
        }
        const current = [...target.children].filter(child => child.classList.contains('node'))[index];
        if (current !== item.element) target.insertBefore(item.element, current ?? null);
        Object.assign(item.element.style, itemStyles(node, parent, definition.min), { borderRadius: `${node.skin ? 0 : shapeOf(node.props).radius}px` });
        if (node.id === scopeRootId) { const size = workingSize(node); item.element.style.width = `${size.width}px`; item.element.style.height = `${size.height}px`; }
        item.element.tabIndex = preview ? -1 : 0;
        item.element.dataset.container = String(isContainer(node));
        item.element.classList.toggle('scope-root', node.id === scopeRootId);
        item.element.classList.toggle('svg-backed', !!node.skin);
        item.element.classList.toggle('native-backed', !isContainer(node) && !!node.surface);
        // 编辑框背景独立于原生内容基准；兼容旧偏移数据，不改变标签布局和坐标。
        item.element.style.setProperty('--editing-background', colorsOf(node.props).background);
        item.host.style.removeProperty('--container-background');
        item.host.classList.toggle('container-host', isContainer(node));
        item.host.inert = !preview && !scopeRootId && !isContainer(node);
        item.host.classList.toggle('tag-editable', !!scopeRootId && !isContainer(node));
        item.node = node; restoreTags(item.host); item.instance.update(node.props); applyTypography(item.host, node.props.typography); applyTags(item.host, node.elements);
        if (scopeRootId && !isContainer(node)) item.host.shadowRoot!.querySelectorAll<HTMLElement>('button,input,select,textarea,a,[tabindex]').forEach(control => { control.tabIndex = -1; if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) control.readOnly = true; });
        if (isContainer(node)) {
          const body = renderContainerSurface(item.host, node, doc.nodes);
          body.dataset.empty = String(!preview && !childrenOf(doc.nodes, node.id).length);
          visit(node.id, item.host);
        }
        item.host.shadowRoot!.querySelectorAll<HTMLElement>('.box,.frame,article,.container-children').forEach(region => {
          if (scopeRootId && !isContainer(node)) { region.tabIndex = -1; return; }
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
      const radius = node.skin ? 0 : shapeOf(node.props).radius; item.element.style.borderRadius = `${radius * sx}px / ${radius * sy}px`;
    }
    for (const node of doc.nodes) if (!isContainer(node)) scaleNative(this.mounted.get(node.id)!.host, node, node.id === scopeRootId);
    this.selection(doc.nodes, selected, preview);
  }
  selection(nodes: Placement[], selected: Set<string>, preview: boolean) {
    for (const node of nodes) {
      const item = this.mounted.get(node.id); if (!item) continue;
      const active = selected.has(node.id) && !preview;
      const safeGuide = item.host.shadowRoot?.querySelector<HTMLElement>('.container-safe-area');
      if (safeGuide) safeGuide.hidden = !node.skin || preview || (!active && !item.element.classList.contains('scope-root'));
      item.element.classList.toggle('selected', active);
      item.element.setAttribute('aria-label', `${registry.get(node.type)!.title}${active ? '，已选中' : ''}${preview ? '，预览' : '，Shift 点击多选，方向键移动'}`);
      const label = item.element.querySelector<HTMLElement>(':scope > .node-label')!;
      label.hidden = !active; label.textContent = `${node.props.title || registry.get(node.type)!.title} · ${Math.round(item.element.getBoundingClientRect().width / this.zoom)} × ${Math.round(item.element.getBoundingClientRect().height / this.zoom)} px`;
      const parent = nodes.find(other => other.id === node.parentId);
      item.element.querySelector<HTMLElement>(':scope > .resize-handle')!.hidden = !active || selected.size !== 1 || (!!parent?.layout && parent.layout.mode !== 'free');
    }
  }
  element(id: string) { return this.mounted.get(id)?.element; }
  content(id: string | null) { return id ? this.mounted.get(id)?.host.shadowRoot?.querySelector<HTMLElement>('.container-children') ?? this.canvas : this.canvas; }
}
