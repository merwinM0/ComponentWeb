import type { Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { initialDocument, createNode } from '../blank/src/core/model';
import { LAYOUTS_KEY, type SavedLayout } from '../blank/src/core/layouts';
import { layoutHash } from '../blank/src/core/layout-route';
import { HOME_MOTION_KEY } from '../blank/src/editor/home-motion';
const assert = (value: unknown, label: string) => { if (!value) throw new Error(label); };
const origin = (page: Page) => { const url = new URL(page.url()); url.hash = ''; return url.href; };
const names = ['产品首页', '商品详情', '个人中心', '登录页面', '活动专题', '设置页面', '移动端首页', '数据概览'];
const layouts: SavedLayout[] = names.map((name, index) => ({ id: `appearance-${index}`, name, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: new Date(Date.UTC(2025, 0, index + 1)).toISOString(), document: { ...initialDocument(), nodes: [{ ...createNode('basic.button'), id: `appearance-node-${index}` }] } }));
async function audit(page: Page, label: string) { const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); assert(!result.violations.length, `${label} 无障碍：${JSON.stringify(result.violations.map(item => item.id))}`); }
async function clickable(page: Page, id: string) {
  assert(await page.locator(`#${id}`).evaluate(element => { const box = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); }), `${id} 不被装饰层遮挡`);
}
async function frames(page: Page) { await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); }

export async function checkHomeAppearance(source: Page) {
  const browser = source.context().browser()!, context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  await context.addInitScript(({ key, layouts }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, items: layouts })); }, { key: LAYOUTS_KEY, layouts });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(origin(source)); await page.locator('.layout-item').first().waitFor();
    const hero = page.locator('#home-hero'); await page.waitForFunction(() => document.getElementById('home-hero')!.dataset.motion === 'running');
    assert(await page.locator('#home-heading').evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 48 && getComputedStyle(element.parentElement!).textAlign === 'center'), '首页居中大标题清晰突出');
    assert(await page.locator('#hero-latest-name').textContent() === '数据概览', '首页快捷入口显示最近修改的布局名称');
    const first = (await page.locator('.layout-item').first().boundingBox())!; assert(first.y + first.height <= 900, '桌面首屏能完整看到第一份布局，不被主视觉挤出');
    await clickable(page, 'hero-new-layout'); await clickable(page, 'continue-layout'); await clickable(page, 'toggle-home-motion');
    assert(await hero.evaluate(element => element.getAnimations({ subtree: true }).some(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations === Infinity)), '装饰网格与组件有轻量动态效果');
    const saved = await page.evaluate(key => localStorage.getItem(key), LAYOUTS_KEY);
    await page.locator('#jump-to-layouts').focus(); await page.keyboard.press('Tab');
    assert(await page.locator('#toggle-home-motion').evaluate(element => element === document.activeElement), '动效开关能在主要入口之后顺序用键盘到达');
    await page.keyboard.press('Space');
    assert(await hero.getAttribute('data-motion') === 'paused' && await page.locator('#toggle-home-motion').getAttribute('aria-pressed') === 'false', '用户可明确暂停动效');
    assert(await hero.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations === Infinity).every(animation => animation.playState !== 'running')), '暂停后没有仍在运行的循环装饰动画');
    assert(await page.evaluate(key => localStorage.getItem(key), HOME_MOTION_KEY) === 'paused', '只保存独立的动效偏好');
    await page.reload(); await page.locator('.layout-item').first().waitFor();
    assert(await hero.getAttribute('data-motion') === 'paused', '手动暂停偏好跨刷新保留');
    await page.locator('#toggle-home-motion').click(); await page.waitForFunction(() => document.getElementById('home-hero')!.dataset.motion === 'running');
    assert(await page.evaluate(key => localStorage.getItem(key), LAYOUTS_KEY) === saved, '动效开关不改变布局或最近修改时间');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    assert(await hero.getAttribute('data-motion') === 'paused', '标签页进入后台时停止装饰动画');
    await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => document.getElementById('home-hero')!.dataset.motion === 'running');
    await page.locator('#hero-new-layout').click(); assert(await page.locator('#layout-form').isVisible() && await hero.getAttribute('data-motion') === 'paused', '大标题区新建入口可用，弹窗期间自动暂停装饰');
    await page.locator('#layout-form [data-cancel]').click(); await page.waitForFunction(() => document.getElementById('home-hero')!.dataset.motion === 'running');
    await page.setViewportSize({ width: 1440, height: 700 }); await frames(page);
    const compact = (await page.locator('.layout-item').first().boundingBox())!; assert(compact.y + compact.height <= 700, '矮屏压缩介绍区，第一份布局仍在首屏完整可见');
    await page.locator('#jump-to-layouts').click();
    assert(await page.locator('#layout-search').evaluate(element => element === document.activeElement) && new URL(page.url()).hash === '', '一键定位布局搜索，不干扰页面路由');
    await page.waitForFunction(() => document.getElementById('home-hero')!.dataset.motion === 'paused');
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForFunction(() => document.getElementById('home-hero')!.dataset.motion === 'running');
    await page.locator('#continue-layout').click();
    assert(new URL(page.url()).hash === layoutHash('appearance-7') && await hero.getAttribute('data-motion') === 'paused', '继续按钮准确进入最近布局，编辑时首页动画停止');
    await page.locator('#home-link').click(); await page.waitForFunction(() => document.getElementById('home-hero')!.dataset.motion === 'running');
    for (const width of [320, 390, 768, 1024, 1440]) {
      const height = width <= 390 ? 844 : 900;
      await page.setViewportSize({ width, height }); await page.evaluate(() => scrollTo(0, 0)); await frames(page);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 首页无横向溢出`);
      const item = (await page.locator('.layout-item').first().boundingBox())!; assert(item.y + item.height <= height, `${width}px 首屏完整显示第一份布局`);
      assert(await page.locator('#hero-new-layout').evaluate(element => element.getBoundingClientRect().height >= 44), `${width}px 主操作适合触控`);
      await clickable(page, 'hero-new-layout'); await clickable(page, 'continue-layout');
      if (width === 320) await page.screenshot({ path: '/tmp/componentweb-home-hero-mobile.png', fullPage: true });
    }
    await page.screenshot({ path: '/tmp/componentweb-home-hero.png' }); await audit(page, '动态首页');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await frames(page);
    assert(await page.locator('#toggle-home-motion').isDisabled() && await hero.getAttribute('data-motion') === 'paused', '系统减少动态设置即时生效');
    assert(await hero.evaluate(element => element.getAnimations({ subtree: true }).length === 0), '减少动态模式没有隐藏的循环或入场动画');
    await page.locator('#hero-new-layout').click(); await page.locator('#layout-name').fill('静态模式创建的布局'); await page.locator('#layout-form button[type="submit"]').click();
    assert(await page.locator('#project-name').textContent() === '静态模式创建的布局', '减少动态模式下新建与进入布局不受影响');
    assert(!errors.length, errors.join('; '));
  } finally { await context.close(); }

  const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const reducedPage = await reducedContext.newPage(); await reducedPage.goto(origin(source)); await reducedPage.locator('.layout-item').waitFor();
    assert(await reducedPage.locator('#home-hero').getAttribute('data-motion') === 'paused' && await reducedPage.locator('#toggle-home-motion').isDisabled(), '首次进入即尊重系统减少动态偏好');
    await audit(reducedPage, '减少动态首页'); await reducedPage.locator('#continue-layout').click(); assert(await reducedPage.locator('#editor-page').isVisible(), '静态首页仍可一键继续布局');
  } finally { await reducedContext.close(); }
  const unavailable = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  try {
    await unavailable.addInitScript(key => {
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
      Storage.prototype.getItem = function (name) { if (name === key) throw new Error('denied'); return get.call(this, name); };
      Storage.prototype.setItem = function (name, value) { if (name === key) throw new Error('denied'); set.call(this, name, value); };
    }, HOME_MOTION_KEY);
    const localPage = await unavailable.newPage(); await localPage.goto(origin(source)); await localPage.locator('.layout-item').waitFor(); await localPage.locator('#toggle-home-motion').click();
    assert(await localPage.locator('#home-hero').getAttribute('data-motion') === 'paused', '偏好存储不可用时仍能暂停');
    await localPage.locator('#continue-layout').click(); assert(await localPage.locator('#editor-page').isVisible(), '偏好存储失败不影响布局入口');
  } finally { await unavailable.close(); }
  console.log('首页视觉验证通过：居中标题、动态网格、首屏布局可达、双新建入口、继续最近布局、一键搜索、暂停持久化、离屏/后台停止、减少动态与无障碍。');
}
