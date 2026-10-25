import type { Page } from 'playwright';
import { initialDocument, parseDocument } from '../blank/src/core/model';
import { CANVAS, GRID, CLASSIC_GRID } from '../blank/src/core/grid';
import { LAYOUTS_KEY } from '../blank/src/core/layouts';
import { contrastRatio } from '../blank/src/components/colors';
const assert = (value: unknown, label: string) => { if (!value) throw new Error(label); };
const frames = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
const snapshot = (page: Page) => page.evaluate(key => localStorage.getItem(key), LAYOUTS_KEY);
export async function checkDesktopCanvas(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'no-preference' });
  const original = parseDocument(JSON.stringify(initialDocument())), id = 'desktop-legacy-layout';
  const item = { id, name: '保留旧布局的桌面画布', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-02T00:00:00.000Z', document: { ...original, schemaVersion: 3, grid: CLASSIC_GRID } };
  const raw = JSON.stringify({ schemaVersion: 1, items: [item] });
  await context.addInitScript(({ key, raw }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, raw); }, { key: LAYOUTS_KEY, raw });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    const url = new URL(source.url()); url.hash = ''; await page.goto(url.href); await page.locator('.layout-item').waitFor();
    const field = page.locator('#layout-search').locator('..'); await page.locator('#layout-search').evaluate(element => (element as HTMLInputElement).blur());
    await page.mouse.move(-10, -10); await page.waitForTimeout(250);
    const ink = await field.evaluate(element => {
      const input = element.querySelector('input')!, style = getComputedStyle(element);
      const hex = (value: string) => '#' + value.match(/\d+/g)!.slice(0, 3).map(value => Number(value).toString(16).padStart(2, '0')).join('');
      return { background: hex(style.backgroundColor), border: hex(style.borderTopColor), text: hex(getComputedStyle(input).color), placeholder: hex(getComputedStyle(input, '::placeholder').color), opaque: style.backgroundColor.startsWith('rgb('), width: style.borderTopWidth };
    });
    assert(ink.opaque && ink.width === '1px' && contrastRatio(ink.text, ink.background) >= 7 && contrastRatio(ink.placeholder, ink.background) >= 7 && contrastRatio(ink.border, ink.background) >= 3, '暗色搜索具有不透光底色、高对比文字 / 占位和单像素清晰边界');
    const box = (await field.boundingBox())!;
    // 定位截图会向外取整，不能把控件外的半像素背景算作控件内容。
    const clip = { x: Math.ceil(box.x) + 1, y: Math.ceil(box.y) + 1, width: Math.floor(box.width) - 2, height: Math.floor(box.height) - 2 };
    const stable = await page.screenshot({ clip, path: '/tmp/componentweb-search-before.png' });
    for (const [x, y] of [[box.x + box.width / 2, box.y + box.height / 2], [box.x - 3, box.y + box.height / 2], [box.x + box.width + 3, box.y + box.height / 2]]) {
      await page.mouse.move(x, y); await frames(page); await page.waitForTimeout(220);
      const sample = await page.screenshot({ clip, path: '/tmp/componentweb-search-after.png' });
      assert(stable.equals(sample), '光照从搜索框内及两边经过时，搜索框像素保持清晰稳定');
    }
    await page.screenshot({ path: '/tmp/componentweb-search-contrast.png' });
    await page.locator('#layout-search').focus(); assert(await page.locator('#layout-search').evaluate(element => getComputedStyle(element).outlineStyle === 'none' && getComputedStyle(element.parentElement!).borderTopWidth === '1px'), '增强对比后仍只有细焦点，不恢复粗内边框');
    await page.locator('#layout-search').fill('桌面'); assert(await page.locator('.layout-item').count() === 1, '高对比搜索仍正常工作'); await page.locator('#layout-search').clear();
    await page.locator('.layout-item').click(); await page.locator('#editor-page').waitFor({ state: 'visible' });
    const first = page.locator(`#canvas > .node[data-id="${original.nodes[0].id}"]`);
    for (const [width, height] of [[1280, 720], [1440, 900], [1920, 1080], [2560, 1440], [3440, 1440], [3840, 2160]]) {
      await page.setViewportSize({ width, height }); await frames(page);
      assert(await page.locator('#zoom').inputValue() === '1', `${width}px 默认仍是实际 100%`);
      assert(await page.locator('#canvas').evaluate((element, size) => {
        const canvas = element.getBoundingClientRect(), viewport = document.getElementById('viewport')!;
        return canvas.width === size.width && canvas.height === size.height && canvas.width >= viewport.clientWidth && canvas.height >= viewport.clientHeight && canvas.width / canvas.height === 4 / 3;
      }, CANVAS), `${width}×${height} 电脑横屏下真实画布铺满工作区，不拉伸或假画背景`);
      assert(await first.evaluate(element => element.style.left === '72px' && element.style.top === '72px' && element.style.width === '288px' && element.style.height === '192px'), '扩大画布不改变旧组件像素位置与尺寸');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '大画布只在工作区内部滚动，不撑出整页横向溢出');
      if (width === 1920 || width === 3840) await page.screenshot({ path: `/tmp/componentweb-canvas-${width}.png` });
    }
    for (const zoom of ['0.125', '0.25', '0.75', '1']) {
      await page.locator('#zoom').selectOption(zoom);
      const rect = (await first.boundingBox())!; assert(Math.abs(rect.width - 288 * Number(zoom)) < .1 && Math.abs(rect.height - 192 * Number(zoom)) < .1, '新增概览和原有缩放均等比，不改变组件设计尺寸');
    }
    assert(await snapshot(page) === raw, '只浏览、缩放、迁移读取不覆盖旧布局库或修改时间');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.locator('#viewport').evaluate(element => { element.scrollLeft = 0; element.scrollTop = 600; });
    const preview = page.locator('.component-tile[data-type="basic.button"] .tile-preview'); await preview.scrollIntoViewIfNeeded();
    const from = (await preview.boundingBox())!, canvas = (await page.locator('#canvas').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(canvas.x + 1200, canvas.y + 960, { steps: 16 }); await page.mouse.up();
    const added = page.locator('#canvas > .node.selected'), addedId = (await added.getAttribute('data-id'))!;
    assert(addedId && await added.evaluate(element => parseFloat(element.style.left) > 960 && parseFloat(element.style.top) > 720), '可以实际拖入旧 960×720 之外的新增区域');
    await page.locator('#undo').click(); assert(await page.locator(`#canvas > .node[data-id="${addedId}"]`).count() === 0, '新增区域拖放可以撤销'); await page.locator('#redo').click();
    await page.locator('#save').click();
    const saved = JSON.parse((await snapshot(page))!).items.find((item: any) => item.id === id).document;
    assert(saved.schemaVersion === 4 && saved.grid.cols === GRID.cols && saved.grid.rows === GRID.rows && saved.nodes.length === original.nodes.length + 1, '新增区域保存为经过校验的 v4 文档');
    assert(JSON.stringify(saved.nodes.filter((node: any) => node.id !== addedId)) === JSON.stringify(original.nodes), '原有组件 ID、结构、属性和几何完整保留');
    await page.reload(); const restored = page.locator(`#canvas > .node[data-id="${addedId}"]`); await restored.waitFor({ state: 'attached' });
    assert(await restored.evaluate(element => parseFloat(element.style.left) > 960 && parseFloat(element.style.top) > 720), '刷新恢复新增区域的真实节点，不重复缩放或迁移');
    const beforeTheme = await snapshot(page); await page.locator('#toggle-theme').click(); assert(await snapshot(page) === beforeTheme, '亮暗切换不影响大画布存档');
    assert(await page.locator('#canvas').evaluate(element => element.style.getPropertyValue('--canvas-background') === '#ffffff' && element.style.width === '3840px'), '亮色同样覆盖整个大画布');
    assert(!errors.length, errors.join('; '));
    console.log('桌面画布验证通过：暗色搜索光照下像素稳定、六档横屏至 4K 的 100% 覆盖、4:3 与 12px 不变、v3 无损迁移、新增区域拖放/历史/保存/刷新、概览缩放及主题隔离。');
  } finally { await context.close(); }
}
