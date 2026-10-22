import { shadowComponent, type ComponentDefinition } from '../contract';

export const metric: ComponentDefinition = {
  type: 'data.metric', title: '数据指标', category: '数据', icon: '◴',
  description: '让关键数字一目了然', size: [9, 5], min: [6, 4],
  defaults: { title: '本月访问量', description: '24,860', accent: '#8be0bd' },
  mount: (host, props) => shadowComponent(host,
    'article{height:100%;overflow:auto;background:#121e2b;border:1px solid #293c4e;border-radius:7px;padding:20px}header{color:#a9b9c9;font-size:12px}strong{display:block;font-size:32px;letter-spacing:-1px;font-weight:500;margin:12px 0;color:#edf6ff}small{font-size:11px;color:var(--accent)}',
    '<article><header></header><strong></strong><small>↗ 12.8%　较上月</small></article>',
    (root, p) => { root.querySelector('header')!.textContent = p.title; root.querySelector('strong')!.textContent = p.description; }, props),
};
