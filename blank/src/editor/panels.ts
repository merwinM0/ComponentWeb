import { components } from '../components/registry';
import { $, Editor } from './editor';
import { setupInspector } from './inspector';
import { GRID } from '../core/grid';
import { isContainer } from '../core/types';
import type { Combinations } from '../core/combinations';
import { combinationTiles } from './combination-tiles';

const previews: Record<string, string> = {
  'content.card': '<div class="mini-card"><div class="mini-line short"></div><div class="mini-line"></div><div class="mini-line"></div></div>',
  'data.metric': '<div class="mini-number">24,860<small>↗ 12.8%　较上月</small></div>',
  'basic.button': '<div class="mini-button">开始探索　↗</div>',
  'basic.input': '<div class="mini-input">给你的想法命名…</div>',
  'ui.tabs': '<div class="mini-tabs"><b>概览</b><span>规范</span><span>更新</span></div>',
  'ui.switch': '<span class="mini-switch"></span>',
  'ui.table': '<div class="mini-table">名称　　状态<br>组件库　 进行中<br>工作台　 已就绪</div>',
  'ui.progress': '<div class="mini-progress"><span></span></div>',
  'ui.badge': '<span class="mini-badge">设计中</span><span class="mini-badge">NEW</span>',
  'ui.navbar': '<div class="mini-tabs"><b>LOGO</b><span>概览</span><span>文档</span></div>',
};

export function setupPanels(editor: Editor, combinations: Combinations, dialogs: { rename(id: string): void; remove(id: string): void }) {
  let kind = '全部';
  const categories = $<HTMLSelectElement>('category-filter');
  const renderInspector = setupInspector(editor);
  $('library-count').textContent = String(components.length);
  function updateCategories() {
    categories.replaceChildren(new Option('所有分类', '全部'));
    categories.disabled = kind === '我的组合';
    if (kind === '我的组合') return;
    const filtered = components.filter(definition => kind === '全部' || (kind === 'HTML 标签') === definition.type.startsWith('html.'));
    for (const category of new Set(filtered.map(definition => definition.category))) categories.append(new Option(category, category));
  }
  function renderLibrary() {
    const query = $<HTMLInputElement>('search').value.trim().toLowerCase();
    const container = $('component-list');
    container.replaceChildren();
    $('library-count').textContent = String(components.length + combinations.items.length);
    if (kind === '我的组合') { const count = combinationTiles(container, editor, combinations, query, dialogs); $('library-results').textContent = `${count} 个本地组合 · 拖入或点击添加`; return; }
    let count = 0;
    for (const definition of components) {
      if (kind !== '全部' && (kind === 'HTML 标签') !== definition.type.startsWith('html.')) continue;
      if (categories.value !== '全部' && categories.value !== definition.category) continue;
      if (!`${definition.title}${definition.description}${definition.type}${definition.tags?.join(' ') ?? ''}`.toLowerCase().includes(query)) continue;
      count++;
      const tile = document.createElement('article');
      tile.className = `component-tile${definition.type.startsWith('html.') ? ' native-tile' : ''}`;
      tile.dataset.type = definition.type;
      tile.title = definition.description;
      const preview = document.createElement('div');
      preview.className = 'tile-preview';
      preview.setAttribute('aria-hidden', 'true');
      if (previews[definition.type]) preview.innerHTML = previews[definition.type];
      else if (definition.type.startsWith('html.')) {
        const code = document.createElement('code');
        code.className = 'native-preview-tag';
        code.textContent = `<${definition.tags![0]}>`;
        preview.append(code);
      } else {
        const icon = document.createElement('span');
        icon.className = 'preview-icon'; icon.textContent = definition.icon;
        const caption = document.createElement('span');
        caption.className = 'preview-caption'; caption.textContent = definition.title;
        preview.append(icon, caption);
      }
      const info = document.createElement('div'); info.className = 'tile-info';
      const text = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = definition.title;
      const hint = document.createElement('small');
      hint.textContent = `${definition.size[0] * GRID.cell} × ${definition.size[1] * GRID.cell} px · ${definition.tags?.map(tag => `<${tag}>`).join(' ') ?? definition.category}`;
      text.append(title, hint);
      const add = document.createElement('button'); add.type = 'button'; add.textContent = '＋ 添加';
      add.setAttribute('aria-label', `添加${definition.title}`); add.disabled = editor.preview;
      add.addEventListener('click', () => editor.add(definition.type, undefined, editor.node && isContainer(editor.node) ? editor.node.id : null));
      info.append(text, add); tile.append(preview, info); container.append(tile);
    }
    $('library-results').textContent = `${count} 项素材 · 拖入或点击添加`;
    if (!count) {
      const empty = document.createElement('p'); empty.className = 'empty-list';
      empty.textContent = '没有找到组件，试试标签名或其他关键词。'; container.append(empty);
    }
  }
  $('search').addEventListener('input', renderLibrary);
  categories.addEventListener('change', renderLibrary);
  document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => {
    button.addEventListener('click', () => {
      kind = button.dataset.kind!;
      document.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(item => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      updateCategories(); renderLibrary();
    });
  });
  combinations.subscribe(renderLibrary);
  updateCategories(); renderLibrary();
  return { refresh: () => { renderLibrary(); renderInspector(); } };
}
