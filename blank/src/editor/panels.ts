import { components, registry } from '../components/registry';
import { GRID } from '../core/model';
import { $, Editor } from './editor';

const previews: Record<string, string> = {
  'content.card': '<div class="mini-card"><div class="mini-line short"></div><div class="mini-line"></div><div class="mini-line"></div></div>',
  'data.metric': '<div class="mini-number">24,860<small>↗ 12.8%　较上月</small></div>',
  'basic.button': '<div class="mini-button">开始探索　↗</div>',
  'basic.input': '<div class="mini-input">给你的想法命名…</div>',
};

export function setupPanels(editor: Editor) {
  let category = '全部';
  function renderLibrary() {
    const query = $<HTMLInputElement>('search').value.trim().toLowerCase();
    const container = $('component-list');
    container.replaceChildren();
    for (const definition of components) {
      if (category !== '全部' && category !== definition.category) continue;
      if (!`${definition.title}${definition.description}${definition.type}`.toLowerCase().includes(query)) continue;
      const tile = document.createElement('article');
      tile.className = 'component-tile';
      tile.dataset.type = definition.type;
      // 仅使用本地受信任组件定义生成展示模板。
      tile.innerHTML = `<div class="tile-preview" aria-hidden="true">${previews[definition.type]}</div><div class="tile-info"><div><strong>${definition.title}</strong><small>${definition.size[0]} × ${definition.size[1]} 格 · ${definition.category}</small></div><button type="button" aria-label="添加${definition.title}">＋ 添加</button></div>`;
      tile.querySelector('button')!.disabled = editor.preview;
      tile.querySelector('button')!.addEventListener('click', () => editor.add(definition.type));
      container.append(tile);
    }
    if (!container.childElementCount) {
      const empty = document.createElement('p');
      empty.className = 'empty-list';
      empty.textContent = '没有找到组件，试试其他关键词。';
      container.append(empty);
    }
  }
  $('search').addEventListener('input', renderLibrary);
  document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button => {
    button.addEventListener('click', () => {
      category = button.dataset.category!;
      document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(item => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      renderLibrary();
    });
  });

  function renderInspector() {
    const container = $('inspector-content');
    const node = editor.node;
    const focused = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const restoreId = focused && container.contains(focused) ? focused.id : '';
    const selection = focused instanceof HTMLTextAreaElement || (focused instanceof HTMLInputElement && focused.type === 'text')
      ? [focused.selectionStart, focused.selectionEnd] : null;
    if (!node) {
      container.innerHTML = '<div class="no-selection"><span aria-hidden="true">⌖</span><h2>每一格，都有可能</h2><p>选择画布中的组件<br>在这里调整布局与细节</p></div>';
      return;
    }
    const definition = registry.get(node.type)!;
    container.innerHTML = `
      <div class="inspector-identity"><span class="identity-icon" aria-hidden="true">${definition.icon}</span><div><strong>${definition.title}</strong><small></small></div></div>
      <form id="properties">
        <div class="section-title">布局 <span>LAYOUT</span></div>
        <div class="field-grid">
          <label class="field">列位置 X<input id="prop-col" name="col" type="number" min="0" max="${GRID.cols - node.colSpan}" step="1" required></label>
          <label class="field">行位置 Y<input id="prop-row" name="row" type="number" min="0" max="${GRID.rows - node.rowSpan}" step="1" required></label>
          <label class="field">宽度 W<input id="prop-colSpan" name="colSpan" type="number" min="${definition.min[0]}" max="${GRID.cols - node.col}" step="1" required></label>
          <label class="field">高度 H<input id="prop-rowSpan" name="rowSpan" type="number" min="${definition.min[1]}" max="${GRID.rows - node.row}" step="1" required></label>
        </div>
        <p class="inspector-help">单位为网格 · 每格 24 px<br>最小尺寸 ${definition.min[0]} × ${definition.min[1]} 格</p>
        <div class="section-title">组件内容 <span>CONTENT</span></div>
        <label class="field full">标题<input id="prop-title" name="title" type="text" maxlength="120"></label>
        <label class="field full">${node.type === 'data.metric' ? '指标数值' : '说明文字'}<textarea id="prop-description" name="description" maxlength="1000"></textarea></label>
        <div class="section-title">外观 <span>APPEARANCE</span></div>
        <label class="field">强调色<span class="color-field"><input id="prop-accent" name="accent" type="color"><code id="color-code"></code></span></label>
        <div class="inspector-actions"><button id="duplicate" type="button">⧉ 复制</button><button id="delete" type="button" class="danger">⌫ 删除</button></div>
      </form>`;
    container.querySelector('.inspector-identity small')!.textContent = `ID / ${node.id.slice(0, 8)}`;
    const form = $<HTMLFormElement>('properties');
    for (const key of ['col', 'row', 'colSpan', 'rowSpan'] as const) $<HTMLInputElement>(`prop-${key}`).value = String(node[key]);
    for (const key of ['title', 'description', 'accent'] as const) $<HTMLInputElement>(`prop-${key}`).value = node.props[key];
    $('color-code').textContent = node.props.accent.toUpperCase();
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>('input, textarea, button').forEach(control => { control.disabled = editor.preview; });
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('change', () => {
      if (!form.reportValidity()) { renderInspector(); return; }
      const data = new FormData(form);
      const updated = { ...node, props: { ...node.props } };
      for (const key of ['col', 'row', 'colSpan', 'rowSpan'] as const) updated[key] = Number(data.get(key));
      for (const key of ['title', 'description', 'accent'] as const) updated.props[key] = String(data.get(key));
      if (!editor.update(updated)) renderInspector();
    });
    $('duplicate').addEventListener('click', () => editor.duplicate());
    $('delete').addEventListener('click', () => editor.remove());
    if (restoreId) {
      const control = document.getElementById(restoreId) as HTMLInputElement | HTMLTextAreaElement | null;
      control?.focus({ preventScroll: true });
      if (selection && selection[0] !== null) control?.setSelectionRange(selection[0], selection[1]);
    }
  }
  editor.onSelection = renderInspector;
  renderLibrary();
  renderInspector();
  return { refresh: () => { renderLibrary(); renderInspector(); } };
}
