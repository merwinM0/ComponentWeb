import { shadowComponent, type ComponentDefinition } from '../contract';

export const card: ComponentDefinition = {
  type: 'content.card', title: '内容卡片', category: '内容', icon: '▤',
  description: '承载标题与一段好内容', size: [12, 8], min: [7, 5],
  defaults: { title: '让想法，有处安放。', description: '从一块网格开始，把零散的灵感组织成清晰的界面。', accent: '#8bd5ff' },
  mount: (host, props) => shadowComponent(host,
    'article{height:100%;overflow:auto;background:#121e2b;border:1px solid #293c4e;border-radius:7px;padding:24px;display:flex;flex-direction:column;align-items:flex-start}.tag{color:var(--accent);font-size:10px;letter-spacing:2px}h3{font-size:22px;font-weight:500;color:#edf6ff;line-height:1.4;margin:18px 0 10px}p{font-size:12px;line-height:1.8;color:#a9b9c9;margin:0}footer{margin-top:auto;padding-top:16px;color:var(--accent);font-size:12px}',
    '<article><span class="tag">DESIGN NOTES / 01</span><h3></h3><p></p><footer>探索更多 ↗</footer></article>',
    (root, p) => { root.querySelector('h3')!.textContent = p.title; root.querySelector('p')!.textContent = p.description; }, props),
};
