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
async function selectTag(page: Page, tag: string) {
  const value = await page.locator('#element-select option').evaluateAll((options, tag) => (options.find(option => option.textContent?.includes(`<${tag}>`)) as HTMLOptionElement)?.value, tag);
  assert(value, `存在可编辑标签 ${tag}`); await page.locator('#element-select').selectOption(value);
}

async function checkNativeEditing(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const card = { ...createNode('content.card'), id: 'inline-card', col: 2, row: 2 };
  const other = { ...createNode('data.metric'), id: 'inline-other', col: 50, row: 8 };
  await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc: { ...initialDocument(), nodes: [card, other] } });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(source.url()); await node(page, card.id).waitFor(); await page.waitForTimeout(400);
    assert(await page.locator('.canvas-heading,#page-eyebrow,#page-subtitle,#grid-dimensions,#designer-panel').count() === 0, '工作区宣传标题与旧设计页界面均已删除');
    const original = await saved(page), url = page.url();
    await node(page, card.id).click({ button: 'right' }); await page.getByRole('menuitem', { name: '编辑组件', exact: true }).click();
    assert(page.url() === url && await page.locator('#workspace-heading').textContent() === '工作区', '编辑仍在同一工作区，不进入新页面');
    assert(await page.locator('#inline-editor').isVisible() && await page.locator('#context-layer').evaluate(element => (element as HTMLElement).inert && getComputedStyle(element).opacity === '0.24'), '背景和其他组件变暗并保持只读');
    assert(await page.locator(`#context-layer .node[data-id="${other.id}"]`).count() === 1, '其他组件保留在原工作区作为上下文');
    assert(await page.locator('#preview').isDisabled(), '不能通过预览绕过未完成编辑');
    await selectTag(page, 'h3'); await change(page, 'element-text', '原位标签新标题'); await change(page, 'element-font-size', '26'); await change(page, 'element-color', '#FFFFFF');
    await page.locator('#undo').click(); await page.locator('#redo').click();
    assert(await node(page, card.id).locator('h3').textContent() === '原位标签新标题', '内部标签文本修改、撤销重做有效');
    await change(page, 'element-font-size', '80');
    const expanded = (await node(page, card.id).boundingBox())!, footer = (await node(page, card.id).locator('footer').boundingBox())!;
    assert(expanded.height > 192 && footer.y + footer.height <= expanded.y + expanded.height + 1, '字号改变导致相邻标签重排时，将整个内容范围一起纳入自动缩放');
    await change(page, 'element-font-size', '26');
    await change(page, 'element-text', '<img src=x onerror=alert(1)>');
    assert(await node(page, card.id).locator('h3 img').count() === 0 && await node(page, card.id).locator('h3').textContent() === '<img src=x onerror=alert(1)>', '标签文本作为文本写入，不执行 HTML');
    await change(page, 'element-text', '原位标签新标题');
    await page.locator('#zoom').selectOption('0.75');
    let tag = (await node(page, card.id).locator('h3').boundingBox())!;
    await page.mouse.move(tag.x + tag.width / 2, tag.y + tag.height / 2); await page.mouse.down(); await page.mouse.move(tag.x + tag.width / 2 + 9, tag.y + tag.height / 2 + 9, { steps: 8 }); await page.mouse.up();
    assert(await page.locator('#element-x').inputValue() === '12' && await page.locator('#element-y').inputValue() === '12', '标签拖拽按 12px 网格定位，正确换算画布缩放');
    await page.locator('#zoom').selectOption('1'); await change(page, 'element-x', '240');
    const cardBox = (await node(page, card.id).boundingBox())!;
    assert(cardBox.width > 288, '标签超出原组件时扩展内部范围，完成后再缩回显示框');
    await page.mouse.move(cardBox.x + 2, cardBox.y + 2); await page.keyboard.down('Alt'); await page.mouse.down(); await page.mouse.move(cardBox.x + 26, cardBox.y + 14, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
    const moved = (await node(page, card.id).boundingBox())!;
    assert(Math.abs(moved.x - cardBox.x - 24) < 1 && Math.abs(moved.y - cardBox.y - 12) < 1, '编辑对象可在背景组件上方自由拖动');
    await selectTag(page, 'p'); await page.getByRole('button', { name: '删除标签', exact: true }).click();
    assert(await node(page, card.id).locator('p').isHidden(), '可删除不需要的内部标签'); await page.getByRole('button', { name: '恢复标签', exact: true }).click();
    await selectTag(page, 'h3');
    await page.getByRole('button', { name: '添加操作按钮', exact: true }).click();
    assert(await page.locator('#edit-pending').textContent() === '1 个散件待组装', '新添加组件是自由摆放的待组装散件');
    const addedId = await page.locator('#canvas > .node.selected').getAttribute('data-id'); assert(addedId && addedId !== card.id, '新增独立散件');
    const addedBefore = (await node(page, addedId!).boundingBox())!; await node(page, addedId!).focus(); await page.keyboard.press('ArrowRight');
    assert(Math.abs((await node(page, addedId!).boundingBox())!.x - addedBefore.x - 12) < 1, '切换到新散件后方向键移动新组件，不残留旧标签选择');
    const tile = (await page.locator('.component-tile[data-type="basic.input"] .tile-preview').boundingBox())!, canvas = (await page.locator('#canvas').boundingBox())!;
    await page.mouse.move(tile.x + 20, tile.y + 20); await page.mouse.down(); await page.mouse.move(canvas.x + 700, canvas.y + 350, { steps: 12 }); await page.mouse.up();
    assert(await page.locator('#edit-pending').textContent() === '2 个散件待组装', '编辑模式支持从素材库拖入其他组件');
    await page.locator('#finish-edit').click(); assert(await page.locator('#inline-editor').isVisible() && (await page.locator('#toast').textContent())?.includes('未组装'), '未组装不能完成');
    await page.keyboard.press('Control+s'); assert(await page.locator('#inline-editor').isVisible(), '保存快捷键也不能绕过门禁');
    await page.waitForTimeout(450); assert(await saved(page) === original, '原位草稿不覆盖工作区自动保存');
    // 删除刚拖入的不需要的散件；剩余内容须组装。
    await page.locator('#delete').click(); assert(await page.locator('#edit-pending').textContent() === '1 个散件待组装', '删除多余组件减少待组装项');
    await page.locator('#assemble-layer').click(); assert(await page.locator('#edit-pending').textContent() === '已组装 · 可完成', '显式组装本层');
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert(!audit.violations.length, `原位编辑无障碍：${JSON.stringify(audit.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })))}`);
    await page.screenshot({ path: '/tmp/componentweb-inline-edit.png', fullPage: true });
    for (const width of [320, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px 原位编辑无横向溢出`); if (width === 320) await page.screenshot({ path: '/tmp/componentweb-inline-edit-mobile.png', fullPage: true }); }
    await page.locator('#finish-edit').click(); assert(await page.locator('#inline-editor').isHidden(), '组装后完成回普通工作区');
    await size(page, card.id, 288, 192, '完成后自动缩放回原组件显示尺寸');
    const result = (await node(page, card.id).boundingBox())!, mainCanvas = (await page.locator('#canvas').boundingBox())!;
    assert(Math.abs(result.x - mainCanvas.x - 24) < 1 && Math.abs(result.y - mainCanvas.y - 24) < 1, '临时移动不改变原组件的最终位置');
    assert(await node(page, card.id).locator('h3').textContent() === '原位标签新标题', '原生标签修改包含在组装结果内');
    await page.locator('#save').click(); await page.reload(); await node(page, card.id).waitFor();
    assert(await node(page, card.id).locator('h3').textContent() === '原位标签新标题', '内部标签修改与缩放基准完整保存恢复');
    await pick(page, card.id); await page.locator('#save-combination').click(); await change(page, 'combination-name', '原位可编辑组合'); await page.locator('#combination-form button[type="submit"]').click();
    const item = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!)[0], COMBINATIONS_KEY);
    await page.getByRole('button', { name: '编辑组合 原位可编辑组合', exact: true }).click();
    await change(page, 'inline-title', '组合新版'); await page.locator('#finish-edit').click(); await page.locator('#combination-form button[type="submit"]').click();
    const updated = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!)[0], COMBINATIONS_KEY);
    assert(updated.id === item.id && updated.document.nodes.length === item.document.nodes.length, '组合库编辑使用同一原位流程并更新原记录');
    await pick(page, card.id); await page.locator('#edit-component').click(); await page.locator('#delete').click();
    assert(await page.locator('#node-count').textContent() === '0 个编辑对象' && (await page.locator('#edit-pending').textContent())?.includes('已清空'), '整层删除后编辑状态和计数正确');
    await page.locator('#finish-edit').click(); assert(await node(page, card.id).count() === 0 && await node(page, other.id).count() === 1, '全部删除后完成只移除原组件，不影响其他组件');
    await page.locator('#undo').click(); assert(await node(page, card.id).locator('h3').textContent() === '原位标签新标题', '删除整个编辑对象可一次撤销恢复');
    assert(!errors.length, `原位标签运行错误：${errors.join('; ')}`);
  } finally { await context.close(); }
}

async function checkNestedEditing(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const root = { ...createNode('layout.container'), id: 'nest-root', col: 2, row: 2, colSpan: 40, rowSpan: 30, design: { width: 960, height: 720 } };
  const inner = { ...createNode('layout.container'), id: 'nest-inner', parentId: root.id, col: 24, row: 16, colSpan: 20, rowSpan: 12, design: { width: 480, height: 288 } };
  for (const node of [root, inner]) { node.layout!.padding = 0; node.props.borderWidth = 0; }
  const leaf = { ...createNode('basic.button'), id: 'nest-leaf', parentId: inner.id, col: 2, row: 2 };
  const other = { ...createNode('data.metric'), id: 'nest-other', col: 50, row: 10 };
  await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc: { ...initialDocument(), nodes: [root, inner, leaf, other] } });
  const page = await context.newPage(), errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(source.url()); await node(page, root.id).waitFor(); await page.waitForTimeout(400); const original = await saved(page);
    await size(page, leaf.id, 42, 12, '多层组合原显示比例');
    await pick(page, root.id); await page.locator('#edit-component').click(); await size(page, leaf.id, 84, 24, '进入外层原位编辑时只移除外层缩放');
    await page.getByRole('button', { name: '添加操作按钮', exact: true }).click(); const parentLoose = await page.locator('#canvas > .node.selected').getAttribute('data-id');
    await pick(page, inner.id); await page.locator('#edit-component').click();
    assert(await page.locator('#edit-breadcrumbs button').count() === 3, '组合内的组合可逐层进入编辑');
    await size(page, leaf.id, 168, 48, '内层在自己的原始尺度编辑');
    await page.getByRole('button', { name: '添加内容卡片', exact: true }).click(); await page.locator('#edit-breadcrumbs button').first().click();
    assert(await page.locator('#edit-breadcrumbs button').count() === 3, '面包屑不能绕过内层未组装检查');
    await page.locator('#assemble-layer').click(); await page.locator('#finish-edit').click();
    assert(await page.locator('#edit-breadcrumbs button').count() === 2 && await saved(page) === original, '内层完成仅写入外层草稿');
    assert(await page.locator(`.layer-item[data-id="${parentLoose}"]`).count() === 1, '外层散件在内层编辑期间仍保留');
    await page.locator('#finish-edit').click(); assert(await page.locator('#inline-editor').isVisible(), '外层仍须处理自己的散件');
    await page.locator('#assemble-layer').click(); await page.locator('#finish-edit').click(); await page.locator('#save').click();
    const doc = JSON.parse(await saved(page)), outer = doc.nodes.find((item: any) => item.id === root.id), nested = doc.nodes.find((item: any) => item.id === inner.id);
    await size(page, root.id, 480, 360, '多次组装不放大外部显示框');
    await size(page, leaf.id, 168 * 480 / outer.design.width * 240 / nested.design.width, 48 * 360 / outer.design.height * 144 / nested.design.height, '嵌套完成后逐层自动缩放');
    assert(doc.nodes.find((item: any) => item.id === leaf.id).col === 2, '不改写内层标签的原坐标');
    await page.locator('#undo').click(); await size(page, leaf.id, 42, 12, '外层一次撤销恢复整个多层编辑'); await page.locator('#redo').click(); await page.locator('#save').click(); const applied = await saved(page);
    await pick(page, root.id); await page.locator('#edit-component').click(); await change(page, 'inline-width', '900'); await page.locator('#finish-edit').click();
    assert(await page.locator('#inline-editor').isVisible() && await saved(page) === applied, '最终显示外框碰撞时保留原位编辑且主工作区不变');
    await change(page, 'inline-width', '480'); await page.locator('#finish-edit').click();
    // 同一组件可重复编辑，多元素组件可继续嵌入另一个组合。
    await pick(page, root.id); await page.locator('#edit-component').click(); await pick(page, inner.id); await page.locator('#edit-component').click();
    await change(page, 'inline-title', '反复编辑的内层'); await page.locator('#finish-edit').click(); await page.locator('#finish-edit').click();
    await page.locator('#save').click(); await page.reload(); await node(page, root.id).waitFor();
    const restored = JSON.parse(await saved(page)); assert(restored.nodes.find((item: any) => item.id === inner.id).props.title === '反复编辑的内层', '可多次逐层编辑且完整保存');
    assert(!errors.length, `多层原位编辑运行错误：${errors.join('; ')}`);
  } finally { await context.close(); }
}
export async function checkInlineEditing(source: Page) {
  await checkNativeEditing(source); await checkNestedEditing(source);
  console.log('原位组件编辑验证通过：移除标题区、背景变暗、原生标签编辑/拖动、散件门禁、逐层组装、自动缩放和持久化。');
}
