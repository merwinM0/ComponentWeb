import { common } from './factory';

export const tabs = common({
  name: 'tabs', title: '标签页', icon: '▱', tags: ['button', 'section'], size: [17, 8], min: [10, 5],
  html: '<section class="box"><div role="tablist" aria-label="内容分类"><button id="tab-0" role="tab" aria-selected="true" aria-controls="panel-0" data-title></button><button id="tab-1" role="tab" aria-selected="false" aria-controls="panel-1" tabindex="-1">设计规范</button><button id="tab-2" role="tab" aria-selected="false" aria-controls="panel-2" tabindex="-1">更新记录</button></div><div id="panel-0" role="tabpanel" aria-labelledby="tab-0" tabindex="0"><h3>组件概览</h3><p data-description></p></div><div id="panel-1" role="tabpanel" aria-labelledby="tab-1" tabindex="0" hidden><h3>一致的设计语言</h3><p>统一间距、色彩与交互，让每个组件自然协作。</p></div><div id="panel-2" role="tabpanel" aria-labelledby="tab-2" tabindex="0" hidden><h3>持续打磨</h3><p>新增组件目录与完整的色彩编辑能力。</p></div></section>',
  css: '[role=tablist]{display:flex;gap:6px;border-bottom:1px solid var(--border);padding-bottom:12px;overflow:auto}[aria-selected=true]{color:var(--accent);border-color:var(--accent)}[role=tabpanel]{padding-top:20px}[role=tabpanel] p{margin-top:12px}[hidden]{display:none}',
  setup(root, signal) {
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    function activate(index: number, focus = false) {
      buttons.forEach((button, i) => { button.setAttribute('aria-selected', String(index === i)); button.tabIndex = index === i ? 0 : -1; root.getElementById(`panel-${i}`)!.hidden = i !== index; });
      if (focus) buttons[index].focus();
    }
    buttons.forEach((button, i) => {
      button.addEventListener('click', () => activate(i), { signal });
      button.addEventListener('keydown', event => {
        const index = event.key === 'ArrowRight' ? (i + 1) % 3 : event.key === 'ArrowLeft' ? (i + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
        if (index >= 0) { event.preventDefault(); activate(index, true); }
      }, { signal });
    });
  },
});
