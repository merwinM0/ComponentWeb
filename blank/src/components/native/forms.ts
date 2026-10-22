import { native } from './factory';

export const formElements = [
  native({ tag: 'input', title: '原生输入框', category: '原生表单', html: '<label><span data-title></span><input type="text"></label>', size: [12, 4],
    render(root, p) { root.querySelector('input')!.placeholder = p.description; } }),
  ...[
    ['number', '数字输入'], ['password', '密码输入'], ['email', '邮箱输入'],
    ['search', '搜索输入'], ['date', '日期选择'], ['datetime-local', '日期时间'],
    ['time', '时间选择'], ['month', '月份选择'], ['week', '周选择'],
    ['url', '网址输入'], ['tel', '电话输入'], ['file', '文件选择'], ['color', '颜色输入'],
    ['range', '范围滑块'], ['checkbox', '原生复选框'], ['radio', '原生单选框'],
  ].map(([type, title]) => native({ tag: `input-${type}`, title, category: '原生表单', size: [12, 4], min: [6, 3],
    html: `<label><span data-title></span><input type="${type}" aria-label="${title}"></label>`,
    render(root, p) { root.querySelector('input')!.placeholder = p.description; },
  })),
  native({ tag: 'textarea', title: '多行文本', category: '原生表单', size: [12, 7], min: [6, 4],
    html: '<label><span data-title></span><textarea rows="3"></textarea></label>', render(root, p) { root.querySelector('textarea')!.placeholder = p.description; } }),
  native({ tag: 'select', title: '下拉选择', category: '原生表单', size: [12, 4], html: '<label><span data-title></span><select><option data-description></option><option>设计系统</option><option>产品界面</option></select></label>' }),
  native({ tag: 'option', title: '下拉选项', category: '原生表单', html: '<label><span>选择一个选项</span><select><option data-title></option><option data-description></option></select></label>', size: [12, 4] }),
  native({ tag: 'optgroup', title: '选项分组', category: '原生表单', html: '<label><span data-title></span><select><optgroup label="设计"><option>组件库</option><option>工作台</option></optgroup><optgroup label="研发"><option>原生 HTML</option></optgroup></select></label>', size: [12, 4] }),
  native({ tag: 'datalist', title: '输入建议', category: '原生表单', html: '<label><span data-title></span><input list="suggestions" placeholder="输入或选择框架"><datalist id="suggestions"><option value="HTML"><option value="Vue"><option value="React"></datalist></label>', size: [12, 4] }),
  native({ tag: 'label', title: '表单标签', category: '原生表单', html: '<label><span data-title></span><input placeholder="点击标签即可聚焦输入框"></label>', size: [12, 4] }),
  native({ tag: 'button', title: '原生按钮', category: '原生表单', html: '<button type="button" data-title></button>', size: [8, 3] }),
  native({ tag: 'form', title: '表单', category: '原生表单', size: [14, 9], min: [8, 7],
    html: '<form><strong data-title></strong><label>姓名 <input autocomplete="name" required placeholder="你的名字"></label><label>邮箱 <input type="email" autocomplete="email" required placeholder="hello@example.com"></label><button type="submit">提交表单</button></form>' }),
  native({ tag: 'fieldset', title: '表单分组', category: '原生表单', size: [12, 6], min: [7, 4], html: '<fieldset><legend data-title></legend><label><input type="checkbox"> 邮件通知</label><br><label><input type="checkbox" checked> 站内通知</label></fieldset>' }),
  native({ tag: 'legend', title: '分组标题', category: '原生表单', size: [12, 5], html: '<fieldset><legend data-title></legend><p data-description></p></fieldset>' }),
  native({ tag: 'output', title: '计算输出', category: '原生表单', html: '<label><span data-title></span><output>128</output></label>', css: 'output{color:var(--accent);font:32px monospace}' }),
];
