import { shadowComponent, type ComponentDefinition } from '../contract';

export const button: ComponentDefinition = {
  type: 'basic.button', title: '操作按钮', category: '基础', icon: '↗',
  description: '明确、有力的行动入口', size: [7, 2], min: [4, 2],
  defaults: { title: '开始探索', description: '操作已触发', accent: '#8bd5ff' },
  mount(host, props) {
    const instance = shadowComponent(host,
      'button{width:100%;height:100%;border:0;border-radius:5px;background:var(--accent);color:#07131c;font:inherit;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:0 18px}button:focus-visible{outline:2px solid white;outline-offset:-5px}',
      '<button type="button"><span></span><b aria-hidden="true">↗</b></button>',
      (root, p) => { root.querySelector('span')!.textContent = p.title; }, props);
    const target = host.shadowRoot!.querySelector('button')!;
    let current = props;
    const click = () => host.dispatchEvent(new CustomEvent('component-action', { bubbles: true, composed: true, detail: current.description }));
    target.addEventListener('click', click);
    return { update(p) { current = p; instance.update(p); }, destroy() { target.removeEventListener('click', click); instance.destroy(); } };
  },
};
