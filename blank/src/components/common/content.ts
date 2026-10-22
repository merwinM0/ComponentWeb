import { common } from './factory';

export const badge = common({
  name: 'badge', title: '标签徽章', icon: '◇', tags: ['span'], size: [10, 3], min: [5, 2],
  html: '<div class="box row"><span class="badge" data-title></span><span class="subtle">NEW</span></div>',
  css: '.box{padding:12px}.badge{border:1px solid var(--accent);color:var(--accent);border-radius:4px;padding:3px 9px;font-size:12px}',
});

export const avatar = common({
  name: 'avatar', title: '头像名片', icon: '◎', tags: ['div', 'span'], size: [13, 5], min: [8, 4],
  html: '<div class="box row"><span class="avatar" aria-hidden="true">CW</span><div><h3 data-title></h3><p data-description></p></div></div>',
  css: '.row{flex-wrap:nowrap}.avatar{flex-shrink:0;display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:color-mix(in srgb,var(--accent) 18%,var(--surface));color:var(--accent);border:1px solid var(--border);font:16px monospace}',
  text: '设计伙伴', description: '一起把想法变成界面',
});

export const list = common({
  name: 'list', title: '信息列表', icon: '≡', tags: ['ul', 'li'], size: [14, 9], min: [8, 6],
  html: '<section class="box"><h3 data-title></h3><ul><li><span>01</span><div><strong>组件规范</strong><p data-description></p></div><b>↗</b></li><li><span>02</span><div><strong>交互细节</strong><p>让每次操作都有明确回应</p></div><b>↗</b></li><li><span>03</span><div><strong>开发交付</strong><p>从布局到实现，一步更近</p></div><b>↗</b></li></ul></section>',
  css: 'ul{padding:0;margin:12px 0 0;list-style:none}li{display:flex;gap:12px;align-items:center;border-top:1px solid var(--border);padding:12px 0}li>span{color:var(--accent);font:11px monospace}li strong{font-size:12px;font-weight:500}li b{margin-left:auto;font-weight:400;color:var(--accent)}',
});

export const table = common({
  name: 'table', title: '数据表格', icon: '▦', tags: ['table', 'thead', 'tbody'], size: [21, 10], min: [13, 7],
  html: '<div class="box"><table><caption data-title></caption><thead><tr><th scope="col">项目名称</th><th scope="col">负责人</th><th scope="col">状态</th></tr></thead><tbody><tr><td>组件工作台</td><td>设计团队</td><td><span>进行中</span></td></tr><tr><td>产品官网</td><td>产品团队</td><td>已完成</td></tr><tr><td>数据看板</td><td>研发团队</td><td>待启动</td></tr></tbody></table></div>',
  css: 'table{width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap}caption{text-align:left;font-size:16px;padding-bottom:20px}th,td{padding:12px 8px;text-align:left;border-bottom:1px solid var(--border)}th{font-weight:400;color:var(--muted)}td span{color:var(--accent)}',
});

export const progress = common({
  name: 'progress', title: '进度卡片', icon: '◴', tags: ['progress', 'label'], size: [14, 5], min: [8, 4],
  html: '<label class="box stack"><span class="row"><strong data-title></strong><span class="percent">68%</span></span><progress max="100" value="68">68%</progress><span class="subtle" data-description></span></label>',
  css: '.percent{margin-left:auto;color:var(--accent)}progress{width:100%;height:8px;border:0;border-radius:4px;overflow:hidden}progress::-webkit-progress-bar{background:var(--border)}progress::-webkit-progress-value{background:var(--accent)}progress::-moz-progress-bar{background:var(--accent)}',
});

export const skeleton = common({
  name: 'skeleton', title: '骨架占位', icon: '▤', tags: ['div'], size: [13, 7], min: [7, 4],
  html: '<div class="box stack" role="status"><span class="subtle" data-title></span><div class="line short"></div><div class="line"></div><div class="line"></div><div class="line mid"></div></div>',
  css: '.line{height:10px;border-radius:3px;background:color-mix(in srgb,var(--accent) 18%,var(--surface))}.short{width:40%;height:18px}.mid{width:70%}', text: '正在加载内容…',
});
