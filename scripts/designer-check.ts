import type { Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createNode, initialDocument } from '../blank/src/core/model';
import { STORAGE_KEY } from '../blank/src/core/store';
import { COMBINATIONS_KEY } from '../blank/src/core/combinations';
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };

export async function checkDesigner(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const panel = { ...createNode('layout.container'), id: 'design-panel', col: 2, row: 2, colSpan: 50, rowSpan: 30, design: { width: 600, height: 360 } };
  panel.props.title = '主容器'; panel.props.borderWidth = 0; panel.layout!.padding = 0;
  const button = { ...createNode('basic.button'), id: 'edit-button', parentId: panel.id, col: 1, row: 1 };
  button.props.title = '原按钮';
  const metric = { ...createNode('data.metric'), id: 'other-metric', col: 55, row: 2 };
  const doc = { ...initialDocument(), nodes: [panel, button, metric] };
  await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc });
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(source.url()); await page.locator('.node').first().waitFor();
    const node = (id: string) => page.locator(`.node[data-id="${id}"]`);
    const pick = async (id: string) => page.locator(`.layer-item[data-id="${id}"]`).click();
    const saved = () => page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
    const title = (id: string) => node(id).locator(':scope > .component-host button span').textContent();
    const closeDiscard = async () => {
      await page.locator('#designer-back').click();
      if (await page.locator('dialog[open] [data-discard]').isVisible()) await page.locator('dialog[open] [data-discard]').click();
    };
    const original = await saved();
    await pick(panel.id); await page.locator('#edit-component').click();
    assert(await page.locator('#designer-panel').isVisible(), '选中组件进入独立网格页');
    assert(await page.locator('#workspace-heading').textContent() === '组件设计页', '页面身份明确');
    assert(await page.locator('#canvas').evaluate(element => element.style.width === '960px' && element.style.height === '720px' && element.style.getPropertyValue('--grid-cell') === '12px'), '设计网格与工作区尺寸、步长一致');
    assert(await page.locator('.node').count() === 2 && await node(metric.id).count() === 0, '只展示当前子树');
    assert(await page.locator('#delete').isDisabled(), '设计根不可误删');
    await page.locator('#designer-width').fill('9999'); await page.locator('#designer-width').dispatchEvent('change'); await page.locator('#designer-save').click();
    assert(await page.locator('#designer-panel').isVisible() && await saved() === original, '无效尺寸不能保存旧值并意外关闭设计页');
    await page.locator('#designer-width').fill('600'); await page.locator('#designer-width').press('Tab');
    await pick(button.id); await page.locator('#prop-title').fill('草稿按钮'); await page.locator('#prop-title').press('Tab');
    await page.waitForTimeout(450); assert(await saved() === original, '自动保存不会把设计草稿覆盖到主工作区');
    await page.locator('#undo').click(); assert(await title(button.id) === '原按钮', '设计页拥有独立撤销历史');
    await page.locator('#redo').click(); assert(await title(button.id) === '草稿按钮', '设计页重做');
    await page.locator('#designer-save').click(); assert(await page.locator('#designer-panel').isHidden(), '应用返回父页');
    assert(await title(button.id) === '草稿按钮' && await node(metric.id).count() === 1, '子树应用，其他组件不变');
    await page.locator('#undo').click(); assert(await title(button.id) === '原按钮', '父页只需一次撤销'); await page.locator('#redo').click();
    await page.locator('#save').click(); const afterFirstApply = await saved();

    // 双击普通组件打开下一层，其原组件成为可扩展组合中的内容。
    await pick(panel.id); await page.locator('#edit-component').click(); await page.locator('#zoom').selectOption('0.75');
    await node(button.id).dblclick();
    assert(await page.locator('#designer-breadcrumbs button').count() === 3, '多级设计面包屑');
    assert(await page.locator('#canvas').evaluate(element => element.style.width === '960px' && element.style.height === '720px'), '下一层保留工作区大小的设计网格');
    const leafId = await page.locator('.scope-root > .component-host > .node').getAttribute('data-id'); assert(leafId && leafId !== button.id, '普通组件转为可嵌套组合时保留外部 ID，内容独立');
    await pick(leafId!); await page.locator('#prop-title').fill('深层按钮'); await page.locator('#prop-title').press('Tab');
    await page.locator('#designer-save').click();
    assert(await page.locator('#designer-breadcrumbs button').count() === 2 && await page.locator('#zoom').inputValue() === '0.75', '返回上级恢复视图与缩放');
    assert(await saved() === afterFirstApply, '下层应用只进入父草稿');
    await page.locator('#designer-save').click(); await page.locator('#save').click();
    assert(await node(button.id).getAttribute('data-container') === 'true', '应用后成为真正组合容器');
    assert(await title(leafId!) === '深层按钮', '深层编辑应用成功');
    await page.locator('#undo').click(); assert(await node(button.id).getAttribute('data-container') === 'false' && await title(button.id) === '草稿按钮', '撤销时同 ID 的组件类型正确重建');
    await page.locator('#redo').click(); await page.locator('#save').click(); const applied = await saved();

    await pick(panel.id); await page.locator('#edit-component').click(); await pick(button.id); await page.locator('#edit-component').click();
    await page.locator('#designer-title').fill('未应用的嵌套修改'); await page.locator('#designer-title').press('Tab'); await page.locator('#designer-save').click();
    await page.locator('#designer-breadcrumbs button').first().click();
    assert(await page.locator('#leave-design-title').isVisible(), '离开未应用父草稿有确认');
    await page.locator('dialog[open] [data-discard]').click(); assert(await saved() === applied, '放弃父草稿不会泄漏下层修改');

    // 父页发生碰撞时，保留设计页，不吞掉用户的设计。
    await pick(panel.id); await page.locator('#edit-component').click();
    await page.locator('#designer-display-width').fill('900'); await page.locator('#designer-display-width').press('Tab'); await page.locator('#designer-save').click();
    assert(await page.locator('#designer-panel').isVisible() && await saved() === applied, '应用失败时父页不变且草稿可继续修正');
    await page.locator('#designer-display-width').fill('600'); await page.locator('#designer-display-width').press('Tab'); await closeDiscard();

    await page.getByRole('button', { name: '我的组合', exact: true }).click(); await page.locator('#create-combination').click();
    assert(await page.locator('#designer-panel').isVisible() && await page.locator('.node').count() === 1, '单独创建进入空白组件设计页');
    await page.locator('#designer-title').fill('独立设计组合'); await page.locator('#designer-title').press('Tab');
    await page.locator('#designer-width').fill('360'); await page.locator('#designer-width').press('Tab'); await page.locator('#designer-height').fill('240'); await page.locator('#designer-height').press('Tab');
    await page.getByRole('button', { name: '常用组件', exact: true }).click(); await page.getByRole('button', { name: '添加操作按钮', exact: true }).click();
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert(!audit.violations.length, `独立设计页无障碍：${JSON.stringify(audit.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })))}`);
    await page.screenshot({ path: '/tmp/componentweb-designer.png', fullPage: true });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 组件设计页无页面横向溢出`);
      if (width === 320) await page.screenshot({ path: '/tmp/componentweb-designer-mobile.png', fullPage: true });
    }
    await page.locator('#designer-save').click(); await page.locator('#combination-form button[type="submit"]').click();
    assert(await page.locator('#designer-panel').isHidden() && await page.locator('.combination-tile').count() === 1, '创建结果保存到我的组合');
    assert(await saved() === applied, '创建组合不污染主布局');
    const itemId = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!)[0].id, COMBINATIONS_KEY);
    await page.getByRole('button', { name: '设计组合 独立设计组合', exact: true }).click();
    await page.locator('#designer-title').fill('模板内容新版'); await page.locator('#designer-title').press('Tab');
    await page.locator('#designer-save').click(); await page.locator('#combination-name').fill('已更新的组合'); await page.locator('#combination-form button[type="submit"]').click();
    const templates = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), COMBINATIONS_KEY);
    assert(templates.length === 1 && templates[0].id === itemId && templates[0].name === '已更新的组合', '设计已有组合会更新原记录而非重复追加');
    assert(await saved() === applied, '编辑库中组合不改动已放置实例');

    // 工具栏单独设计容器，添加时才在父页寻找空位。
    const canvas = (await page.locator('#canvas').boundingBox())!; await page.mouse.click(canvas.x + 850, canvas.y + 500);
    await page.locator('#new-container').click(); await page.locator('#designer-save').click();
    assert(await page.locator('#designer-panel').isVisible(), '父页无空间时不丢弃新组件草稿');
    await page.locator('#designer-display-width').fill('240'); await page.locator('#designer-display-width').press('Tab'); await page.locator('#designer-display-height').fill('120'); await page.locator('#designer-display-height').press('Tab');
    await page.locator('#designer-save').click(); assert(await page.locator('#designer-panel').isHidden(), '调整尺寸后可将独立设计插回父页');
    await page.locator('#undo').click(); await page.locator('#save').click(); assert(await saved() === applied, '新组件插入可一次撤销');
    assert(!errors.length, `设计页运行错误：${errors.join('; ')}`);
    console.log('组件设计页验证通过：隔离草稿、多级导航、独立历史、应用/取消、无空间保护、库中新建与编辑。');
  } finally { await context.close(); }
}
