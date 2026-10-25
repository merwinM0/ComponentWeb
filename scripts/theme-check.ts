import type { Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createNode, initialDocument } from '../blank/src/core/model';
import { LAYOUTS_KEY, type SavedLayout } from '../blank/src/core/layouts';
import { THEME_KEY, themeDefaults } from '../blank/src/core/theme';
const assert = (value: unknown, label: string) => { if (!value) throw new Error(label); };
const urlOf = (page: Page) => { const url = new URL(page.url()); url.hash = ''; return url.href; };
const snapshot = (page: Page) => page.evaluate(key => localStorage.getItem(key), LAYOUTS_KEY);
const stored = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), THEME_KEY);
async function audit(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  assert(!result.violations.length, `${label} 无障碍：${JSON.stringify(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })))}`);
}
async function colors(page: Page, background: string, grid: string) {
  assert(await page.locator('#canvas-hex-background').inputValue() === background.toUpperCase() && await page.locator('#canvas-hex-grid').inputValue() === grid.toUpperCase(), '颜色字段反映浏览器当前网格配色');
  assert(await page.locator('#canvas').evaluate((element, expected) => (element as HTMLElement).style.getPropertyValue('--canvas-background') === expected.background && (element as HTMLElement).style.getPropertyValue('--canvas-grid') === expected.grid, { background, grid }), '画布真正应用当前配色，而非仅切换按钮状态');
}
async function change(page: Page, key: string, value: string) { await page.locator(`#canvas-hex-${key}`).fill(value); await page.locator(`#canvas-hex-${key}`).press('Tab'); }
export async function checkTheme(source: Page) {
  const browser = source.context().browser()!, context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const layouts: SavedLayout[] = ['表单布局', '旧配色布局', '最近布局'].map((name, i) => ({ id: `theme-layout-${i}`, name, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: new Date(Date.UTC(2025, 0, i + 1)).toISOString(), document: { ...initialDocument(), appearance: i === 1 ? { background: '#213141', grid: '#fedcba' } : themeDefaults('dark'), nodes: [{ ...createNode('basic.button'), id: `theme-node-${i}`, col: 2, row: 2 }] } }));
  await context.addInitScript(({ key, layouts }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, items: layouts })); }, { key: LAYOUTS_KEY, layouts });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(urlOf(source)); await page.locator('.layout-item').first().waitFor(); const before = await snapshot(page), toggle = page.locator('#toggle-theme');
    assert(await page.locator('html').getAttribute('data-theme') === 'dark' && await toggle.getAttribute('aria-pressed') === 'false', '即使系统为亮色，首次仍默认原有暗色');
    assert(await page.locator('#home-location').count() === 0 && !(await page.locator('.topbar').textContent())!.includes('本地布局库'), '顶栏移除本地布局库文字');
    const homeButton = (await toggle.boundingBox())!; assert(homeButton.x > 1360 && await page.locator('#editor-actions').isHidden(), '首页仅在顶栏右侧提供主题开关');
    assert(await page.locator('.home-library-controls').evaluate(element => getComputedStyle(element).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(element).position !== 'sticky'), '新建与搜索区域透明并随页面滚动，不遮网格或与列表叠字');
    await page.locator('#layout-search').focus();
    assert(await page.locator('#layout-search').evaluate(element => getComputedStyle(element).outlineStyle === 'none' && getComputedStyle(element).boxShadow === 'none' && getComputedStyle(element.parentElement!).borderTopWidth === '1px'), '搜索使用单层一像素焦点边框，没有粗内框');
    await page.locator('#layout-search').fill('表单'); assert(await page.locator('.layout-item').count() === 1, '透明工具区仍能正常搜索'); await page.locator('#layout-search').clear();
    await page.screenshot({ path: '/tmp/componentweb-theme-dark-home.png' }); await audit(page, '暗色透明工具区');
    await toggle.focus(); await page.keyboard.press('Space');
    assert(await page.locator('html').getAttribute('data-theme') === 'light' && await toggle.getAttribute('aria-pressed') === 'true', '主题可用键盘切换且状态明确');
    assert(await page.locator('#home-backdrop').evaluate(element => getComputedStyle(element).backgroundColor === 'rgb(255, 255, 255)') && (await stored(page)).appearance.grid === '#000000', '亮色首页网格默认为白底黑线');
    assert((await stored(page)).mode === 'light' && await snapshot(page) === before, '只记录外观偏好，不改布局或修改时间');
    await page.waitForTimeout(220); await page.screenshot({ path: '/tmp/componentweb-theme-light-home.png' }); await audit(page, '亮色首页');
    await page.reload(); assert(await page.locator('html').getAttribute('data-theme') === 'light', '刷新保留亮色主题');
    await page.locator('#hero-new-layout').click(); await audit(page, '亮色新建弹窗'); await page.locator('#layout-form [data-cancel]').click();
    await page.locator('#continue-layout').click(); await page.locator('#editor-page').waitFor({ state: 'visible' }); await colors(page, '#ffffff', '#000000');
    const saveBox = (await page.locator('#save').boundingBox())!, editButton = (await toggle.boundingBox())!;
    assert(editButton.x > saveBox.x + saveBox.width && Math.abs(editButton.y - saveBox.y) < 5, '编辑页主题开关在保存布局右侧');
    await page.evaluate(() => { (window as any).themeHost = document.querySelector('.component-host'); });
    assert(await page.locator('#undo').isDisabled(), '仅切换主题没有制造布局历史');
    await toggle.click(); await colors(page, themeDefaults('dark').background, themeDefaults('dark').grid);
    await page.waitForTimeout(450); assert(await snapshot(page) === before && await page.locator('#undo').isDisabled(), '编辑器切换主题也不触发自动保存或修改时间');
    assert(await page.evaluate(() => (window as any).themeHost === document.querySelector('.component-host')), '主题切换不重建真实组件或改变其内部状态');
    await toggle.click(); await change(page, 'background', '#f1e8d9');
    await page.locator('#undo').click(); await colors(page, '#ffffff', '#000000');
    await page.locator('#redo').click(); await colors(page, '#f1e8d9', '#000000'); await change(page, 'grid', '#314159');
    assert((await stored(page)).appearance.background === '#f1e8d9' && (await stored(page)).appearance.grid === '#314159', '修改的网格配色自动记入浏览器');
    await page.locator('#undo').click(); await colors(page, '#f1e8d9', '#000000'); assert((await stored(page)).appearance.grid === '#000000', '原有画布配色撤销同步本地偏好');
    await page.locator('#redo').click(); await colors(page, '#f1e8d9', '#314159'); await page.locator('#save').click();
    await page.locator('#home-link').click(); assert(await page.locator('#home-backdrop').evaluate(element => getComputedStyle(element).backgroundColor === 'rgb(255, 255, 255)'), '自定义画布颜色不污染首页文字对比度，首页网格跟随主题默认色');
    await page.locator('.layout-item[data-layout-id="theme-layout-1"]').click(); await colors(page, '#f1e8d9', '#314159'); await page.reload(); await colors(page, '#f1e8d9', '#314159');
    const beforeReset = await snapshot(page); await toggle.click(); await colors(page, themeDefaults('dark').background, themeDefaults('dark').grid); await toggle.click(); await colors(page, '#ffffff', '#000000');
    await page.reload(); await colors(page, '#ffffff', '#000000'); assert(await snapshot(page) === beforeReset, '切换后记住各主题默认网格，不从旧布局或旧自定义配色恢复');
    await page.locator('.node').click(); const componentColor = await page.locator('#prop-hex-background').inputValue();
    await page.locator('.node').click({ button: 'right' }); await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click();
    await page.locator('#prop-title').fill('切换主题也保留草稿'); await page.locator('#prop-title').press('Tab'); await toggle.click();
    assert(await page.locator('#inline-editor').isVisible() && await page.locator('#prop-title').inputValue() === '切换主题也保留草稿' && await page.locator('#prop-hex-background').inputValue() === componentColor, '草稿中切换主题不退出编辑、不丢内容，也不改组件颜色');
    await page.locator('#finish-edit').click(); await toggle.click(); await audit(page, '亮色工作台');
    await page.screenshot({ path: '/tmp/componentweb-theme-light-editor.png' });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const save = (await page.locator('#save').boundingBox())!, theme = (await toggle.boundingBox())!;
      assert(theme.x >= save.x + save.width && theme.x + theme.width <= width && Math.abs(theme.y - save.y) < 5, `${width}px 保存右侧开关不溢出、不遮挡`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 亮色工作页无横向溢出`);
      await page.locator('#home-link').click(); assert(await toggle.isVisible(), `${width}px 首页主题开关可用`);
      if (width === 320) { await page.screenshot({ path: '/tmp/componentweb-theme-light-mobile.png' }); await audit(page, '窄屏亮色首页'); }
      await page.locator('#continue-layout').click();
    }
    assert(!errors.length, errors.join('; '));
  } finally { await context.close(); }
  const unavailable = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    await unavailable.addInitScript(key => { const get = Storage.prototype.getItem, set = Storage.prototype.setItem; Storage.prototype.getItem = function (name) { if (name === key) throw new Error('denied'); return get.call(this, name); }; Storage.prototype.setItem = function (name, value) { if (name === key) throw new Error('denied'); set.call(this, name, value); }; }, THEME_KEY);
    const page = await unavailable.newPage(); await page.goto(urlOf(source)); await page.locator('#toggle-theme').tap();
    assert(await page.locator('html').getAttribute('data-theme') === 'light' && (await page.locator('#toast').textContent())!.includes('未能记录'), '偏好存储不可用时触屏仍能切换，并明确提示未持久化');
    await page.locator('#continue-layout').tap(); assert(await page.locator('#editor-page').isVisible(), '主题偏好失败不阻断布局操作');
  } finally { await unavailable.close(); }
  console.log('主题验证通过：默认暗色、透明工具区、细焦点、首页/保存右侧切换、白底黑线、刷新与自定义记忆、切换重置、历史/数据/草稿隔离、亮色无障碍及四档响应式。');
}
