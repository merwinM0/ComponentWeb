import { shadowComponent, type ComponentDefinition } from '../contract';

export const container: ComponentDefinition = {
  type: 'layout.container', title: '布局容器', category: '布局容器', icon: '⊞', tags: ['section', 'slot'],
  description: '可嵌套自由 / Flex / Grid 容器，可选择纸张、票券、气泡 SVG 背景。', size: [24, 16], min: [1, 1],
  defaults: { title: '布局容器', description: '', accent: '#8bd5ff' },
  mount: (host, props) => shadowComponent(host,
    `.container-surface{position:absolute;left:0;top:0;width:100%;height:100%;box-sizing:border-box;background:var(--container-background,var(--surface));color:var(--text);border:var(--border-width) var(--border-style) var(--border);border-radius:var(--radius);padding:var(--layout-padding,12px);overflow:hidden}
    .container-surface.has-skin{background:transparent;border:0;border-radius:0;padding:0}
    .container-background{position:absolute;inset:0;pointer-events:none}.skin-svg{display:block;width:100%;height:100%}
    .container-children{width:100%;height:100%;position:absolute;overflow:auto;box-sizing:border-box;gap:var(--layout-gap,12px);align-content:start}
    .container-safe-area{position:absolute;outline:1px dashed #28729c;outline-offset:-1px;pointer-events:none;z-index:1}
    .container-safe-area::before{content:"内容安全区";position:absolute;left:0;top:0;font:10px system-ui;background:#e8f5ff;color:#174e71;padding:2px 4px;transform:translateY(-100%)}
    slot{display:contents}.container-children[data-empty=true]::before{content:"拖入组件 · 可嵌套布局";position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);font-size:12px;pointer-events:none}`,
    '<section class="container-surface" aria-label="布局容器"><div class="container-background" aria-hidden="true"></div><div class="container-safe-area" hidden aria-hidden="true"></div><div class="container-children"><slot></slot></div></section>',
    (root, p) => root.querySelector('section')!.setAttribute('aria-label', p.title || '布局容器'), props),
};
