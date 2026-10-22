import { common } from './factory';

export const alert = common({
  name: 'alert', title: '提示消息', icon: 'ⓘ', tags: ['aside', 'p'], size: [17, 5], min: [9, 4],
  html: '<aside class="box row" role="note"><span class="symbol" aria-hidden="true">ⓘ</span><div><h3 data-title></h3><p data-description></p></div></aside>',
  css: '.box{border-left:3px solid var(--accent);flex-wrap:nowrap;align-items:flex-start}.symbol{color:var(--accent);font-size:22px}h3{font-size:14px}p{margin-top:6px}',
  text: '所有改动，自动记录', description: '你的布局会保存在当前浏览器中。',
});

export const accordion = common({
  name: 'accordion', title: '手风琴', icon: '≡', tags: ['details', 'summary'], size: [16, 10], min: [9, 6],
  html: '<section class="box"><details open><summary data-title></summary><p data-description></p></details><details><summary>支持哪些框架？</summary><p>当前支持原生 HTML，后续接入 Vue 和 React。</p></details><details><summary>组件可以独立改色吗？</summary><p>可以分别设置背景、文字、边框和强调色。</p></details></section>',
  css: 'details+details{border-top:1px solid var(--border);margin-top:12px;padding-top:12px}summary{cursor:pointer;color:var(--text)}p{margin:12px 0}details[open] summary{color:var(--accent)}',
});

export const tooltip = common({
  name: 'tooltip', title: '文字提示', icon: '?', tags: ['button', 'span'], size: [12, 5], min: [7, 4],
  html: '<div class="box"><div class="wrap"><button type="button" aria-describedby="tip" data-title></button><span id="tip" role="tooltip" data-description></span></div></div>',
  css: '.box{display:flex;align-items:flex-end;justify-content:center;padding-top:45px}.wrap{position:relative}[role=tooltip]{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:max-content;max-width:220px;padding:6px 10px;border:1px solid var(--border);border-radius:4px;background:var(--surface);font-size:11px;color:var(--text);visibility:hidden}.wrap:hover [role=tooltip],.wrap:focus-within [role=tooltip]{visibility:visible}',
  text: '悬停或聚焦', description: '这里是一条有帮助的说明',
  setup(root, signal) {
    const tip = root.querySelector<HTMLElement>('[role=tooltip]')!;
    root.addEventListener('keydown', event => { if ((event as KeyboardEvent).key === 'Escape') tip.style.visibility = 'hidden'; }, { signal });
    for (const name of ['pointerenter', 'focusin']) root.querySelector('.wrap')!.addEventListener(name, () => tip.style.removeProperty('visibility'), { signal });
  },
});

export const dialog = common({
  name: 'dialog', title: '对话框', icon: '▣', tags: ['dialog', 'button'], size: [12, 4], min: [7, 3],
  html: '<div class="box row"><button type="button" data-open data-title></button><dialog aria-labelledby="dialog-title"><h3 id="dialog-title" data-title></h3><p data-description></p><button type="button" data-close>知道了</button></dialog></div>',
  css: 'dialog{max-width:min(400px,90vw);border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);padding:28px}dialog::backdrop{background:#0009}dialog p{margin:16px 0 24px}',
  text: '打开对话框', description: '在这里暂停片刻，确认下一步操作。',
  setup(root, signal) {
    const modal = root.querySelector('dialog')!;
    root.querySelector('[data-open]')!.addEventListener('click', () => modal.showModal(), { signal });
    root.querySelector('[data-close]')!.addEventListener('click', () => modal.close(), { signal });
  },
});
