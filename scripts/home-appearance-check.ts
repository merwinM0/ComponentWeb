import type { Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { initialDocument, createNode } from '../blank/src/core/model';
import { LAYOUTS_KEY, type SavedLayout } from '../blank/src/core/layouts';
import { layoutHash } from '../blank/src/core/layout-route';
import { HOME_INTERACTION_KEY } from '../blank/src/editor/home-interaction';
const assert = (value: unknown, label: string) => { if (!value) throw new Error(label); };
const origin = (page: Page) => { const url = new URL(page.url()); url.hash = ''; return url.href; };
const names = ['产品首页', '商品详情', '个人中心', '登录页面', '活动专题', '设置页面', '移动端首页', '数据概览'];
const layouts: SavedLayout[] = names.map((name, index) => ({ id: `appearance-${index}`, name, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: new Date(Date.UTC(2025, 0, index + 1)).toISOString(), document: { ...initialDocument(), nodes: [{ ...createNode('basic.button'), id: `appearance-node-${index}` }] } }));
async function audit(page: Page, label: string) { const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); assert(!result.violations.length, `${label} 无障碍：${JSON.stringify(result.violations.map(item => item.id))}`); }
async function clickable(page: Page, id: string) { assert(await page.locator(`#${id}`).evaluate(element => { const box = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); }), `${id} 不被交互装饰层遮挡`); }
async function frames(page: Page) { await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))); }
async function idle(page: Page) { await page.mouse.move(-10, -10); await page.waitForFunction(() => document.getElementById('home-backdrop')!.dataset.motion === 'idle'); await page.waitForTimeout(260); }
async function fullViewport(page: Page, label: string) {
  assert(await page.locator('#home-backdrop').evaluate(element => {
    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
    return Math.abs(box.left) < .1 && Math.abs(box.top) < .1 && Math.abs(box.width - document.documentElement.clientWidth) < 1 && Math.abs(box.height - innerHeight) < 1 && style.position === 'fixed' && style.pointerEvents === 'none' && element.getAttribute('aria-hidden') === 'true' && (element as HTMLElement).inert;
  }), `${label} 背景铺满可见视口，滚动不偏移，且不命中或进入焦点`);
  assert(await page.locator('#layout-home').evaluate(element => element.getBoundingClientRect().width <= 1120), `${label} 内容仍保持可读宽度`);
}

async function checkPointer(source: Page) {
  const browser = source.context().browser()!, context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  await context.addInitScript(({ key, layouts }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, items: layouts })); }, { key: LAYOUTS_KEY, layouts });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(origin(source)); await page.locator('.layout-item').first().waitFor(); await idle(page);
    const hero = page.locator('#home-hero'), backdrop = page.locator('#home-backdrop'); await fullViewport(page, '初始首页');
    assert(await page.locator('#home-heading').evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 48 && getComputedStyle(element.parentElement!).textAlign === 'center'), '首页保持居中大标题');
    assert(await page.locator('#hero-latest-name').textContent() === '数据概览', '快捷继续指向最近修改的布局');
    assert(await hero.evaluate(element => element.getAnimations({ subtree: true }).length === 0) && await backdrop.evaluate(element => element.getAnimations({ subtree: true }).length === 0), '整屏没有输入时完全静止，没有自动漂浮、扫描或入场动画');
    const idleFrames = await page.evaluate(() => new Promise<number>(resolve => { const original = requestAnimationFrame; let count = 0; window.requestAnimationFrame = callback => { count++; return original.call(window, callback); }; setTimeout(() => { window.requestAnimationFrame = original; resolve(count); }, 250); }));
    assert(idleFrames === 0, '空闲时不安排渲染帧');
    const baseTransform = await page.locator('.hero-piece-card').evaluate(element => getComputedStyle(element).transform);
    const before = await page.evaluate(key => localStorage.getItem(key), LAYOUTS_KEY), title = (await page.locator('#home-heading').boundingBox())!, action = (await page.locator('#hero-new-layout').boundingBox())!;
    const box = (await hero.boundingBox())!;
    await page.mouse.move(box.x + 100, box.y + 120); await page.waitForFunction(() => document.getElementById('home-hero')!.dataset.motion === 'interacting'); await frames(page);
    const firstX = await backdrop.evaluate(element => (element as HTMLElement).style.getPropertyValue('--pointer-x'));
    await page.mouse.move(box.x + box.width - 90, box.y + box.height - 60); await page.waitForTimeout(230);
    assert(await backdrop.evaluate(element => (element as HTMLElement).style.getPropertyValue('--pointer-x')) !== firstX, '整屏网格光照跟随鼠标位置');
    assert(await page.locator('.hero-piece-card').evaluate(element => getComputedStyle(element).transform) !== baseTransform, '组件预览响应指针偏转');
    const afterTitle = (await page.locator('#home-heading').boundingBox())!, afterAction = (await page.locator('#hero-new-layout').boundingBox())!;
    assert(Math.abs(title.x - afterTitle.x) < .1 && Math.abs(title.y - afterTitle.y) < .1 && Math.abs(action.x - afterAction.x) < .1 && Math.abs(action.y - afterAction.y) < .1, '标题与主按钮不会跟随鼠标移动');
    await clickable(page, 'hero-new-layout'); await clickable(page, 'continue-layout'); await clickable(page, 'toggle-home-interaction'); await clickable(page, 'home-link');
    for (const [x, y] of [[8, 80], [1432, 80], [8, 892], [1432, 892]]) {
      await page.mouse.move(x, y); await frames(page);
      assert(await backdrop.evaluate((element, point) => parseFloat((element as HTMLElement).style.getPropertyValue('--pointer-x')) === point.x && parseFloat((element as HTMLElement).style.getPropertyValue('--pointer-y')) === point.y, { x, y }), `内容框外 ${x}/${y} 也响应指针，采用视口而非介绍区坐标`);
      assert(await page.locator('.hero-cell').evaluate(element => { const box = element.getBoundingClientRect(); return box.left >= 0 && box.top >= 0 && box.right <= document.documentElement.clientWidth + .1 && box.bottom <= innerHeight + .1; }), '四角选框不超出屏幕');
    }
    const scheduled = await page.evaluate(() => {
      const root = document.getElementById('home-hero')!, box = root.getBoundingClientRect(), original = requestAnimationFrame; let count = 0;
      window.requestAnimationFrame = callback => { count++; return original.call(window, callback); };
      for (let i = 0; i < 100; i++) root.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: box.x + 40 + i, clientY: box.y + 100 }));
      window.requestAnimationFrame = original; return count;
    });
    assert(scheduled === 1, '一批鼠标移动只安排一次渲染帧，不启动持续循环'); await frames(page);
    await page.mouse.move(12, box.y + box.height - 28); await page.mouse.down(); await page.mouse.up();
    assert(await page.locator('#hero-pulse').evaluate(element => element.getAnimations().some(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations === 1)), '点击内容框外的空白区域也产生一次短暂反馈');
    await page.mouse.move(1428, 880); await frames(page);
    assert(await page.locator('#hero-pulse').evaluate(element => (element as HTMLElement).style.getPropertyValue('--pulse-x') === '12px'), '点击反馈停留在点击处，不随之后的鼠标漂移');
    await idle(page);
    assert(await page.locator('.hero-spotlight').evaluate(element => getComputedStyle(element).opacity === '0') && await hero.evaluate(element => element.getAnimations({ subtree: true }).length === 0), '移开指针后归位并停止动画');
    const row = page.locator('.layout-item').first(), rowBox = (await row.boundingBox())!;
    await page.mouse.move(rowBox.x + 60, rowBox.y + 24); await page.waitForFunction(() => !!document.querySelector('.layout-item[data-pointer="true"]'));
    const rowX = await row.evaluate(element => (element as HTMLElement).style.getPropertyValue('--row-x'));
    await page.mouse.move(rowBox.x + 260, rowBox.y + 24); await frames(page);
    assert(await row.evaluate(element => (element as HTMLElement).style.getPropertyValue('--row-x')) !== rowX, '布局行高亮也随鼠标移动，列表本身保持不动');
    const rowFrames = await row.evaluate(element => {
      const box = element.getBoundingClientRect(), original = requestAnimationFrame; let count = 0;
      window.requestAnimationFrame = callback => { count++; return original.call(window, callback); };
      for (let i = 0; i < 100; i++) element.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: box.x + 40 + i, clientY: box.y + 24 }));
      window.requestAnimationFrame = original; return count;
    });
    assert(rowFrames === 1, '整屏背景与布局行高亮共享一帧，不重复调度'); await frames(page);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForFunction(() => document.getElementById('home-hero')!.dataset.motion === 'paused'); await fullViewport(page, '滚动到布局列表');
    await page.mouse.move(12, 880); await frames(page);
    assert(await backdrop.getAttribute('data-motion') === 'interacting' && await backdrop.evaluate(element => (element as HTMLElement).style.getPropertyValue('--pointer-y') === '880px'), '介绍区离屏后，整屏背景仍响应，且坐标不叠加滚动距离');
    await page.waitForTimeout(230); await page.screenshot({ path: '/tmp/componentweb-home-fullscreen-scrolled.png' });
    await page.evaluate(() => scrollTo(0, 0)); await idle(page); await page.screenshot({ path: '/tmp/componentweb-home-interaction-idle.png' });
    await page.mouse.move(box.x + 105, box.y + 170); await page.waitForTimeout(230); await page.screenshot({ path: '/tmp/componentweb-home-interaction.png' }); await audit(page, '交互首页');
    await page.locator('#jump-to-layouts').focus(); await page.keyboard.press('Tab');
    assert(await page.locator('#toggle-home-interaction').evaluate(element => element === document.activeElement), '交互开关可以顺序用键盘到达');
    await page.keyboard.press('Space'); assert(await hero.getAttribute('data-motion') === 'paused', '用户可以关闭交互增强');
    assert(await page.evaluate(key => localStorage.getItem(key), HOME_INTERACTION_KEY) === 'paused', '沿用原先的关闭偏好，不重置用户选择');
    await page.reload(); await page.locator('.layout-item').first().waitFor(); assert(await hero.getAttribute('data-motion') === 'paused', '关闭偏好跨刷新保留');
    await page.locator('#toggle-home-interaction').click(); await idle(page);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    assert(await hero.getAttribute('data-motion') === 'paused', '后台停止响应并清理交互状态');
    await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); }); await idle(page);
    await page.locator('#hero-new-layout').click(); assert(await page.locator('#layout-form').isVisible() && await hero.getAttribute('data-motion') === 'paused', '新建弹窗不被交互层拦截，背景停止响应');
    await page.locator('#layout-form [data-cancel]').click(); await idle(page);
    assert(await page.evaluate(key => localStorage.getItem(key), LAYOUTS_KEY) === before, '指针、点击、交互开关和浏览不会改写布局或修改时间');
    await page.setViewportSize({ width: 1440, height: 700 }); await frames(page);
    const compact = (await page.locator('.layout-item').first().boundingBox())!; assert(compact.y + compact.height <= 700, '矮屏首屏完整显示第一份布局');
    await page.locator('#jump-to-layouts').click(); assert(await page.locator('#layout-search').evaluate(element => element === document.activeElement) && new URL(page.url()).hash === '', '一键定位搜索，不改变路由');
    await page.waitForFunction(() => document.getElementById('home-hero')!.dataset.motion === 'paused');
    await page.evaluate(() => scrollTo(0, 0)); await idle(page); await page.locator('#continue-layout').click();
    assert(new URL(page.url()).hash === layoutHash('appearance-7') && await hero.getAttribute('data-motion') === 'paused' && await backdrop.isHidden(), '继续准确进入最近布局，并清理和隐藏整屏背景');
    await page.locator('#home-link').click(); await idle(page);
    for (const width of [320, 390, 768, 1024, 1440, 2560, 3440]) {
      const height = width <= 390 ? 844 : 900; await page.setViewportSize({ width, height }); await page.evaluate(() => scrollTo(0, 0)); await frames(page);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 无横向溢出`); await fullViewport(page, `${width}px`);
      const first = (await page.locator('.layout-item').first().boundingBox())!; assert(first.y + first.height <= height, `${width}px 首屏完整显示第一份布局`);
      assert(await page.locator('#hero-new-layout').evaluate(element => element.getBoundingClientRect().height >= 44), `${width}px 主操作适合触控`); await clickable(page, 'hero-new-layout'); await clickable(page, 'continue-layout');
      if (width === 320) await page.screenshot({ path: '/tmp/componentweb-home-interaction-mobile.png', fullPage: true });
      if (width === 2560) { await page.mouse.move(80, 300); await page.waitForTimeout(230); await page.screenshot({ path: '/tmp/componentweb-home-fullscreen-wide.png' }); }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' }); await frames(page);
    assert(await page.locator('#toggle-home-interaction').isDisabled() && await hero.getAttribute('data-motion') === 'paused', '减少动态偏好即时停用增强');
    const reducedBox = (await hero.boundingBox())!; await page.mouse.move(reducedBox.x + 80, reducedBox.y + 100); await page.mouse.down(); await page.mouse.up();
    assert(await hero.getAttribute('data-motion') === 'paused' && await hero.evaluate(element => element.getAnimations({ subtree: true }).length === 0) && await backdrop.evaluate(element => element.getAnimations({ subtree: true }).length === 0), '减少动态时整屏鼠标和点击都不会触发动画');
    await page.locator('#hero-new-layout').click(); await page.locator('#layout-name').fill('静态模式创建的布局'); await page.locator('#layout-form button[type="submit"]').click();
    assert(await page.locator('#project-name').textContent() === '静态模式创建的布局', '关闭效果不影响新建布局'); assert(!errors.length, errors.join('; '));
  } finally { await context.close(); }
}
async function checkTouch(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  await context.addInitScript(({ key, layouts }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, items: layouts })); }, { key: LAYOUTS_KEY, layouts });
  try {
    const page = await context.newPage(); await page.goto(origin(source)); await page.locator('.layout-item').first().waitFor();
    const box = (await page.locator('#home-hero').boundingBox())!; await fullViewport(page, '触屏首页'); await page.touchscreen.tap(6, box.y + box.height / 2);
    assert(await page.locator('#hero-pulse').evaluate(element => element.getAnimations().length > 0), '触屏轻点内容外侧背景也有短暂反馈');
    await page.screenshot({ path: '/tmp/componentweb-home-interaction-touch.png' });
    await page.waitForFunction(() => document.getElementById('home-hero')!.dataset.motion === 'idle');
    const client = await context.newCDPSession(page), start = box.y + box.height / 2;
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 6, y: start }] });
    for (let i = 1; i <= 8; i++) { await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 6, y: start - i * 12 }] }); await page.waitForTimeout(20); }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForFunction(() => scrollY > 0); await fullViewport(page, '触屏滚动后');
    await page.evaluate(() => scrollTo(0, 0)); await page.locator('#continue-layout').tap(); assert(await page.locator('#editor-page').isVisible(), '触屏滚动与打开布局不被效果接管');
  } finally { await context.close(); }
}
export async function checkHomeAppearance(source: Page) {
  await checkPointer(source); await checkTouch(source);
  const browser = source.context().browser()!, reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try { const page = await reduced.newPage(); await page.goto(origin(source)); await page.locator('.layout-item').waitFor(); assert(await page.locator('#toggle-home-interaction').isDisabled(), '首次进入尊重系统减少动态'); await audit(page, '静态首页'); await page.locator('#continue-layout').click(); assert(await page.locator('#editor-page').isVisible(), '静态模式仍能继续布局'); } finally { await reduced.close(); }
  const unavailable = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  try {
    await unavailable.addInitScript(key => { const get = Storage.prototype.getItem, set = Storage.prototype.setItem; Storage.prototype.getItem = function (name) { if (name === key) throw new Error('denied'); return get.call(this, name); }; Storage.prototype.setItem = function (name, value) { if (name === key) throw new Error('denied'); set.call(this, name, value); }; }, HOME_INTERACTION_KEY);
    const page = await unavailable.newPage(); await page.goto(origin(source)); await page.locator('.layout-item').waitFor(); await page.locator('#toggle-home-interaction').click(); assert(await page.locator('#home-hero').getAttribute('data-motion') === 'paused', '偏好存储不可用时也能关闭交互'); await page.locator('#continue-layout').click(); assert(await page.locator('#editor-page').isVisible(), '偏好失败不影响布局入口');
  } finally { await unavailable.close(); }
  console.log('整屏首页验证通过：视口铺满、四角/留白跟随、滚动不偏移、宽屏内容限宽、默认静止、单次点击、共用一帧、触屏滚动、静态偏好、可达性与数据隔离。');
}
