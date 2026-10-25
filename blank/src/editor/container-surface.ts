import { skinSvg } from '../components/container/skins';
import { containerGeometry } from '../core/container-geometry';
import { GRID } from '../core/grid';
import type { Placement } from '../core/types';
import { registry } from '../components/registry';
import { childrenOf } from '../core/tree';

export function renderContainerSurface(host: HTMLElement, node: Placement, nodes: Placement[]) {
  const { size, safe, content, border, skin } = containerGeometry(node);
  const root = host.shadowRoot!;
  const surface = root.querySelector<HTMLElement>('.container-surface')!;
  const background = root.querySelector<HTMLElement>('.container-background')!;
  surface.classList.toggle('has-skin', !!skin);
  Object.assign(surface.style, { width: `${size.width}px`, height: `${size.height}px`, transformOrigin: '0 0' });
  const stroke = node.props.borderStyle === 'none' ? 0 : node.props.borderWidth ?? 1;
  const signature = `${node.skin ?? ''}:${size.width}:${size.height}:${stroke}`;
  if (background.dataset.signature !== signature) {
    background.innerHTML = skin ? skinSvg(skin.id, size.width, size.height, stroke) : '';
    background.dataset.signature = signature;
  }
  host.style.setProperty('--skin-stroke', String(stroke));
  host.style.setProperty('--skin-dash', node.props.borderStyle === 'dashed' ? '6 4' : node.props.borderStyle === 'dotted' ? '1 3' : 'none');
  host.style.setProperty('--layout-padding', `${node.layout!.padding}px`);
  host.style.setProperty('--layout-gap', `${node.layout!.gap}px`);
  // Absolute children use the padding edge as containing block: subtract the real CSS border once.
  const physicalBorder = skin ? 0 : border;
  const body = root.querySelector<HTMLElement>('.container-children')!;
  Object.assign(body.style, { left: `${content.x - physicalBorder}px`, top: `${content.y - physicalBorder}px`, width: `${content.width}px`, height: `${content.height}px` });
  const guide = root.querySelector<HTMLElement>('.container-safe-area')!;
  Object.assign(guide.style, { left: `${safe.x - physicalBorder}px`, top: `${safe.y - physicalBorder}px`, width: `${safe.width}px`, height: `${safe.height}px` });
  const layout = node.layout!;
  const minTrack = Math.max(0, ...childrenOf(nodes, node.id).map(child => {
    const span = Math.min(child.constraints?.columnSpan ?? 1, layout.columns);
    return Math.max(0, (registry.get(child.type)!.min[0] * GRID.cell - layout.gap * (span - 1)) / span);
  }));
  Object.assign(body.style, { display: layout.mode === 'free' ? 'block' : layout.mode, flexDirection: layout.direction,
    flexWrap: layout.wrap ? 'wrap' : 'nowrap', alignItems: layout.align, justifyContent: layout.justify,
    gridTemplateColumns: `repeat(${layout.columns}, minmax(${minTrack}px,1fr))`, gridAutoRows: 'minmax(min-content,1fr)' });
  return body;
}
