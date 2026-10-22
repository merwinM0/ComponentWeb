import { shadowComponent, type ComponentDefinition } from '../contract';

export const input: ComponentDefinition = {
  type: 'basic.input', title: '文本输入', category: '基础', icon: '⌨',
  description: '带标签的轻量输入控件', size: [12, 4], min: [7, 4],
  defaults: { title: '项目名称', description: '给你的下一个想法命名', accent: '#8bd5ff' },
  mount: (host, props) => shadowComponent(host,
    'label{height:100%;display:flex;flex-direction:column;gap:12px;justify-content:center;padding:12px 0;color:#c0d0df;font-size:12px}input{width:100%;min-height:40px;background:#101c29;border:1px solid #34495c;border-radius:5px;color:#e4f1ff;font:inherit;padding:10px 12px}input::placeholder{color:#899fb2}input:focus{outline:2px solid var(--accent);outline-offset:2px}',
    '<label><span></span><input type="text"></label>',
    (root, p) => { root.querySelector('span')!.textContent = p.title; root.querySelector('input')!.placeholder = p.description; }, props),
};
