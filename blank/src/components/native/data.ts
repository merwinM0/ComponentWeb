import { native } from './factory';

const rows = '<thead><tr><th scope="col">组件</th><th scope="col">状态</th></tr></thead><tbody><tr><td>导航栏</td><td>已就绪</td></tr><tr><td>数据卡片</td><td>开发中</td></tr></tbody>';
export const dataElements = [
  ...['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'].map(tag => native({
    tag, title: ({ table: '表格', thead: '表头区域', tbody: '表格主体', tfoot: '表格页脚', tr: '表格行', th: '表头单元格', td: '数据单元格', caption: '表格标题', colgroup: '表格列组', col: '表格列' } as Record<string, string>)[tag],
    category: '原生数据', size: [14, 8], min: [8, 5],
    description: '表格子标签使用合法表格结构承载，不作为无父级的孤立标签。',
    html: `<table><caption data-title></caption>${['colgroup', 'col'].includes(tag) ? '<colgroup><col><col></colgroup>' : ''}${rows}${tag === 'tfoot' ? '<tfoot><tr><td colspan="2">共 2 个组件</td></tr></tfoot>' : ''}</table>`,
  })),
  native({ tag: 'progress', title: '进度条', category: '原生数据', size: [12, 4], html: '<label><span data-title></span><progress value="68" max="100">68%</progress></label>', render(root, p) { root.querySelector('progress')!.setAttribute('aria-label', p.title); } }),
  native({ tag: 'meter', title: '度量仪', category: '原生数据', size: [12, 4], html: '<label><span data-title></span><meter min="0" max="100" low="25" high="80" optimum="60" value="60">60%</meter></label>', render(root, p) { root.querySelector('meter')!.setAttribute('aria-label', p.title); } }),
];
