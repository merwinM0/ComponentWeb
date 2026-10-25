import type { Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createNode, initialDocument, parseDocument } from '../blank/src/core/model';
import { LAYOUTS_KEY, type SavedLayout } from '../blank/src/core/layouts';
import { STORAGE_KEY } from '../blank/src/core/store';
const assert = (value: unknown, label: string) => { if (!value) throw new Error(label); };
const change = async (page: Page, id: string, value: string) => { await page.locator(`#${id}`).fill(value); await page.locator(`#${id}`).press('Tab'); };
const items = (page: Page): Promise<SavedLayout[]> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).items, LAYOUTS_KEY);
const select = async (page: Page, id: string) => page.locator(`.layout-item[data-layout-id="${id}"]`).click();

export async function checkLayoutLibrary(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const root = { ...createNode('layout.container'), id: 'layout-seed-root', col: 2, row: 2 };
  root.layout!.padding = 0; root.props.borderWidth = 0;
  const child = { ...createNode('basic.button'), id: 'layout-seed-child', parentId: root.id, col: 2, row: 2 };
  const doc = parseDocument(JSON.stringify({ ...initialDocument(), nodes: [root, child] }));
  await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(source.url()); await page.locator(`#canvas .node[data-id="${root.id}"]`).waitFor();
    assert(await page.locator('#component-library').isVisible() && await page.locator('#layout-library').isHidden(), '默认显示组件库，布局库不会自动打开');
    let all = await items(page); const first = all[0]!;
    assert(all.length === 1 && JSON.stringify(first.document) === JSON.stringify(doc), '旧工作区完整迁入默认布局，保留嵌套结构与坐标');
    await page.locator('#save').click(); assert((await items(page)).length === 1 && await page.locator('#layout-library').isHidden(), '保存更新当前布局，不复制、不自动切库');
    await page.getByRole('button', { name: '切换到布局库', exact: true }).click();
    assert(await page.locator('#layout-library').isVisible() && await page.locator('#component-library').isHidden(), '手动切换后显示布局库');
    await page.locator('#new-layout').click(); await page.locator('#layout-form [data-cancel]').click(); assert((await items(page)).length === 1, '取消新建不增加记录');
    await page.locator('#new-layout').click(); await page.locator('#layout-name').fill('首页布局'); await page.locator('#layout-form button[type="submit"]').click();
    await page.locator('#empty-state').waitFor({ state: 'visible' });
    all = await items(page); const second = all.find(item => item.name === '首页布局')!;
    assert(all.length === 2 && second.document.nodes.length === 0 && await page.locator('#workspace-heading').textContent() === '首页布局', '新建命名空白布局，并切换为当前布局');
    assert(await page.locator('#undo').isDisabled() && await page.locator('#layout-library').isVisible(), '新布局有独立历史，且库视图只由用户切换');
    await page.getByRole('button', { name: '切换到组件库', exact: true }).click();
    await page.getByRole('button', { name: '添加操作按钮', exact: true }).click();
    const secondNode = await page.locator('#canvas > .node').getAttribute('data-id'); assert(secondNode, '空白布局可正常添加素材');
    await change(page, 'prop-title', '首页独有按钮'); await page.locator('#save').click();
    all = await items(page);
    assert(all.length === 2 && all.find(item => item.id === second.id)!.document.nodes[0]!.props.title === '首页独有按钮', '保存到当前布局，不新增记录');
    assert(JSON.stringify(all.find(item => item.id === first.id)!.document) === JSON.stringify(first.document), '修改新布局不覆盖旧布局');
    await page.locator('#show-layouts').click(); await select(page, first.id);
    assert(await page.locator('#canvas .node').count() === 2 && await page.locator('#undo').isDisabled(), '切回旧布局恢复整棵树，不混入其他布局的历史');
    await select(page, second.id); assert(await page.locator('#undo').isEnabled(), '切回已编辑布局保留该布局自己的历史');
    await page.locator('#undo').click(); assert(await page.locator('#prop-title').count() === 0, '切换布局已清空旧选区');
    await page.locator('#redo').click(); await page.locator('#save').click();
    await select(page, first.id); const secondTime = (await items(page)).find(item => item.id === second.id)!.updatedAt;
    await page.reload();
    assert(await page.locator('#workspace-heading').textContent() === '首页布局', '启动打开最近修改的布局，而非最后浏览的布局');
    assert(await page.locator('#component-library').isVisible() && await page.locator('#layout-library').isHidden(), '刷新后仍默认显示组件库');
    assert((await items(page)).find(item => item.id === second.id)!.updatedAt === secondTime, '单纯浏览和刷新不更改修改时间');

    // 不等自动保存定时器，立即切到另一布局，内容也必须准确归属。
    await page.locator('#show-layouts').click(); await select(page, first.id);
    await page.locator(`.layer-item[data-id="${child.id}"]`).click(); await change(page, 'prop-title', '切换前自动保存');
    await select(page, second.id); await page.waitForTimeout(500); all = await items(page);
    assert(all.find(item => item.id === first.id)!.document.nodes.find(node => node.id === child.id)!.props.title === '切换前自动保存', '切换前同步保存尚未到期的修改');
    assert(all.find(item => item.id === second.id)!.document.nodes[0]!.props.title === '首页独有按钮', '旧定时器不会把上一布局写入新布局');
    await page.reload(); assert(await page.locator('#workspace-heading').textContent() === first.name, '自动保存后的布局成为最近修改的一份');
    await page.locator('#show-layouts').click(); await select(page, second.id); await page.locator('#save').click();
    assert(await page.locator('#layout-library').isVisible(), '手动保存不会自动切换库视图');
    await page.reload(); assert(await page.locator('#workspace-heading').textContent() === second.name, '显式保存当前布局后，下次启动恢复它');

    // 原位编辑门禁：库可以查看，但不能切换或新建而丢失草稿。
    await page.locator(`.layer-item[data-id="${secondNode}"]`).click(); await page.keyboard.press('Shift+F10');
    await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click();
    await change(page, 'prop-title', '组装完成后保存到首页'); await page.locator('#show-layouts').click();
    assert(await page.locator('#new-layout').isDisabled() && await page.locator('.layout-item:enabled').count() === 0, '组件编辑期间禁止切换和新建布局');
    await page.waitForTimeout(450);
    assert((await items(page)).find(item => item.id === second.id)!.document.nodes[0]!.props.title === '首页独有按钮', '组件草稿不写进任何布局');
    await page.locator('#save').click();
    await page.waitForFunction(({ key, id }) => JSON.parse(localStorage.getItem(key)!).items.find((item: any) => item.id === id).document.nodes[0].props.title === '组装完成后保存到首页', { key: LAYOUTS_KEY, id: second.id });
    assert(await page.locator('#new-layout').isEnabled() && await page.locator('#layout-library').isVisible(), '完成后更新当前布局、解除门禁，仍不自动切库');

    // 失败不切走，不清空当前编辑内容，也不假报保存成功。
    const beforeFailure = await page.evaluate(key => localStorage.getItem(key), LAYOUTS_KEY);
    await page.evaluate(key => {
      const original = Storage.prototype.setItem;
      (window as any).restoreLayoutStorage = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('quota', 'QuotaExceededError'); original.call(this, name, value); };
    }, LAYOUTS_KEY);
    await page.locator(`.layer-item[data-id="${secondNode}"]`).click(); await change(page, 'prop-title', '保存失败后仍保留的内容');
    await select(page, first.id);
    assert(await page.locator('#workspace-heading').textContent() === second.name && (await page.locator('#toast').textContent())?.includes('未切换'), '保存失败时留在当前布局');
    assert(await page.evaluate(key => localStorage.getItem(key), LAYOUTS_KEY) === beforeFailure, '保存失败不改原存档');
    await page.evaluate(() => (window as any).restoreLayoutStorage()); await page.locator('#save').click();
    assert((await items(page)).find(item => item.id === second.id)!.document.nodes[0]!.props.title === '保存失败后仍保留的内容', '恢复权限后可重试保存完整内容');
    await page.locator('#new-layout').click(); await page.locator('#layout-name').fill('   '); await page.locator('#layout-form button[type="submit"]').click();
    assert((await page.locator('#layout-error').textContent())?.includes('布局名称') && (await items(page)).length === 2, '拒绝空白名称，不切换或增加布局');
    await page.locator('#layout-name').fill('用于验证窄屏与长名称的独立布局');
    const dialogAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); assert(!dialogAudit.violations.length, `新建布局弹窗无障碍：${JSON.stringify(dialogAudit.violations.map(item => item.id))}`);
    await page.locator('#layout-form button[type="submit"]').click();
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 布局库无横向溢出`);
      if (width === 320) await page.screenshot({ path: '/tmp/componentweb-layout-library-mobile.png', fullPage: true });
    }
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); assert(!audit.violations.length, `布局库无障碍：${JSON.stringify(audit.violations.map(item => item.id))}`);
    await page.screenshot({ path: '/tmp/componentweb-layout-library.png', fullPage: true });
    await page.locator('#show-components').click(); await page.locator('#show-layouts').focus(); await page.keyboard.press('Enter');
    assert(await page.locator('#layout-library').isVisible(), '库切换按钮支持键盘操作');
    assert(!errors.length, errors.join('; '));
    console.log('布局库验证通过：手动切库、新建、当前布局保存、最近修改恢复、旧记录迁移、独立历史、草稿门禁、失败恢复和四档响应式。');
  } finally { await context.close(); }
}
