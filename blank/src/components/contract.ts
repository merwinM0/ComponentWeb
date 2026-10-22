import { colorsOf, contrastRatio } from './colors';
import { shapeOf, type ShapeSettings } from './shape';

export interface Props extends Partial<ShapeSettings> {
  title: string;
  description: string;
  accent: string;
  background?: string;
  text?: string;
  border?: string;
  source?: string;
}

export interface ComponentDefinition {
  type: string;
  title: string;
  category: string;
  icon: string;
  tags?: string[];
  sourceLabel?: string;
  contentLabel?: string;
  description: string;
  size: [number, number];
  min: [number, number];
  defaults: Props;
  mount(host: HTMLElement, props: Props): {
    update(props: Props): void;
    destroy(): void;
  };
}

/** 模板仅允许开发者静态内容；用户文本通过 textContent 写入。 */
export function shadowComponent(host: HTMLElement, css: string, html: string, render: (root: ShadowRoot, props: Props) => void, props: Props) {
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>:host{display:block;width:100%;height:100%;font-family:inherit;box-sizing:border-box;color:var(--text);--muted:color-mix(in srgb,var(--text) 72%,var(--surface));color-scheme:dark}*{box-sizing:border-box}button,input,textarea,select{font:inherit;accent-color:var(--accent)}:focus-visible{outline:2px solid var(--accent);outline-offset:2px}${css}</style>${html}`;
  const update = (next: Props) => {
    const colors = colorsOf(next);
    host.style.setProperty('--accent', colors.accent);
    host.style.setProperty('--surface', colors.background);
    host.style.setProperty('--text', colors.text);
    host.style.setProperty('--border', colors.border);
    const shape = shapeOf(next);
    host.style.setProperty('--radius', `${shape.radius}px`);
    host.style.setProperty('--border-width', `${shape.borderWidth}px`);
    host.style.setProperty('--border-style', shape.borderStyle);
    host.style.colorScheme = contrastRatio('#000000', colors.background) > contrastRatio('#ffffff', colors.background) ? 'light' : 'dark';
    render(root, next);
  };
  update(props);
  return { update, destroy: () => root.replaceChildren() };
}
