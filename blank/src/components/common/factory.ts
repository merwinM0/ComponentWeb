import { shadowComponent, type ComponentDefinition, type Props } from '../contract';

export const commonCSS = `
  .box{height:100%;overflow:auto;border:var(--border-width) var(--border-style) var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text);padding:18px;font-size:13px;line-height:1.6}
  h3,p{margin:0}h3{font-size:16px;font-weight:500}p{color:var(--muted);font-size:12px}button,input,select{font:inherit}
  button{padding:8px 12px;border:var(--border-width) var(--border-style) var(--border);background:var(--surface);color:var(--text);border-radius:var(--radius);cursor:pointer}button:hover{border-color:var(--accent)}button:disabled{opacity:.4;cursor:not-allowed}
  input,select{min-width:0;max-width:100%;padding:9px 12px;border:var(--border-width) var(--border-style) var(--border);background:var(--surface);color:var(--text);border-radius:var(--radius)}
  .row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.stack{display:flex;flex-direction:column;gap:12px}.active{color:var(--accent);border-color:var(--accent)}
  .eyebrow{color:var(--accent);font-size:10px;letter-spacing:2px}.subtle{color:var(--muted);font-size:11px}
`;

interface CommonSpec {
  name: string;
  title: string;
  icon: string;
  tags: string[];
  size: [number, number];
  min?: [number, number];
  html: string;
  css?: string;
  text?: string;
  description?: string;
  render?: (root: ShadowRoot, p: Props) => void;
  setup?: (root: ShadowRoot, signal: AbortSignal) => void;
}

export function common(spec: CommonSpec): ComponentDefinition {
  return {
    type: `ui.${spec.name}`, title: spec.title, category: '常用组件', icon: spec.icon, tags: spec.tags,
    description: spec.description ?? spec.title, size: spec.size, min: spec.min ?? [5, 3],
    defaults: { title: spec.text ?? spec.title, description: spec.description ?? '从细节开始，搭建更清晰的界面。', accent: '#8bd5ff' },
    mount(host, props) {
      const instance = shadowComponent(host, commonCSS + (spec.css ?? ''), spec.html,
        (root, p) => {
          root.querySelectorAll('[data-title]').forEach(element => { element.textContent = p.title; });
          root.querySelectorAll('[data-description]').forEach(element => { element.textContent = p.description; });
          spec.render?.(root, p);
        }, props);
      const controller = new AbortController();
      spec.setup?.(host.shadowRoot!, controller.signal);
      return { update: instance.update, destroy() { controller.abort(); host.shadowRoot!.querySelectorAll('dialog').forEach(dialog => dialog.close()); instance.destroy(); } };
    },
  };
}
