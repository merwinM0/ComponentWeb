import type { Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createNode, initialDocument } from '../blank/src/core/model';
import { STORAGE_KEY } from '../blank/src/core/store';
import { COMBINATIONS_KEY } from '../blank/src/core/combinations';
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const change = async (page: Page, id: string, value: string) => { await page.locator(`#${id}`).fill(value); await page.locator(`#${id}`).press('Tab'); };
const node = (page: Page, id: string) => page.locator(`#canvas .node[data-id="${id}"]`);
const pick = async (page: Page, id: string) => page.locator(`.layer-item[data-id="${id}"]`).click();
const saved = (page: Page) => page.evaluate(key => localStorage.getItem(key)!, STORAGE_KEY);
const size = async (page: Page, id: string, width: number, height: number, label: string) => { const box = (await node(page, id).boundingBox())!; assert(Math.abs(box.width - width) < 0.6 && Math.abs(box.height - height) < 0.6, `${label}：${box.width}×${box.height}，预期 ${width}×${height}`); };
async function edit(page: Page, id: string) {
  await pick(page, id); await page.keyboard.press('Shift+F10'); await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click();
}
async function selectTag(page: Page, tag: string) {
  const value = await page.locator('#element-select option').evaluateAll((options, tag) => (options.find(option => option.textContent?.includes(`<${tag}>`)) as HTMLOptionElement)?.value, tag);
  assert(value, `存在可编辑标签 ${tag}`); await page.locator('#element-select').selectOption(value);
}
async function dragTile(page: Page, type: string, x: number, y: number) {
  const tile = (await page.locator(`.component-tile[data-type="${type}"] .tile-preview`).boundingBox())!;
  await page.mouse.move(tile.x + 20, tile.y + 20); await page.mouse.down(); await page.mouse.move(x, y, { steps: 12 }); await page.mouse.up();
}
async function checkNative(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const card = { ...createNode('content.card'), id: 'inline-card', col: 2, row: 2 }, other = { ...createNode('data.metric'), id: 'inline-other', col: 50, row: 8 };
  await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc: { ...initialDocument(), nodes: [card, other] } });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(source.url()); await node(page, card.id).waitFor(); await page.waitForTimeout(400); const original = await saved(page), url = page.url();
    assert(await page.locator('.canvas-heading,#designer-panel,#edit-component,.edit-design-button').count() === 0, '无旧标题和非右键编辑入口');
    await node(page, card.id).dblclick(); assert(await page.locator('#inline-editor').isHidden(), '双击不进入编辑、不新增层级');
    await node(page, card.id).click({ button: 'right' }); await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click();
    assert(page.url() === url && await page.locator('#context-layer').evaluate(element => (element as HTMLElement).inert && getComputedStyle(element).opacity === '0.24'), '仍在当前工作区，其他组件变暗只读');
    const handle = node(page, card.id).locator(':scope > .resize-handle'); assert(await handle.isVisible(), '普通组件进入编辑后也有缩放手柄');
    await page.locator('#zoom').selectOption('0.75');
    let box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 18, box.y + box.height / 2 + 9, { steps: 8 }); await page.mouse.up();
    await size(page, card.id, 312 * 0.75, 204 * 0.75, '75% 画布下手柄正确调整编辑组件宽高');
    await page.locator('#zoom').selectOption('1');
    await change(page, 'prop-colSpan', '600'); await change(page, 'prop-rowSpan', '480');
    await size(page, card.id, 600, 480, '属性宽高立即改变当前编辑框，不只影响完成后尺寸');
    assert(await page.locator('#inline-width').inputValue() === '600', '工具条与属性宽高同步');
    await change(page, 'inline-width', '624'); await size(page, card.id, 624, 480, '工具条宽高立即可见'); await change(page, 'inline-width', '600');
    await selectTag(page, 'h3'); await change(page, 'element-text', '原位标签新标题'); await change(page, 'element-font-size', '24'); await change(page, 'element-color', '#FFFFFF'); await change(page, 'element-width', '180');
    await page.locator('#undo').click(); await page.locator('#redo').click(); assert(await node(page, card.id).locator('h3').textContent() === '原位标签新标题', '内容与样式可修改及撤销重做');
    await change(page, 'element-x', '3000'); await size(page, card.id, 600, 480, '标签越界不能撑大组件'); assert(await page.locator('#element-x').inputValue() === '0', '越界属性回退');
    await change(page, 'element-font-size', '200'); assert(await page.locator('#element-font-size').inputValue() === '24', '字号导致内容越界时拒绝，而非自动扩展');
    await page.locator('#zoom').selectOption('0.75'); let tag = (await node(page, card.id).locator('h3').boundingBox())!;
    await page.mouse.move(tag.x + tag.width / 2, tag.y + tag.height / 2); await page.mouse.down(); await page.mouse.move(tag.x + tag.width / 2 + 9, tag.y + tag.height / 2 + 9, { steps: 8 }); await page.mouse.up();
    assert(await page.locator('#element-x').inputValue() === '12' && await page.locator('#element-y').inputValue() === '12', '标签按内部网格移动');
    await page.locator('#zoom').selectOption('1'); tag = (await node(page, card.id).locator('h3').boundingBox())!;
    const rootBox = (await node(page, card.id).boundingBox())!;
    await page.mouse.move(tag.x + tag.width / 2, tag.y + tag.height / 2); await page.mouse.down(); await page.mouse.move(rootBox.x + rootBox.width + 90, tag.y + tag.height / 2, { steps: 10 }); await page.mouse.up();
    const boundedTag = (await node(page, card.id).locator('h3').boundingBox())!;
    assert(boundedTag.x + boundedTag.width <= rootBox.x + rootBox.width + 0.6, '标签拖动被限制在被编辑组件内'); await size(page, card.id, 600, 480, '标签拖动不改变外框');
    const level = await page.locator('#edit-breadcrumbs button').count(); await node(page, card.id).locator('h3').dblclick();
    assert(await page.locator('#edit-breadcrumbs button').count() === level, '编辑中双击标签也不会再建一层');
    await page.getByRole('button', { name: '添加操作按钮', exact: true }).click();
    const added = await page.locator('#canvas > .node.selected').getAttribute('data-id'); assert(added && added !== card.id, '框内新增散件');
    const before = (await node(page, added!).boundingBox())!;
    await page.mouse.move(before.x + 20, before.y + 20); await page.keyboard.down('Alt'); await page.mouse.down(); await page.mouse.move(rootBox.x + rootBox.width + 100, before.y + 20, { steps: 12 }); await page.mouse.up(); await page.keyboard.up('Alt');
    assert(Math.abs((await node(page, added!).boundingBox())!.x - before.x) < 1, '组件移出编辑框被拒绝并保持原位置');
    const count = await page.locator('#canvas .node').count(), canvas = (await page.locator('#canvas').boundingBox())!;
    await dragTile(page, 'basic.input', rootBox.x + rootBox.width + 100, rootBox.y + 300);
    assert(await page.locator('#canvas .node').count() === count, '拖入编辑框外不插入组件');
    await dragTile(page, 'basic.input', rootBox.x + 360, rootBox.y + 300);
    assert(await page.locator('#canvas .node').count() === count + 1, '框内拖入成功'); await size(page, card.id, 600, 480, '拖入不会反向扩大父组件');
    await page.locator('#finish-edit').click(); assert(await page.locator('#inline-editor').isVisible() && (await page.locator('#toast').textContent())?.includes('未组装'), '框内散件仍需组装');
    await page.keyboard.press('Control+s'); assert(await page.locator('#inline-editor').isVisible(), '快捷键也不能跳过组装');
    await page.waitForTimeout(450); assert(await saved(page) === original, '编辑草稿不覆盖主工作区');
    await page.locator('#delete').click(); await page.locator('#assemble-layer').click(); await size(page, card.id, 600, 480, '组装保持既定编辑框尺寸');
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); assert(!audit.violations.length, `原位编辑无障碍：${JSON.stringify(audit.violations.map(item => item.id))}`);
    await page.screenshot({ path: '/tmp/componentweb-inline-edit.png', fullPage: true });
    for (const width of [320, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 无横向溢出`); if (width === 320) await page.screenshot({ path: '/tmp/componentweb-inline-edit-mobile.png', fullPage: true }); }
    await page.locator('#finish-edit').click(); await size(page, card.id, 288, 192, '完成后按独立显示框缩放');
    assert(await node(page, card.id).locator('h3').textContent() === '原位标签新标题', '标签内容保存');
    await page.locator('#save').click(); await page.reload(); await node(page, card.id).waitFor(); assert(await node(page, card.id).locator('h3').textContent() === '原位标签新标题', '布局与标签恢复');
    await pick(page, card.id); await page.locator('#save-combination').click(); await change(page, 'combination-name', '原位可编辑组合'); await page.locator('#combination-form button[type="submit"]').click();
    const item = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!)[0], COMBINATIONS_KEY);
    await page.locator('.combination-tile').click({ button: 'right' }); await page.getByRole('menuitem', { name: '编辑组合', exact: true }).click();
    await change(page, 'inline-title', '组合新版'); await page.locator('#finish-edit').click(); await page.locator('#combination-form button[type="submit"]').click();
    assert((await page.evaluate(key => JSON.parse(localStorage.getItem(key)!)[0], COMBINATIONS_KEY)).id === item.id, '组合库也统一右键编辑，更新原记录');
    await edit(page, card.id); await page.locator('#delete').click(); assert(await page.locator('#node-count').textContent() === '0 个编辑对象', '整层清空计数正确'); await page.locator('#finish-edit').click();
    assert(await node(page, card.id).count() === 0 && await node(page, other.id).count() === 1, '删除原组件不影响其他组件'); await page.locator('#undo').click();
    assert(!errors.length, errors.join('; '));
  } finally { await context.close(); }
}
async function checkNested(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const root = { ...createNode('layout.container'), id: 'nest-root', col: 2, row: 2, colSpan: 40, rowSpan: 30, design: { width: 960, height: 720 } }, inner = { ...createNode('layout.container'), id: 'nest-inner', parentId: 'nest-root', col: 24, row: 16, colSpan: 20, rowSpan: 12, design: { width: 480, height: 288 } };
  for (const item of [root, inner]) { item.layout!.padding = 0; item.props.borderWidth = 0; }
  const leaf = { ...createNode('basic.button'), id: 'nest-leaf', parentId: inner.id, col: 2, row: 2 }, other = { ...createNode('data.metric'), id: 'nest-other', col: 50, row: 10 };
  await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc: { ...initialDocument(), nodes: [root, inner, leaf, other] } });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(source.url()); await node(page, root.id).waitFor(); await page.waitForTimeout(400); const original = await saved(page);
    await size(page, leaf.id, 42, 12, '原有多层比例'); await edit(page, root.id); await size(page, leaf.id, 84, 24, '当前层解除外层缩放');
    await change(page, 'inline-width', '1008'); await size(page, root.id, 1008, 720, '布局容器也能显式改变编辑框'); await change(page, 'inline-width', '960');
    await edit(page, inner.id); await edit(page, leaf.id); assert(await page.locator('#edit-breadcrumbs button').count() === 4, '嵌套统一通过右键逐层进入');
    const before = await page.locator('#canvas .node').count(); await page.getByRole('button', { name: '添加内容卡片', exact: true }).click();
    assert(await page.locator('#canvas .node').count() === before && (await page.locator('#toast').textContent())?.includes('先扩大'), '小组件必须先扩大，不能靠拖入自动撑开');
    await change(page, 'inline-width', '600'); await change(page, 'inline-height', '240'); await page.getByRole('button', { name: '添加内容卡片', exact: true }).click();
    await page.locator('#edit-breadcrumbs button').first().click(); assert(await page.locator('#edit-breadcrumbs button').count() === 4, '未组装不能越级退出');
    await page.locator('#assemble-layer').click(); await page.locator('#finish-edit').click(); assert(await page.locator('#edit-breadcrumbs button').count() === 3 && await saved(page) === original, '内层仅提交父草稿');
    await page.locator('#finish-edit').click(); await page.locator('#finish-edit').click(); await page.locator('#save').click();
    const doc = JSON.parse(await saved(page)); assert(doc.nodes.find((item: any) => item.id === root.id).design.width === 960 && doc.nodes.find((item: any) => item.id === inner.id).design.width === 480, '内层修改不会撑大任何祖先');
    await size(page, leaf.id, 42, 12, '完成后保持嵌入组件原显示框'); await page.locator('#undo').click(); await size(page, leaf.id, 42, 12, '一次撤销恢复多层编辑'); await page.locator('#redo').click(); await page.locator('#save').click(); const applied = await saved(page);
    await edit(page, root.id); await page.locator('.inline-output summary').click(); await change(page, 'inline-display-width', '900'); await page.locator('#finish-edit').click();
    assert(await page.locator('#inline-editor').isVisible() && await saved(page) === applied, '最终显示框冲突时保留草稿'); await change(page, 'inline-display-width', '480'); await page.locator('#finish-edit').click();
    await edit(page, root.id); await edit(page, inner.id); await change(page, 'inline-title', '反复编辑的内层'); await page.locator('#finish-edit').click(); await page.locator('#finish-edit').click(); await page.locator('#save').click();
    await page.reload(); assert(JSON.parse(await saved(page)).nodes.find((item: any) => item.id === inner.id).props.title === '反复编辑的内层', '可反复右键编辑并保存');
    assert(!errors.length, errors.join('; '));
  } finally { await context.close(); }
}
async function checkLegacyOffset(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const card = { ...createNode('content.card'), id: 'legacy-offset', col: 2, row: 2, surface: { baseWidth: 288, baseHeight: 192, x: 0, y: 0, width: 504, height: 240 }, elements: [{ path: [0, 1], tag: 'h3', style: { x: 240, width: 180 } }] };
  await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc: { ...initialDocument(), nodes: [card] } });
  const page = await context.newPage();
  try {
    await page.goto(source.url()); await node(page, card.id).waitFor(); await edit(page, card.id);
    const before = (await node(page, card.id).locator('h3').boundingBox())!;
    await change(page, 'inline-width', '600'); await change(page, 'inline-height', '480'); await size(page, card.id, 600, 480, '旧版偏移组件同样能先扩大编辑框');
    const after = (await node(page, card.id).locator('h3').boundingBox())!;
    assert(Math.abs(before.x - after.x) < 1 && Math.abs(before.width - after.width) < 1, '扩大旧编辑框不改原标签位置或宽度');
    await change(page, 'prop-title', '旧组件也可修改'); assert(await node(page, card.id).locator('h3').textContent() === '旧组件也可修改', '旧组件原生属性仍可修改');
    await page.locator('#finish-edit').click(); await page.locator('#save').click(); await page.reload(); await node(page, card.id).waitFor(); await edit(page, card.id);
    await size(page, card.id, 600, 480, '旧组件编辑尺寸与内容修改持久化'); await page.locator('#finish-edit').click();
  } finally { await context.close(); }
}
export async function checkInlineEditing(source: Page) { await checkNative(source); await checkNested(source); await checkLegacyOffset(source); console.log('有边界原位编辑验证通过：右键入口、普通/容器缩放、标签修改、框内拖放、越界拒绝、不自动撑大、多层保存。'); }
