import { components, registry } from '../components/registry';
import { importedDefinition, IMPORT_KEY, readImports, validateImport } from '../components/imported';
import { $, toast } from './dom';
import type { Editor } from './editor';

export function setupImportDialog(editor: Editor) {
  const dialog = document.createElement('dialog');
  dialog.className = 'editor-dialog import-dialog';
  dialog.setAttribute('aria-labelledby', 'import-heading');
  dialog.innerHTML = `<form><h2 id="import-heading">导入组件</h2><p id="import-help">粘贴一个 style 样式块和 HTML 内容（最多 50,000 字符）。仅支持静态 HTML + CSS，不执行 JavaScript，不加载外部资源。保存在当前浏览器，默认尺寸 288 × 192px，可在工作区调整。</p><label class="field">组件名称<input name="name" required maxlength="60" autocomplete="off"></label><label class="field full">HTML + CSS<textarea name="code" rows="12" required maxlength="50000" spellcheck="false" aria-describedby="import-help"></textarea></label><p role="alert"></p><div class="dialog-actions"><button type="button" data-cancel>取消</button><button class="primary" type="submit">导入组件</button></div></form>`;
  document.body.append(dialog);
  const name = dialog.querySelector<HTMLInputElement>('input')!;
  const code = dialog.querySelector<HTMLTextAreaElement>('textarea')!;
  code.placeholder = '<style>\n.card { padding:24px; background:#eff6ff; color:#152535; }\n</style>\n<article class="card"><h2>我的卡片</h2><p>组件内容</p></article>';
  const error = dialog.querySelector<HTMLElement>('[role=alert]')!;
  $('import-component').addEventListener('click', () => {
    if (editor.preview) return;
    error.textContent = ''; dialog.showModal(); name.focus();
  });
  dialog.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('form')!.addEventListener('submit', event => {
    event.preventDefault();
    try {
      if (editor.preview) throw new Error('请先退出预览模式。');
      if (!name.value.trim()) throw new Error('请输入组件名称。');
      const records = readImports();
      if (records.length >= 50) throw new Error('最多可导入 50 个组件。');
      const record = { id: `imported.${crypto.randomUUID()}`, name: name.value.trim(), code: validateImport(code.value) };
      localStorage.setItem(IMPORT_KEY, JSON.stringify([...records, record]));
      const definition = importedDefinition(record);
      components.push(definition); registry.set(definition.type, definition);
      dialog.close(); name.value = ''; code.value = '';
      $<HTMLInputElement>('search').value = '';
      document.querySelector<HTMLButtonElement>('[data-kind="导入组件"]')?.click();
      document.querySelector<HTMLButtonElement>('[data-kind="导入组件"]')?.focus();
      toast('已保存到导入组件，可拖入或点击添加');
    } catch (cause) { error.textContent = `导入失败：${(cause as Error).message}`; }
  });
}
