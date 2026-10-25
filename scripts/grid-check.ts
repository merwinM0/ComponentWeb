import type { Page } from 'playwright';
import { gotoEditor } from './layout-test-helpers';
import { CANVAS, GRID, FINE_GRID } from '../blank/src/core/grid';
import { STORAGE_KEY } from '../blank/src/core/store';
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
export async function checkFineGrid(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const legacy = { schemaVersion: 2, grid: FINE_GRID, nodes: [{ id: 'legacy-card', type: 'content.card', col: 10, row: 9, colSpan: 37, rowSpan: 24,
      props: { title: '旧布局保持精确', description: '8px 旧坐标不会因 12px 新网格而被舍入。', accent: '#8bd5ff', radius: 16, borderWidth: 2, borderStyle: 'dashed' } }] };
    await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc: legacy });
    const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await gotoEditor(page, source.url());
    const card = page.locator('.node[data-id="legacy-card"]'); await card.waitFor();
    assert(await card.evaluate(element => element.style.left === '80px' && element.style.top === '72px' && element.style.width === '296px' && element.style.height === '192px'), '8px 旧布局迁移不改变像素几何');
    assert(await card.locator('article').evaluate(element => getComputedStyle(element).borderTopLeftRadius) === '16px', '迁移保留圆角');
    assert(await page.locator('#grid-cell-label').textContent() === '12 px 网格', '网格标识为 12px');
    assert(await page.locator('#canvas').evaluate((element, size) => element.style.width === `${size.width}px` && element.style.height === `${size.height}px`, CANVAS), '画布为 16:9 基准，旧组件逻辑尺寸不变');
    assert(await page.locator('#canvas').evaluate(element => getComputedStyle(element).backgroundSize.includes('12px 12px')), '实际绘制 12px 网格');
    await card.focus(); await page.keyboard.press('ArrowRight'); assert(await card.evaluate(element => element.style.left) === '92px', '方向键移动 12px，保留原亚网格偏移');
    await page.keyboard.press('Shift+ArrowDown'); assert(await card.evaluate(element => element.style.top) === '132px', 'Shift 方向键移动 60px');
    await page.locator('#undo').click(); await page.locator('#undo').click(); await page.locator('#zoom').selectOption('0.75');
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down(); await page.mouse.move(box.x + 29, box.y + 20, { steps: 4 }); await page.mouse.up();
    assert(await card.evaluate(element => element.style.left) === '92px', '75% 缩放下拖动 9 屏幕像素对应 12 逻辑像素');
    const handle = (await card.locator('.resize-handle').boundingBox())!;
    await page.mouse.move(handle.x + 4, handle.y + 4); await page.mouse.down(); await page.mouse.move(handle.x + 13, handle.y + 4, { steps: 4 }); await page.mouse.up();
    assert(await card.evaluate(element => element.style.width) === '308px', '宽度按 12px 递增');
    await page.locator('#undo').click(); assert(await card.evaluate(element => element.style.width) === '296px', '尺寸可以撤销');
    await page.locator('#redo').click(); assert(await card.evaluate(element => element.style.width) === '308px', '尺寸可以重做');
    await page.getByRole('button', { name: '添加操作按钮', exact: true }).click(); const button = page.locator('.node.selected');
    assert(await button.evaluate(element => element.style.width) === '168px', '默认物理尺寸不变');
    const buttonBox = (await button.boundingBox())!, cardBox = (await card.boundingBox())!;
    await page.mouse.move(buttonBox.x + 20, buttonBox.y + 20); await page.mouse.down(); await page.mouse.move(cardBox.x + 40, cardBox.y + 40, { steps: 8 }); await page.mouse.up();
    assert(await button.evaluate(element => element.style.left === '0px' && element.style.top === '0px'), '仍然禁止同级重叠');
    await card.click(); await page.locator('#save').click();
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
    assert(saved.schemaVersion === 5 && saved.grid.cell === GRID.cell, '记录为 v5 横屏画布格式');
    assert(Math.abs(saved.nodes[0].col * GRID.cell - 92) < 1e-6, '保存精确的亚网格坐标');
    await page.reload(); assert(await card.evaluate(element => element.style.left === '92px' && element.style.width === '308px'), '保存恢复无重复迁移');
    await page.screenshot({ path: '/tmp/componentweb-grid12.png', fullPage: true }); assert(!errors.length, errors.join('; '));
    console.log('12px 网格验证通过：旧记录无损迁移、缩放拖动、微调、碰撞与保存。');
  } finally { await context.close(); }
}
