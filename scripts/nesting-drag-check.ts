import type { Page } from 'playwright';
import { gotoEditor } from './layout-test-helpers';
import { createNode, initialDocument } from '../blank/src/core/model';
import { STORAGE_KEY } from '../blank/src/core/store';
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
export async function checkNestingDrag(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const container = { ...createNode('layout.container'), id: 'drag-container', col: 2, row: 2, colSpan: 30, rowSpan: 20 };
  const button = { ...createNode('basic.button'), id: 'drag-button', col: 40, row: 6 };
  await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc: { ...initialDocument(), nodes: [container, button] } });
  try {
    const page = await context.newPage(); await gotoEditor(page, source.url());
    const canvas = page.locator('#canvas');
    const pick = async (id: string) => page.locator(`.layer-item[data-id="${id}"]`).click();
    const child = page.locator('[data-id="drag-button"].node'); const parent = page.locator('[data-id="drag-container"].node');
    await child.waitFor();
    const origin = (await canvas.boundingBox())!, from = (await child.boundingBox())!;
    await page.mouse.move(from.x + 20, from.y + 20); await page.mouse.down(); await page.mouse.move(origin.x + 180, origin.y + 120, { steps: 12 }); await page.mouse.up();
    assert(await parent.locator(':scope > .component-host > .node').count() === 1, '拖入容器建立真实父子关系');
    const before = (await child.boundingBox())!;
    await pick('drag-container'); const parentBox = (await parent.boundingBox())!;
    await page.mouse.move(parentBox.x + 2, parentBox.y + 2); await page.mouse.down(); await page.mouse.move(parentBox.x + 26, parentBox.y + 26, { steps: 8 }); await page.mouse.up();
    const after = (await child.boundingBox())!; assert(Math.abs(after.x - before.x - 24) < 1 && Math.abs(after.y - before.y - 24) < 1, '移动容器会整体移动嵌套内容');
    await pick('drag-button'); const current = (await child.boundingBox())!;
    await page.mouse.move(current.x + 20, current.y + 20); await page.mouse.down(); await page.mouse.move(origin.x + 620, origin.y + 460, { steps: 12 }); await page.mouse.up();
    assert(await canvas.locator(':scope > .node[data-id="drag-button"]').count() === 1, '可以将子组件拖回画布');
    await page.locator('#undo').click(); assert(await parent.locator(':scope > .component-host > .node').count() === 1, '跨层级移动可整体撤销');
    await pick('drag-container'); await page.locator('#delete').click(); assert(await page.locator('.node').count() === 0, '删除容器连同子树删除');
    await page.locator('#undo').click(); assert(await page.locator('.node').count() === 2, '撤销恢复完整子树');
    console.log('嵌套拖动验证通过：拖入、移出、父子整体移动、跨层级撤销和删除恢复。');
  } finally { await context.close(); }
}
