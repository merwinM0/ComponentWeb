import type { Page } from 'playwright';
import { GRID, LEGACY_GRID } from '../blank/src/core/grid';
import { STORAGE_KEY } from '../blank/src/core/store';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

export async function checkFineGrid(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const legacy = {
      schemaVersion: 1, grid: LEGACY_GRID,
      appearance: { background: '#0c1520', grid: '#82c4ed' },
      nodes: [{ id: 'legacy-card', type: 'content.card', col: 3, row: 3, colSpan: 12, rowSpan: 8,
        props: { title: '旧布局保留，新网格更自由', description: '位置和尺寸不变，现在可以每次微调 8px。',
          accent: '#8bd5ff', radius: 16, borderWidth: 2, borderStyle: 'dashed' } }],
    };
    await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc: legacy });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(source.url());
    const card = page.locator('[data-id="legacy-card"]');
    await card.waitFor();
    assert(await card.evaluate(element => element.style.left === '72px' && element.style.top === '72px' && element.style.width === '288px' && element.style.height === '192px'), '旧布局迁移不改变实际位置和尺寸');
    assert(await card.locator('article').evaluate(element => getComputedStyle(element).borderTopLeftRadius) === '16px', '迁移保留圆角');
    assert(await page.locator('#grid-cell-label').textContent() === '8 px 网格', '网格标识显示 8px');
    assert(await page.locator('#grid-dimensions').textContent() === '120 × 90', '网格数量正确');
    assert(await page.locator('#canvas').evaluate(element => getComputedStyle(element).backgroundSize.includes('8px 8px')), '绘制细网格而不是只修改吸附算法');
    await card.focus();
    await page.keyboard.press('ArrowRight');
    assert(await card.evaluate(element => element.style.left) === '80px', '方向键精确移动 8px');
    await page.keyboard.press('Shift+ArrowDown');
    assert(await card.evaluate(element => element.style.top) === '112px', 'Shift 方向键移动 5 格');
    await page.locator('#undo').click(); await page.locator('#undo').click();
    await page.locator('#zoom').selectOption('0.75');
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
    await page.mouse.move(box.x + 26, box.y + 20, { steps: 4 }); await page.mouse.up();
    assert(await card.evaluate(element => element.style.left) === '80px', '75% 缩放下拖动 6 屏幕像素对应 8 逻辑像素');
    const handle = (await card.locator('.resize-handle').boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 6, handle.y + handle.height / 2, { steps: 4 }); await page.mouse.up();
    assert(await card.evaluate(element => element.style.width) === '296px', '组件宽度可按 8px 递增');
    await page.locator('#undo').click();
    assert(await card.evaluate(element => element.style.width) === '288px', '微调尺寸可以撤销');
    await page.locator('#redo').click();
    assert(await card.evaluate(element => element.style.width) === '296px', '微调尺寸可以重做');
    await page.getByRole('button', { name: '添加操作按钮', exact: true }).click();
    const button = page.locator('.node.selected');
    assert(await button.evaluate(element => element.style.width) === '168px', '新组件默认物理尺寸不变');
    const buttonBox = (await button.boundingBox())!;
    const cardBox = (await card.boundingBox())!;
    await page.mouse.move(buttonBox.x + 20, buttonBox.y + 20); await page.mouse.down();
    await page.mouse.move(cardBox.x + 40, cardBox.y + 40, { steps: 8 }); await page.mouse.up();
    assert(await button.evaluate(element => element.style.left === '0px' && element.style.top === '0px'), '细网格仍然禁止重叠');
    await card.click();
    await page.locator('#save').click();
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
    assert(saved.schemaVersion === 2 && saved.grid.cell === GRID.cell, '新记录使用 v2 网格格式');
    assert(saved.nodes[0].id === 'legacy-card' && saved.nodes[0].col === 10 && saved.nodes[0].colSpan === 37, '保存的是新的网格坐标，ID 不变');
    await page.reload();
    assert(await card.evaluate(element => element.style.left === '80px' && element.style.width === '296px'), '新网格布局保存后恢复，无重复迁移');
    await card.click();
    await page.screenshot({ path: '/tmp/componentweb-grid8.png', fullPage: true });
    assert(errors.length === 0, `网格迁移页面无运行错误：${errors.join('; ')}`);
    console.log('细网格验证通过：24→8px 迁移、键盘、缩放拖动、8px 尺寸调整、碰撞、撤销重做和保存恢复。');
  } finally {
    await context.close();
  }
}
