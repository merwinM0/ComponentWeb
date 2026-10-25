import type { ComponentDefinition } from './contract';

export const IMPORT_KEY = 'componentweb.imports.v1';
export interface ImportedRecord { id: string; name: string; code: string }

/** Imported markup only runs inside an opaque-origin, script-free frame. */
export function importedDefinition(record: ImportedRecord): ComponentDefinition {
  return {
    type: record.id, title: record.name, category: '导入组件', icon: '</>',
    description: '本地导入的 HTML + CSS（隔离显示，不执行脚本）',
    size: [24, 16], min: [4, 4],
    defaults: { title: record.name, description: '', accent: '#8bd5ff', source: record.code },
    mount(host, props) {
      const root = host.attachShadow({ mode: 'open' });
      const frame = document.createElement('iframe');
      frame.title = record.name;
      frame.setAttribute('sandbox', '');
      frame.referrerPolicy = 'no-referrer';
      frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:white';
      root.append(frame);
      let previous: string | undefined;
      const update = (next: typeof props) => {
        if (previous === next.source) return;
        previous = next.source;
        frame.srcdoc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; form-action 'none'; base-uri 'none';"><style>html,body{margin:0;min-height:100%;font-family:system-ui}*{box-sizing:border-box}</style></head><body>${next.source ?? ''}</body></html>`;
      };
      update(props);
      return { update, destroy: () => root.replaceChildren() };
    },
  };
}

export function readImports(): ImportedRecord[] {
  try {
    const records: unknown = JSON.parse(localStorage.getItem(IMPORT_KEY) ?? '[]');
    if (!Array.isArray(records)) return [];
    return records.filter((r): r is ImportedRecord => r && typeof r.id === 'string' && /^imported\.[\w-]+$/.test(r.id) && typeof r.name === 'string' && r.name.length <= 60 && typeof r.code === 'string' && r.code.length <= 50000).slice(0, 50);
  } catch { return []; }
}

export function validateImport(code: string): string {
  if (!code.trim() || code.length > 50000) throw new Error('请粘贴 HTML + CSS，最多 50,000 字符。');
  const doc = new DOMParser().parseFromString(code, 'text/html');
  if (!doc.querySelector('style') || !doc.body.children.length) throw new Error('格式要求：<style>CSS 样式</style> 后附 HTML 元素。');
  if (doc.querySelector('script, iframe, object, embed, link, meta, base, form, svg, math')) throw new Error('不支持脚本、嵌入页面、外部资源、表单、SVG 或 MathML。');
  for (const element of doc.querySelectorAll('*')) {
    for (const attr of element.attributes) {
      if (/^on/i.test(attr.name) || ['href', 'action', 'formaction', 'srcdoc', 'target', 'src', 'srcset'].includes(attr.name.toLowerCase())) throw new Error('不支持事件属性、跳转或外部资源地址，请使用静态 HTML + CSS。');
    }
  }
  return code.trim();
}
