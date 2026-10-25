import type { Page } from 'playwright';
import { gotoEditor } from './layout-test-helpers';
import { createNode, initialDocument } from '../blank/src/core/model';
import { STORAGE_KEY } from '../blank/src/core/store';
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const node = (page: Page, id: string) => page.locator(`#canvas .node[data-id="${id}"]`);
const change = async (page: Page, id: string, value: string) => { await page.locator(`#${id}`).fill(value); await page.locator(`#${id}`).press('Tab'); };
const pick = async (page: Page, id: string) => page.locator(`.layer-item[data-id="${id}"]`).click();
async function hit(page: Page, id: string, label: string) {
  assert(await node(page, id).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest<HTMLElement>('.node')?.dataset.id === (element as HTMLElement).dataset.id;
  }), label);
}
async function drop(page: Page, type: string, x: number, y: number) {
  await page.locator('#search').fill(type);
  const tile = (await page.locator(`.component-tile[data-type="${type}"] .tile-preview`).boundingBox())!;
  await page.mouse.move(tile.x + 20, tile.y + 20); await page.mouse.down(); await page.mouse.move(x, y, { steps: 12 }); await page.mouse.up();
  const id = await page.locator('#canvas .node.selected').getAttribute('data-id'); assert(id && id !== 'render-root', `${type} 拖入后立即选中`); return id!;
}
async function checkAssembly(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1600, height: 1100 } });
  const root = { ...createNode('content.card'), id: 'render-root', col: 2, row: 2 };
  await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc: { ...initialDocument(), nodes: [root] } });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await gotoEditor(page, source.url()); await node(page, root.id).click({ button: 'right' }); await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click(); await page.waitForTimeout(100);
    await change(page, 'inline-width', '600'); await change(page, 'inline-height', '480');
    const box = (await node(page, root.id).boundingBox())!;
    const button = await drop(page, 'basic.button', box.x + 180, box.y + 168);
    const paragraph = await drop(page, 'html.p', box.x + 360, box.y + 312);
    for (const selection of [root.id, button, paragraph]) {
      await pick(page, selection);
      await hit(page, button, '未组装组件不能被选中的编辑框遮挡'); await hit(page, paragraph, '未组装 HTML 标签不能被选中的编辑框遮挡');
    }
    await page.locator('#assemble-layer').click();
    await hit(page, button, '组装后组件在原位置可见'); await hit(page, paragraph, '组装后标签在原位置可见');
    await page.locator('#finish-edit').click();
    await page.locator('#zoom').selectOption('0.75'); await pick(page, button);
    const scaledBefore = (await node(page, button).boundingBox())!;
    const sx = scaledBefore.x + scaledBefore.width / 2, sy = scaledBefore.y + scaledBefore.height / 2;
    await page.keyboard.down('Alt'); await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + 8.64, sy + 3.6, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
    const scaledAfter = (await node(page, button).boundingBox())!;
    assert(Math.abs(scaledAfter.x - scaledBefore.x - 8.64) < 0.6 && Math.abs(scaledAfter.y - scaledBefore.y - 3.6) < 0.6, '组合非等比缩放叠加画布缩放时，内部拖动仍使用正确坐标');
    await page.locator('#undo').click(); await page.locator('#zoom').selectOption('1'); await pick(page, root.id);
    // 原始卡片铺满组合：右键落在内部节点上，不能因浏览器默认焦点误入该子项。
    await node(page, root.id).click({ button: 'right', position: { x: 20, y: 20 } });
    await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click();
    assert(await page.locator('#canvas > .scope-root').getAttribute('data-id') === root.id, '再次右键编辑应进入整个组合，不是原始卡片子项');
    assert(await node(page, button).count() === 1 && await node(page, paragraph).count() === 1, '已组装组件和标签再次进入时全部保留');
    await hit(page, button, '再次编辑后组件可见且可命中'); await hit(page, paragraph, '再次编辑后标签可见且可命中');
    // 在缩放的父组件中移动子组件，屏幕位移必须换算成当前内部网格。
    await page.locator('#zoom').selectOption('0.75'); await pick(page, button);
    const before = (await node(page, button).boundingBox())!;
    await page.keyboard.down('Alt'); await page.mouse.move(before.x + 20, before.y + 8); await page.mouse.down(); await page.mouse.move(before.x + 38, before.y + 17, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
    const after = (await node(page, button).boundingBox())!;
    assert(Math.abs(after.x - before.x - 18) < 0.6 && Math.abs(after.y - before.y - 9) < 0.6, '缩放后内部组件拖动与指针位移一致');
    await page.locator('#zoom').selectOption('1');
    await pick(page, paragraph); await page.keyboard.press('Shift+F10'); await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click();
    assert(await page.locator('#edit-breadcrumbs button').count() === 3 && await page.locator('#canvas > .scope-root').getAttribute('data-id') === paragraph, '主动选中内部组件后仍能右键进入下一层');
    await change(page, 'prop-title', '重新进入后保留的段落'); await page.locator('#finish-edit').click(); await page.locator('#finish-edit').click(); await page.locator('#save').click();
    const doc = JSON.parse(await page.evaluate(key => localStorage.getItem(key)!, STORAGE_KEY));
    assert(doc.nodes.find((item: any) => item.id === paragraph)?.parentId === root.id && doc.nodes.find((item: any) => item.id === button)?.parentId === root.id, '结束内外层后子树关系持久化');
    await page.reload(); await node(page, root.id).waitFor();
    await node(page, root.id).click({ button: 'right', position: { x: 20, y: 20 } }); await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click();
    await hit(page, button, '刷新并再次编辑，已组装组件仍可见'); await hit(page, paragraph, '刷新并再次编辑，已组装标签仍可见');
    assert(await node(page, paragraph).locator('p').textContent() === '重新进入后保留的段落', '内部修改未丢失');
    await page.screenshot({ path: '/tmp/componentweb-assembly-render.png', fullPage: true });
    assert(!errors.length, errors.join('; '));
  } finally { await context.close(); }
}
async function checkBackground(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1600, height: 1100 } });
  const root = { ...createNode('content.card'), id: 'render-legacy', col: 2, row: 2, surface: { baseWidth: 288, baseHeight: 192, x: -24, y: -12, width: 504, height: 300 }, elements: [{ path: [0, 1], tag: 'h3', style: { x: 120, width: 180 } }] };
  await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc: { ...initialDocument(), nodes: [root] } });
  const page = await context.newPage();
  try {
    await gotoEditor(page, source.url()); await node(page, root.id).click({ button: 'right' }); await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click();
    const tagBefore = (await node(page, root.id).locator('h3').boundingBox())!;
    await change(page, 'inline-width', '600'); await change(page, 'inline-height', '480');
    assert(await node(page, root.id).evaluate(element => getComputedStyle(element).backgroundColor === 'rgb(18, 30, 43)'), '旧偏移组件的背景必须填满整个虚线编辑框');
    const tagAfter = (await node(page, root.id).locator('h3').boundingBox())!;
    assert(Math.abs(tagBefore.x - tagAfter.x) < 0.6 && Math.abs(tagBefore.width - tagAfter.width) < 0.6, '填充背景不能改变原标签坐标和布局基准');
    await page.locator('#prop-background').evaluate((input: HTMLInputElement) => { input.value = '#253545'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    assert(await node(page, root.id).evaluate(element => getComputedStyle(element).backgroundColor === 'rgb(37, 53, 69)'), '背景拾色预览同步整个编辑框');
    await page.locator('#prop-background').dispatchEvent('change');
    await page.locator('#zoom').selectOption('0.75');
    const before = (await node(page, root.id).locator('h3').boundingBox())!;
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2); await page.mouse.down(); await page.mouse.move(before.x + before.width / 2 + 18, before.y + before.height / 2 + 9, { steps: 8 }); await page.mouse.up();
    const after = (await node(page, root.id).locator('h3').boundingBox())!;
    assert(Math.abs(after.x - before.x - 18) < 0.6 && Math.abs(after.y - before.y - 9) < 0.6, '旧偏移与缩放共存时标签精准跟随指针');
    await page.locator('#finish-edit').click(); await page.locator('#save').click(); await page.reload();
    await node(page, root.id).click({ button: 'right' }); await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click();
    assert(await node(page, root.id).evaluate(element => getComputedStyle(element).backgroundColor === 'rgb(37, 53, 69)'), '再次编辑恢复完整编辑框背景');
    await page.screenshot({ path: '/tmp/componentweb-edit-background.png', fullPage: true });
  } finally { await context.close(); }
}
export async function checkAssemblyRendering(source: Page) {
  await checkAssembly(source); await checkBackground(source);
  console.log('组装显示验证通过：散件即时可见、选框不遮挡、右键准确进入、反复编辑保留子树、缩放精准拖动、旧偏移背景填充。');
}
