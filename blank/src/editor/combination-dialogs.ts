import { Combinations, captureCombination } from '../core/combinations';
import type { Editor } from './editor';
import { $, toast } from './dom';

export function setupCombinationDialogs(editor: Editor, combinations: Combinations) {
  const dialog = document.createElement('dialog'); dialog.className = 'editor-dialog'; dialog.setAttribute('aria-labelledby', 'combination-dialog-title');
  dialog.innerHTML = '<form id="combination-form"><h2 id="combination-dialog-title">保存到我的组合</h2><p>保存在当前浏览器中，包含子组件、布局和样式。添加时创建独立副本。</p><label class="field">组合名称<input id="combination-name" type="text" required maxlength="60" autocomplete="off" autofocus></label><p id="combination-error" role="alert"></p><div class="dialog-actions"><button type="button" data-cancel>取消</button><button type="submit" class="primary">确认保存</button></div></form>';
  document.body.append(dialog);
  const form = dialog.querySelector('form')!;
  const input = dialog.querySelector<HTMLInputElement>('input')!;
  const error = dialog.querySelector<HTMLElement>('[role=alert]')!;
  let renameId: string | null = null;
  let updateId: string | null = null;
  let onSaved: (() => void) | undefined;
  let snapshot: ReturnType<typeof captureCombination> | null = null;
  dialog.querySelector('[data-cancel]')!.addEventListener('click', () => dialog.close());
  form.addEventListener('submit', event => {
    event.preventDefault(); if (!form.reportValidity()) return;
    try {
      if (renameId) combinations.rename(renameId, input.value);
      else if (snapshot && updateId) combinations.update(updateId, input.value, snapshot);
      else if (snapshot) combinations.save(input.value, snapshot);
      dialog.close(); const callback = onSaved; onSaved = undefined; callback?.(); $<HTMLInputElement>('search').value = ''; document.querySelector<HTMLButtonElement>('[data-kind="我的组合"]')?.click();
      document.querySelector<HTMLButtonElement>('[data-kind="我的组合"]')?.focus(); toast(renameId ? '组合已重命名' : '已保存到我的组合');
    } catch (cause) { error.textContent = (cause as Error).message; }
  });
  editor.onSaveCombination = () => {
    try {
      snapshot = captureCombination(editor.store.doc, editor.selectedIds); renameId = null; updateId = null; onSaved = undefined;
      $('combination-dialog-title').textContent = '保存到我的组合'; input.value = (editor.node?.props.title || `我的组合 ${combinations.items.length + 1}`).slice(0, 60); error.textContent = ''; dialog.showModal(); input.select();
    } catch (cause) { toast((cause as Error).message); }
  };
  const confirm = document.createElement('dialog'); confirm.className = 'editor-dialog'; confirm.setAttribute('aria-labelledby', 'delete-combination-title');
  confirm.innerHTML = '<h2 id="delete-combination-title">删除组合？</h2><p data-description></p><p role="alert"></p><div class="dialog-actions"><button type="button" data-cancel>取消</button><button type="button" class="danger" data-confirm>删除组合</button></div>';
  document.body.append(confirm);
  let deleting: string | null = null;
  confirm.querySelector('[data-cancel]')!.addEventListener('click', () => confirm.close());
  confirm.querySelector('[data-confirm]')!.addEventListener('click', () => {
    try { if (deleting) combinations.remove(deleting); confirm.close(); document.querySelector<HTMLButtonElement>('[data-kind="我的组合"]')?.focus(); toast('组合已删除，画布中的副本不会受影响'); }
    catch (cause) { confirm.querySelector('[role=alert]')!.textContent = (cause as Error).message; }
  });
  return {
    saveDocument(document: ReturnType<typeof captureCombination>, suggestedName: string, options: { id?: string; onSaved?: () => void } = {}) {
      snapshot = structuredClone(document); renameId = null; updateId = options.id ?? null; onSaved = options.onSaved;
      $('combination-dialog-title').textContent = updateId ? '更新我的组合' : '保存到我的组合'; input.value = suggestedName.slice(0, 60); error.textContent = ''; dialog.showModal(); input.select();
    },
    rename(id: string) {
      const item = combinations.items.find(item => item.id === id); if (!item) return;
      renameId = id; snapshot = null; updateId = null; onSaved = undefined; $('combination-dialog-title').textContent = '重命名组合'; input.value = item.name; error.textContent = ''; dialog.showModal(); input.select();
    },
    remove(id: string) {
      const item = combinations.items.find(item => item.id === id); if (!item) return;
      deleting = id; confirm.querySelector('[data-description]')!.textContent = `确定删除“${item.name}”？仅删除素材库记录，不影响画布中的副本。`; confirm.querySelector('[role=alert]')!.textContent = ''; confirm.showModal();
    },
  };
}
