import { shadowComponent, type ComponentDefinition, type Props } from '../contract';

export interface NativeSpec {
  tag: string;
  title: string;
  category: string;
  html?: string;
  text?: string;
  description?: string;
  size?: [number, number];
  min?: [number, number];
  css?: string;
  sourceLabel?: string;
  render?: (root: ShadowRoot, props: Props) => void;
}

export const nativeCSS = `
  .frame{height:100%;width:100%;overflow:auto;padding:16px;background:var(--surface);border:var(--border-width) var(--border-style) var(--border);border-radius:var(--radius);color:var(--text);font-size:13px;line-height:1.7}
  .frame>:first-child{margin-top:0}.frame>:last-child{margin-bottom:0}
  h1,h2,h3,h4,h5,h6{line-height:1.4;margin:0;font-weight:600;overflow-wrap:anywhere}
  h1{font-size:30px}h2{font-size:26px}h3{font-size:22px}h4{font-size:19px}h5{font-size:16px}h6{font-size:14px}
  p{margin:0}a{color:var(--accent)}blockquote{border-left:var(--border-width) var(--border-style) var(--accent);padding-left:16px;margin:0}
  pre,code,kbd,samp{font-family:monospace;white-space:pre-wrap;overflow-wrap:anywhere}mark{background:var(--accent);color:var(--surface);padding:2px 5px}
  ul,ol,dl{padding-left:22px;margin:0}dt{font-weight:600}dd{margin-left:16px;color:var(--muted)}li+li{margin-top:6px}
  .frame>label,.frame>form{display:flex;flex-direction:column;gap:10px}.frame>label>span{font-size:12px}
  input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),textarea,select{width:100%;min-width:0;border:var(--border-width) var(--border-style) var(--border);background:var(--surface);color:var(--text);padding:9px 10px;border-radius:var(--radius)}
  input::placeholder,textarea::placeholder{color:var(--muted)}input[type=range]{width:100%}textarea{resize:vertical;min-height:64px}
  button{border:var(--border-width) var(--border-style) var(--border);padding:9px 16px;background:var(--surface);color:var(--text);border-radius:var(--radius);cursor:pointer}
  fieldset{border:var(--border-width) var(--border-style) var(--border);border-radius:var(--radius)}legend{padding:0 8px}table{width:100%;border-collapse:collapse;font-size:12px}caption{text-align:left;color:var(--muted);padding-bottom:8px}th,td{padding:8px;border-bottom:var(--border-width) var(--border-style) var(--border);text-align:left}th{color:var(--accent)}
  details{width:100%}summary{cursor:pointer;color:var(--accent)}details p{margin-top:12px}progress,meter{width:100%;height:18px;accent-color:var(--accent)}hr{border:0;border-top:var(--border-width) var(--border-style) var(--border);width:100%}
  .semantic{display:flex;flex-direction:column;justify-content:center;gap:8px}.semantic small{font:10px monospace;color:var(--accent)}.semantic p{color:var(--muted);font-size:12px}
  img,video{display:block;width:100%;height:calc(100% - 28px);min-height:32px;object-fit:cover;border-radius:var(--radius)}audio{width:100%;max-width:100%}figure{height:100%;margin:0}figcaption{font-size:11px;color:var(--muted);padding-top:6px}svg,canvas{max-width:100%}
`;

export function native(spec: NativeSpec): ComponentDefinition {
  return {
    type: `html.${spec.tag}`, title: spec.title, category: spec.category, tags: [spec.tag.split('-')[0]],
    icon: '</>', description: spec.description ?? `原生 <${spec.tag.split('-')[0]}>${spec.tag.startsWith('input-') ? ` type="${spec.tag.slice(6)}"` : ''} 标签`,
    size: spec.size ?? [10, 4], min: spec.min ?? [5, 2], sourceLabel: spec.sourceLabel,
    defaults: { title: spec.text ?? spec.title, description: spec.description ?? '让结构清晰，让内容自然呈现。', accent: '#8bd5ff' },
    mount(host, props) {
      const instance = shadowComponent(host, nativeCSS + (spec.css ?? ''),
        `<div class="frame">${spec.html ?? `<${spec.tag} data-title></${spec.tag}>`}</div>`,
        (root, p) => {
          root.querySelectorAll('[data-title]').forEach(element => { element.textContent = p.title; });
          root.querySelectorAll('[data-description]').forEach(element => { element.textContent = p.description; });
          spec.render?.(root, p);
        }, props);
      const root = host.shadowRoot!;
      const submit = (event: Event) => {
        event.preventDefault();
        host.dispatchEvent(new CustomEvent('component-action', { bubbles: true, composed: true, detail: '表单演示：已提交，不发送网络请求' }));
      };
      root.addEventListener('submit', submit);
      return { update: instance.update, destroy() { root.removeEventListener('submit', submit); instance.destroy(); } };
    },
  };
}

export function safeSource(value = '', media = false): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    return (media ? ['https:', 'http:'] : ['https:', 'http:', 'mailto:', 'tel:']).includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
