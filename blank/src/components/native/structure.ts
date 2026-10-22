import { native } from './factory';

const structures = [
  ['div', '通用容器'], ['section', '内容分区'], ['article', '独立文章'],
  ['header', '页眉'], ['footer', '页脚'], ['main', '主内容区'],
  ['aside', '侧边内容'], ['nav', '导航区域'], ['search', '搜索区域'],
] as const;

export const structureElements = [
  ...structures.map(([tag, title]) => native({ tag, title, category: '结构布局', size: [12, 6], min: [5, 3],
    html: `<${tag} class="semantic"><small>&lt;${tag}&gt;</small><strong data-title></strong><p data-description></p></${tag}>`,
    css: '.semantic{height:100%}', description: '独立语义区域；当前为单层布局，不支持嵌套拖入。',
  })),
  native({ tag: 'hgroup', title: '标题组', category: '结构布局', size: [14, 5], html: '<hgroup><h2 data-title></h2><p data-description></p></hgroup>' }),
  native({ tag: 'menu', title: '操作菜单', category: '结构布局', size: [12, 5], html: '<menu><li><button type="button" data-title></button></li><li><button type="button">查看详情</button></li></menu>', css: 'menu{display:flex;list-style:none;margin:0;padding:0;gap:8px;flex-wrap:wrap}' }),
  native({ tag: 'dialog', title: '原生对话区域', category: '结构布局', size: [14, 7], min: [8, 5], html: '<dialog open aria-labelledby="native-dialog-title"><h3 id="native-dialog-title" data-title></h3><p data-description></p></dialog>', css: 'dialog{position:relative;inset:auto;width:100%;margin:0;border:var(--border-width) var(--border-style) var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text);padding:16px}dialog p{margin-top:12px}' }),
  native({ tag: 'ul', title: '无序列表', category: '结构布局', size: [10, 6], html: '<ul><li data-title></li><li data-description></li><li>把灵感整理成清晰的界面</li></ul>' }),
  native({ tag: 'ol', title: '有序列表', category: '结构布局', size: [10, 6], html: '<ol><li data-title></li><li data-description></li><li>预览并完善你的设计</li></ol>' }),
  native({ tag: 'li', title: '列表项', category: '结构布局', html: '<ul><li data-title></li></ul>' }),
  native({ tag: 'dl', title: '描述列表', category: '结构布局', size: [12, 5], html: '<dl><dt data-title></dt><dd data-description></dd></dl>' }),
  native({ tag: 'dt', title: '术语标题', category: '结构布局', html: '<dl><dt data-title></dt><dd data-description></dd></dl>' }),
  native({ tag: 'dd', title: '术语说明', category: '结构布局', html: '<dl><dt data-title></dt><dd data-description></dd></dl>' }),
  native({ tag: 'details', title: '详情折叠', category: '结构布局', size: [14, 6], html: '<details open><summary data-title></summary><p data-description></p></details>' }),
  native({ tag: 'summary', title: '折叠摘要', category: '结构布局', size: [12, 5], html: '<details><summary data-title></summary><p data-description></p></details>' }),
];
