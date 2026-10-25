import type { Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createNode, initialDocument, parseDocument } from '../blank/src/core/model';
import { LAYOUTS_KEY, type SavedLayout } from '../blank/src/core/layouts';
import { layoutHash } from '../blank/src/core/layout-route';
import { STORAGE_KEY } from '../blank/src/core/store';
const assert = (value: unknown, label: string) => { if (!value) throw new Error(label); };
const change = async (page: Page, id: string, value: string) => { await page.locator(`#${id}`).fill(value); await page.locator(`#${id}`).press('Tab'); };
const items = (page: Page): Promise<SavedLayout[]> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).items, LAYOUTS_KEY);
const home = async (page: Page) => { await page.locator('#home-link').click(); await page.locator('#layout-home').waitFor({ state: 'visible' }); };
const selectHome = async (page: Page, id: string) => { await page.locator(`.layout-item[data-layout-id="${id}"]`).click(); await page.locator('#editor-page').waitFor({ state: 'visible' }); };
const openRecent = async (page: Page) => { if (await page.locator('#recent-layout-menu').isHidden()) await page.locator('#layout-switcher').click(); };
const selectRecent = async (page: Page, id: string) => { await openRecent(page); await page.locator(`.recent-layout-item[data-layout-id="${id}"]`).click(); };
const rootURL = (source: Page) => { const url = new URL(source.url()); url.hash = ''; return url.href; };
async function audit(page: Page, name: string) { const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); assert(!result.violations.length, `${name} 无障碍：${JSON.stringify(result.violations.map(item => item.id))}`); }

async function checkWorkflow(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const root = { ...createNode('layout.container'), id: 'home-seed-root', col: 2, row: 2 }; root.layout!.padding = 0; root.props.borderWidth = 0;
  const child = { ...createNode('basic.button'), id: 'home-seed-child', parentId: root.id, col: 2, row: 2 };
  const doc = parseDocument(JSON.stringify({ ...initialDocument(), nodes: [root, child] }));
  await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(rootURL(source)); await page.locator('.layout-item').waitFor();
    assert(await page.locator('#layout-home').isVisible() && await page.locator('#editor-page').isHidden(), '启动停留布局库首页，必须明确选择布局');
    assert(await page.locator('#editor-page').evaluate(element => (element as HTMLElement).inert) && await page.locator('#editor-actions').isHidden() && await page.locator('#canvas .node').count() === 0, '首页隔离编辑操作，且不会挂载或运行隐藏布局的组件');
    let all = await items(page); const first = all[0]!;
    assert(all.length === 1 && JSON.stringify(first.document) === JSON.stringify(doc), '旧单布局完整迁入首页，保留原 ID 和子树');
    const unchanged = JSON.stringify(all); await page.keyboard.press('Delete'); await page.keyboard.press('Shift+F10'); assert(await page.locator('#context-menu').isHidden() && JSON.stringify(await items(page)) === unchanged, '首页快捷键不会修改隐藏工作区或打开工作台菜单');
    await audit(page, '布局库首页');
    await page.locator('#new-layout').click(); await page.locator('#layout-form [data-cancel]').click(); assert((await items(page)).length === 1, '取消新建不添加记录');
    await selectHome(page, first.id);
    assert(new URL(page.url()).hash === layoutHash(first.id) && await page.locator('#component-library').isVisible(), '选择布局进入独立地址，编辑器只显示组件库');
    assert(await page.locator('#show-layouts,#show-components,.library #layout-list').count() === 0, '左侧不再混入布局库入口或列表');
    await page.locator('#save').click(); assert((await items(page)).length === 1, '保存只更新当前布局');
    await home(page); assert(await page.locator('#canvas .node').count() === 0, '返回首页销毁工作区节点，停止隐藏的媒体和预览组件'); const firstTime = (await items(page))[0]!.updatedAt;
    await page.goBack(); await page.locator('#editor-page').waitFor({ state: 'visible' });
    await page.goForward(); await page.locator('#layout-home').waitFor({ state: 'visible' });
    assert((await items(page))[0]!.updatedAt === firstTime, '返回首页和浏览器前进后退不改变修改时间');

    await page.locator('#new-layout').click(); await page.locator('#layout-name').fill('   '); await page.locator('#layout-form button[type="submit"]').click();
    assert((await page.locator('#layout-error').textContent())?.includes('布局名称') && (await items(page)).length === 1, '拒绝空白名称且留在首页弹窗');
    await page.locator('#layout-name').fill('首页布局'); await audit(page, '新建布局弹窗'); await page.locator('#layout-form button[type="submit"]').click();
    await page.locator('#empty-state').waitFor({ state: 'visible' }); all = await items(page); const second = all.find(item => item.name === '首页布局')!;
    assert(all.length === 2 && second.document.nodes.length === 0 && await page.locator('#project-name').textContent() === second.name, '首页新建空白布局后直接进入该布局');
    assert(await page.locator('#undo').isDisabled(), '新布局拥有独立历史');
    await page.getByRole('button', { name: '添加操作按钮', exact: true }).click(); const secondNode = await page.locator('#canvas > .node').getAttribute('data-id');
    await change(page, 'prop-title', '首页独有按钮'); await page.locator('#save').click();
    assert((await items(page)).find(item => item.id === second.id)!.document.nodes[0]!.props.title === '首页独有按钮', '保存更新当前布局而非新建副本');
    await selectRecent(page, first.id); assert(await page.locator('#canvas .node').count() === 2 && await page.locator('#undo').isDisabled(), '导航栏切换后恢复旧布局完整子树，历史不混入其他布局');
    await page.locator(`.layer-item[data-id="${child.id}"]`).click(); await change(page, 'prop-title', '切换前保存到正确布局');
    await selectRecent(page, second.id); await page.waitForTimeout(500); all = await items(page);
    assert(all.find(item => item.id === first.id)!.document.nodes.find(node => node.id === child.id)!.props.title === '切换前保存到正确布局', '导航切换前保存尚未到期的修改');
    assert(all.find(item => item.id === second.id)!.document.nodes[0]!.props.title === '首页独有按钮' && await page.locator('#undo').isEnabled(), '旧定时器不覆盖新布局，并保留各自历史');
    await page.locator('#undo').click(); await page.locator('#redo').click(); await page.locator('#save').click();
    const address = page.url(); await page.reload(); assert(page.url() === address && await page.locator('#project-name').textContent() === second.name, '刷新布局地址仍进入同一布局');

    await page.locator(`.layer-item[data-id="${secondNode}"]`).click(); await page.keyboard.press('Shift+F10'); await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click();
    await change(page, 'prop-title', '完成组件编辑后保存'); await openRecent(page);
    assert(await page.locator('.recent-layout-item:enabled').count() === 0 && await page.locator('#all-layouts').isDisabled(), '组件编辑期间可查看最近列表但不能切换或返回首页');
    await page.keyboard.press('Escape'); assert(await page.locator('#recent-layout-menu').isHidden(), '禁用列表仍能通过 Escape 关闭');
    await page.locator('#home-link').click(); assert(await page.locator('#inline-editor').isVisible() && (await page.locator('#toast').textContent())?.includes('先完成'), '品牌首页入口不能绕过组件编辑门禁');
    await page.goBack(); await page.waitForFunction(hash => location.hash === hash, layoutHash(second.id));
    assert(await page.locator('#inline-editor').isVisible(), '浏览器后退也不能丢弃未完成草稿');
    await page.waitForTimeout(450); assert((await items(page)).find(item => item.id === second.id)!.document.nodes[0]!.props.title === '首页独有按钮', '草稿不写进布局库');
    await page.locator('#save').click();
    await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)!).items.find((item: any) => item.id === id).document.nodes[0].props.title === '完成组件编辑后保存', { key: LAYOUTS_KEY, id: second.id });

    const beforeFailure = await page.evaluate(key => localStorage.getItem(key), LAYOUTS_KEY);
    await page.evaluate(key => { const original = Storage.prototype.setItem; (window as any).restoreLayoutStorage = () => { Storage.prototype.setItem = original; }; Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('quota', 'QuotaExceededError'); original.call(this, name, value); }; }, LAYOUTS_KEY);
    await page.locator(`.layer-item[data-id="${secondNode}"]`).click(); await change(page, 'prop-title', '失败后仍保留的内容'); await selectRecent(page, first.id);
    assert(await page.locator('#project-name').textContent() === second.name && (await page.locator('#toast').textContent())?.includes('未离开'), '保存失败时不切换布局');
    await page.locator('#home-link').click(); assert(await page.locator('#editor-page').isVisible() && await page.evaluate(key => localStorage.getItem(key), LAYOUTS_KEY) === beforeFailure, '保存失败时不返回首页，也不覆盖原存档');
    await page.evaluate(() => (window as any).restoreLayoutStorage()); await page.locator('#save').click(); await home(page);
    assert((await items(page)).find(item => item.id === second.id)!.document.nodes[0]!.props.title === '失败后仍保留的内容', '恢复权限后保存完整内容再返回首页');
    await page.locator('#layout-search').fill('不存在的名称'); assert(await page.locator('#layout-empty').isVisible() && await page.locator('.layout-item').count() === 0, '首页搜索无匹配有空状态'); await page.locator('#layout-search').clear();
    assert(await page.locator('.layout-item').first().getAttribute('data-layout-id') === second.id, '首页按最近修改排序');
    await page.reload(); assert(await page.locator('#layout-home').isVisible(), '根地址刷新始终停留首页，不自动进入默认布局');
    await page.goto(rootURL(source) + '#layout=missing'); assert(await page.locator('#layout-home').isVisible() && new URL(page.url()).hash === '' && (await page.locator('#toast').textContent())?.includes('找不到'), '失效地址安全返回首页，不加载其他布局冒充目标');
    assert(!errors.length, errors.join('; '));
  } finally { await context.close(); }
}
async function checkRecentFive(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const all: SavedLayout[] = Array.from({ length: 7 }, (_, i) => {
    const node = { ...createNode('basic.button'), id: `recent-node-${i}`, col: 2, row: 2 };
    return { id: `recent-layout-${i}`, name: i === 0 ? '较早的长名称布局 <img src=x onerror=alert(1)>' : `布局 ${i + 1}`, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: new Date(Date.UTC(2024, 0, i + 1)).toISOString(), document: { ...initialDocument(), nodes: [node] } };
  });
  await context.addInitScript(({ key, all }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, items: all })); }, { key: LAYOUTS_KEY, all });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(rootURL(source)); await page.locator('.layout-item').first().waitFor();
    assert(await page.locator('.layout-item').count() === 7 && await page.locator('#layout-list img').count() === 0, '首页显示全部布局，名称按纯文本渲染');
    await selectHome(page, all[0]!.id); await page.reload(); await openRecent(page);
    const recentIds = await page.locator('.recent-layout-item').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.layoutId));
    assert(JSON.stringify(recentIds) === JSON.stringify(all.slice(2).reverse().map(item => item.id)), '最近列表准确显示按修改时间排序的五项，不额外塞入较早的当前布局');
    assert(await page.locator('#project-name').textContent() === all[0]!.name && await page.locator('.recent-layout-item[aria-current]').count() === 0, '刷新显式地址保留当前布局，浏览不会改变最近排序');
    await audit(page, '最近布局菜单'); await page.keyboard.press('Escape');
    assert(await page.locator('#layout-switcher').evaluate(element => element === document.activeElement), '关闭菜单后恢复焦点');
    await page.locator('#save').click(); await openRecent(page);
    assert(await page.locator('.recent-layout-item').count() === 5 && await page.locator('.recent-layout-item').first().getAttribute('data-layout-id') === all[0]!.id, '当前布局保存后进入最近五项首位');
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert(await page.locator('#project-name').textContent() === all[6]!.name && await page.locator('#recent-layout-menu').isHidden(), '最近菜单支持键盘选择并关闭');
    await page.locator('#layout-switcher').focus(); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter'); await page.locator('#layout-home').waitFor({ state: 'visible' });
    assert(await page.locator('.layout-item').count() === 7, '菜单全部布局入口返回完整首页');
    for (const width of [320, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 首页无横向溢出`); if (width === 320) await page.screenshot({ path: '/tmp/componentweb-layout-home-mobile.png', fullPage: true }); }
    await page.screenshot({ path: '/tmp/componentweb-layout-home.png', fullPage: true }); await audit(page, '多布局首页');
    await selectHome(page, all[0]!.id);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 }); await openRecent(page);
      assert(await page.locator('#layout-switcher').isVisible() && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 导航布局名称和菜单始终可用且不溢出`);
      const box = (await page.locator('#recent-layout-menu').boundingBox())!; assert(box.x >= 0 && box.x + box.width <= width + 0.5, `${width}px 最近布局菜单不超出屏幕`);
      if (width === 320) await page.screenshot({ path: '/tmp/componentweb-layout-recent-mobile.png' }); await page.keyboard.press('Escape');
    }
    await openRecent(page); await page.screenshot({ path: '/tmp/componentweb-layout-recent.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 340 }); await openRecent(page); await page.keyboard.press('End');
    const menuBox = (await page.locator('#recent-layout-menu').boundingBox())!, lastBox = (await page.locator('#all-layouts').boundingBox())!;
    assert(lastBox.y >= menuBox.y && lastBox.y + lastBox.height <= menuBox.y + menuBox.height + 1, '矮屏菜单键盘选中项自动滚动到可见位置');
    assert(!errors.length, errors.join('; '));
  } finally { await context.close(); }
}
export async function checkLayoutLibrary(source: Page) {
  await checkWorkflow(source); await checkRecentFive(source);
  console.log('首页与最近布局验证通过：独立首页、选择/新建、最近五项、当前保存、地址恢复、前进后退、草稿/失败门禁、键盘及四档响应式。');
}
