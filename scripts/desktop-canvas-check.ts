import type { Page } from 'playwright';
import { initialDocument, parseDocument } from '../blank/src/core/model';
import { CANVAS, GRID, CLASSIC_GRID, LARGE_GRID } from '../blank/src/core/grid';
import { LAYOUTS_KEY } from '../blank/src/core/layouts';
import { contrastRatio } from '../blank/src/components/colors';
const assert = (value: unknown, label: string) => { if (!value) throw new Error(label); };
const frames = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
const snapshot = (page: Page) => page.evaluate(key => localStorage.getItem(key), LAYOUTS_KEY);
async function fits(page: Page) {
  assert(await page.locator('#canvas').evaluate(element => {
    const box = element.getBoundingClientRect(), viewport = document.getElementById('viewport')!, area = viewport.getBoundingClientRect();
    return Math.abs(box.width / box.height - 16 / 9) < .0001 && box.left >= area.left && box.top >= area.top && box.right <= area.right && box.bottom <= area.bottom && Math.min(viewport.clientWidth - box.width, viewport.clientHeight - box.height) <= 5 && viewport.scrollWidth <= viewport.clientWidth + 1 && viewport.scrollHeight <= viewport.clientHeight + 1;
  }), '默认 16:9 画布完整等比适应可见工作区，没有裁切、拉伸或超大滚动区域');
}
export async function checkDesktopCanvas(source: Page) {
  const browser = source.context().browser()!, context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'no-preference' });
  const original = parseDocument(JSON.stringify(initialDocument())), id = 'desktop-legacy-layout';
  const item = { id, name: '保留旧布局的横屏画布', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z', document: { ...original, schemaVersion: 3, grid: CLASSIC_GRID } };
  const raw = JSON.stringify({ schemaVersion: 1, items: [item] });
  await context.addInitScript(({ key, raw }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, raw); }, { key: LAYOUTS_KEY, raw });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const url = new URL(source.url()); url.hash = '';
  try {
    await page.goto(url.href); await page.locator('.layout-item').waitFor();
    const field = page.locator('#layout-search').locator('..'); await page.locator('#layout-search').evaluate(element => (element as HTMLInputElement).blur());
    await page.mouse.move(-10, -10); await page.waitForTimeout(250);
    const ink = await field.evaluate(element => {
      const input = element.querySelector('input')!, style = getComputedStyle(element);
      const hex = (value: string) => '#' + value.match(/\d+/g)!.slice(0, 3).map(value => Number(value).toString(16).padStart(2, '0')).join('');
      return { background: hex(style.backgroundColor), border: hex(style.borderTopColor), text: hex(getComputedStyle(input).color), placeholder: hex(getComputedStyle(input, '::placeholder').color), opaque: style.backgroundColor.startsWith('rgb('), width: style.borderTopWidth };
    });
    assert(ink.opaque && ink.width === '1px' && contrastRatio(ink.text, ink.background) >= 7 && contrastRatio(ink.placeholder, ink.background) >= 7 && contrastRatio(ink.border, ink.background) >= 3, '保留暗色搜索的高对比与单像素边界');
    const box = (await field.boundingBox())!, clip = { x: Math.ceil(box.x) + 1, y: Math.ceil(box.y) + 1, width: Math.floor(box.width) - 2, height: Math.floor(box.height) - 2 };
    const stable = await page.screenshot({ clip });
    for (const [x, y] of [[box.x + box.width / 2, box.y + box.height / 2], [box.x - 3, box.y + box.height / 2], [box.x + box.width + 3, box.y + box.height / 2]]) {
      await page.mouse.move(x, y); await frames(page); await page.waitForTimeout(220); assert(stable.equals(await page.screenshot({ clip })), '光照经过不影响搜索内容像素');
    }
    await page.screenshot({ path: '/tmp/componentweb-search-contrast.png' });
    await page.locator('.layout-item').click(); await page.locator('#editor-page').waitFor({ state: 'visible' }); await frames(page);
    const first = page.locator(`#canvas > .node[data-id="${original.nodes[0].id}"]`);
    for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080], [2560, 1440], [3440, 1440], [3840, 2160]]) {
      await page.setViewportSize({ width, height }); await frames(page);
      assert(await page.locator('#zoom').inputValue() === 'fit', '默认是适应工作区，而不是伪装成 100%'); await fits(page);
      assert(await first.evaluate(element => element.style.left === '72px' && element.style.top === '72px' && element.style.width === '288px' && element.style.height === '192px'), '改变显示比例不修改组件逻辑像素');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '等比适应不撑出整页横向溢出');
      if (width === 1920 || width === 3840) await page.screenshot({ path: `/tmp/componentweb-canvas-aspect-${width}.png` });
    }
    for (const zoom of ['0.5', '0.75', '1', '1.25']) {
      await page.locator('#zoom').selectOption(zoom); const rect = (await first.boundingBox())!;
      assert(Math.abs(rect.width - 288 * Number(zoom)) < .1 && Math.abs(rect.height - 192 * Number(zoom)) < .1, '手动倍率仍为真正等比显示');
    }
    await page.locator('#zoom').selectOption('1'); await page.setViewportSize({ width: 1280, height: 720 }); await frames(page);
    assert(await page.locator('#zoom').inputValue() === '1' && Math.abs((await page.locator('#canvas').boundingBox())!.width - CANVAS.width) < .1, '手动 100% 不被窗口变化悄悄覆盖');
    await page.locator('#zoom').selectOption('fit'); await frames(page); await fits(page);
    const beforeKey = (await first.boundingBox())!, scale = (await page.locator('#canvas').boundingBox())!.width / CANVAS.width;
    await first.focus(); await page.keyboard.press('ArrowRight'); const afterKey = (await first.boundingBox())!;
    assert(Math.abs(afterKey.x - beforeKey.x - GRID.cell * scale) < .1, '适应倍率下方向键仍对应 12 个逻辑像素'); await page.locator('#undo').click(); await page.waitForTimeout(450);
    assert(await snapshot(page) === raw, '适应、窗口变化、缩放及撤销不重写旧库或修改时间');
    await page.setViewportSize({ width: 1920, height: 1080 }); await frames(page); await fits(page);
    const preview = page.locator('.component-tile[data-type="basic.button"] .tile-preview'); await preview.scrollIntoViewIfNeeded();
    const from = (await preview.boundingBox())!, canvas = (await page.locator('#canvas').boundingBox())!, factor = canvas.width / CANVAS.width;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down(); await page.mouse.move(canvas.x + 1128 * factor, canvas.y + 600 * factor, { steps: 16 }); await page.mouse.up();
    const added = page.locator('#canvas > .node.selected'), addedId = (await added.getAttribute('data-id'))!;
    assert(addedId && await added.evaluate(element => parseFloat(element.style.left) > 960 && parseFloat(element.style.top) < 720), '适应模式下可准确拖入横屏右侧，而非超大像素区域');
    await page.locator('#undo').click(); assert(await page.locator(`#canvas > .node[data-id="${addedId}"]`).count() === 0, '等比适应的拖放可以撤销'); await page.locator('#redo').click(); await page.locator('#save').click();
    const saved = JSON.parse((await snapshot(page))!).items.find((item: any) => item.id === id).document;
    assert(saved.schemaVersion === 5 && saved.grid.cols === GRID.cols && saved.grid.rows === GRID.rows && JSON.stringify(saved.nodes.filter((node: any) => node.id !== addedId)) === JSON.stringify(original.nodes), '新存档保持 16:9，旧节点、坐标、尺寸和结构不变');
    await page.reload(); await page.locator(`#canvas > .node[data-id="${addedId}"]`).waitFor({ state: 'attached' }); await frames(page); await fits(page);
    const beforeEdit = await page.locator('#canvas').evaluate(element => (element as HTMLElement).style.transform);
    await first.click({ button: 'right' }); await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click(); await frames(page);
    assert(await page.locator('#canvas').evaluate(element => (element as HTMLElement).style.transform) === beforeEdit, '进入原位编辑不会因工具栏出现而自动改变当前倍率');
    await page.locator('#prop-title').fill('横屏适应下的编辑'); await page.locator('#prop-title').press('Tab'); await page.locator('#zoom').selectOption('0.75');
    await page.locator('#finish-edit').click(); await frames(page); assert(await page.locator('#zoom').inputValue() === 'fit', '编辑层内手动调整后，完成仍恢复原工作区适应模式'); await fits(page); await page.locator('#save').click();
    const beforeTheme = await snapshot(page); await page.locator('#toggle-theme').click(); assert(await snapshot(page) === beforeTheme, '主题不修改画布存档'); await fits(page);
    assert(!errors.length, errors.join('; '));
  } finally { await context.close(); }
  const legacy = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const far = { ...original.nodes[0], id: 'legacy-far-node', col: 250, row: 150 }, nodes = [...original.nodes, far];
    await legacy.addInitScript(({ key, item, nodes, grid }) => { localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, items: [{ ...item, document: { ...item.document, schemaVersion: 4, grid, nodes } }] })); }, { key: LAYOUTS_KEY, item, nodes, grid: LARGE_GRID });
    const page = await legacy.newPage(); await page.goto(url.href); await page.locator('.layout-item').click(); await frames(page);
    assert(await page.locator('#canvas-size-label').textContent() === '旧画布兼容' && await page.locator('#zoom').inputValue() === 'fit', '只有确实存在远处内容的旧布局保留原尺寸，并默认全览');
    assert(await page.locator('#canvas > .node[data-id="legacy-far-node"]').evaluate(element => element.style.left === '3000px' && element.style.top === '1800px'), '远处节点不裁剪、不缩放数据、不改父级');
    await page.locator('#save').click(); const saved = JSON.parse((await snapshot(page))!).items[0].document;
    assert(saved.schemaVersion === 5 && saved.grid.cols === LARGE_GRID.cols && JSON.stringify(saved.nodes) === JSON.stringify(nodes), '兼容保存保留所有旧大画布内容');
    await page.locator('#home-link').click(); await page.locator('#new-layout').click(); await page.locator('#layout-name').fill('正常横屏新布局'); await page.locator('#layout-form button[type="submit"]').click(); await frames(page); await fits(page);
    assert(await page.locator('#canvas-size-label').textContent() === '16:9 横屏', '新布局不会继承旧大画布尺寸');
  } finally { await legacy.close(); }
  console.log('横屏比例验证通过：16:9 默认适应、六档工作区完整等比显示、真实手动倍率、缩放后拖放/历史/保存、普通旧布局恢复比例、远处旧内容兼容与搜索对比。');
}
