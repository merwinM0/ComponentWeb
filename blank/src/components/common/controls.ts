import { common } from './factory';

export const toggle = common({
  name: 'switch', title: '开关', icon: '◐', tags: ['input', 'label'], size: [12, 4], min: [7, 3],
  html: '<div class="box row"><label class="row"><input type="checkbox" role="switch" checked><span class="track" aria-hidden="true"></span><span data-title></span></label></div>',
  css: 'label{cursor:pointer;position:relative}input{position:absolute;opacity:0;width:38px;height:22px;margin:0}.track{pointer-events:none;width:38px;height:22px;display:block;border-radius:var(--radius);background:var(--border);position:relative}.track:after{content:"";position:absolute;width:14px;height:14px;left:4px;top:4px;border-radius:var(--radius);background:var(--text);transition:transform .15s}input:checked+.track{background:var(--accent)}input:checked+.track:after{transform:translateX(16px);background:var(--surface)}input:focus-visible+.track{outline:2px solid var(--accent);outline-offset:3px}@media(prefers-reduced-motion:reduce){.track:after{transition:none}}',
});

export const checkbox = common({
  name: 'checkbox', title: '复选框组', icon: '☑', tags: ['fieldset', 'input'], size: [12, 7], min: [7, 5],
  html: '<fieldset class="box stack"><legend data-title></legend><label><input type="checkbox" checked> 设计系统</label><label><input type="checkbox"> 交互原型</label><label><input type="checkbox"> 开发交付</label></fieldset>',
});

export const radio = common({
  name: 'radio', title: '单选框组', icon: '◉', tags: ['fieldset', 'input'], size: [12, 7], min: [7, 5],
  html: '<fieldset class="box stack"><legend data-title></legend><label><input type="radio" name="framework" checked> 原生 HTML</label><label><input type="radio" name="framework"> Vue</label><label><input type="radio" name="framework"> React</label></fieldset>',
});

export const select = common({
  name: 'select', title: '选择器', icon: '⌄', tags: ['select', 'option'], size: [12, 5], min: [7, 4],
  html: '<label class="box stack"><span data-title></span><select><option>原生 HTML + TypeScript</option><option>Vue</option><option>React</option></select></label>',
});

export const search = common({
  name: 'search', title: '搜索栏', icon: '⌕', tags: ['form', 'input', 'button'], size: [18, 4], min: [11, 4],
  html: '<form class="box row" role="search"><label for="query" class="sr-only" data-title></label><input id="query" type="search" placeholder="搜索你的灵感…" required><button type="submit">搜索 ↗</button><output aria-live="polite"></output></form>',
  css: 'input{flex:1;width:80px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}output{font-size:11px;color:var(--accent)}',
  setup(root, signal) { root.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); root.querySelector('output')!.textContent = `搜索：${root.querySelector('input')!.value}`; }, { signal }); },
});
