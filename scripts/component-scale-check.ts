import type { Page } from 'playwright';
import { createNode, initialDocument } from '../blank/src/core/model';
import { STORAGE_KEY } from '../blank/src/core/store';
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };

export async function checkComponentScale(source: Page) {
  const context = await source.context().browser()!.newContext({ viewport: { width: 1440, height: 1000 } });
  const root = { ...createNode('layout.container'), id: 'scale-root', col: 2, row: 2, colSpan: 40, rowSpan: 30, design: { width: 960, height: 720 } };
  const inner = { ...createNode('layout.container'), id: 'scale-inner', parentId: root.id, col: 24, row: 16, colSpan: 20, rowSpan: 12, design: { width: 480, height: 288 } };
  for (const node of [root, inner]) { node.layout!.padding = 0; node.props.borderWidth = 0; }
  const child = { ...createNode('basic.button'), id: 'scale-child', parentId: root.id, col: 4, row: 4 };
  const nested = { ...createNode('basic.button'), id: 'scale-nested', parentId: inner.id, col: 2, row: 2 };
  const other = { ...createNode('data.metric'), id: 'scale-other', col: 50, row: 10 };
  await context.addInitScript(({ key, doc }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(doc)); }, { key: STORAGE_KEY, doc: { ...initialDocument(), nodes: [root, child, inner, nested, other] } });
  const page = await context.newPage(); const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const node = (id: string) => page.locator(`.node[data-id="${id}"]`);
  const pick = async (id: string) => page.locator(`.layer-item[data-id="${id}"]`).click();
  const change = async (id: string, value: string) => { await page.locator(`#${id}`).fill(value); await page.locator(`#${id}`).press('Tab'); };
  const size = async (id: string, width: number, height: number, label: string) => {
    const rect = (await node(id).boundingBox())!;
    assert(Math.abs(rect.width - width) < 0.5 && Math.abs(rect.height - height) < 0.5, `${label}：实际 ${rect.width}×${rect.height}，预期 ${width}×${height}`);
  };
  const saved = () => page.evaluate(key => localStorage.getItem(key)!, STORAGE_KEY);
  const data = async () => { await page.locator('#save').click(); return JSON.parse(await saved()); };
  try {
    await page.goto(source.url()); await node(root.id).waitFor(); await page.waitForTimeout(400);
    await size(child.id, 84, 24, '工作区按组合 50% 显示子项'); await size(nested.id, 42, 12, '多层组合缩放相乘');
    const original = await saved();
    await node(nested.id).click(); assert(await node(root.id).getAttribute('class') === 'node selected', '点击组合内容默认选择整体，而非误选最深子项');
    await node(nested.id).dblclick();
    assert(await page.locator('.node').count() === 4 && (await node(root.id).getAttribute('class'))?.includes('scope-root'), '双击原组合沿用整棵子树，不新建空白或包装错误的子项');
    assert(await page.locator('#canvas').evaluate(element => element.style.width === '960px' && element.style.height === '720px' && element.style.getPropertyValue('--grid-cell') === '12px'), '设计页画布与网格步长均与工作区一致');
    await size(child.id, 168, 48, '设计页按原始设计坐标 1:1 编辑');
    await pick(child.id); await change('prop-title', '组合基础上继续设计');
    await change('designer-display-width', '240'); await change('designer-display-height', '180');
    assert(await saved() === original, '修改内部内容和显示尺寸均不泄漏未应用草稿');
    await page.locator('#designer-save').click(); await size(child.id, 42, 12, '应用后按新的外部 25% 显示');
    let document = await data();
    assert(document.nodes.find((item: any) => item.id === root.id).design.width === 960 && document.nodes.find((item: any) => item.id === child.id).col === 4, '缩放仅改变外部边界，不重写内部坐标');

    await pick(root.id); await page.keyboard.press('Shift+F10'); await page.getByRole('menuitem', { name: '在新页面设计容器', exact: true }).click();
    assert(await page.locator('.node').count() === 4 && await page.locator('#designer-width').inputValue() === '960' && await page.locator('#designer-display-width').inputValue() === '240', '右键设计已有组合保留基准、显示尺寸及内容');
    await page.locator('#designer-save').click();
    await change('prop-colSpan', '480'); await size(child.id, 84, 12, '外部宽高比例独立生效');
    await change('prop-rowSpan', '360'); await size(child.id, 84, 24, '主工作区直接调整容器显示尺寸时同步缩放');
    await data(); await page.reload(); await node(root.id).waitFor(); await size(nested.id, 42, 12, '重新加载保存的组合设计与显示尺寸');
    await page.screenshot({ path: '/tmp/componentweb-composition-scale.png', fullPage: true });

    // 缩放容器内仍可通过层级面板精确选中子项；拖动与拉伸须转换回父设计坐标。
    await pick(child.id); let rect = (await node(child.id).boundingBox())!;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down(); await page.mouse.move(rect.x + rect.width / 2 + 12, rect.y + rect.height / 2 + 12, { steps: 8 }); await page.mouse.up();
    document = await data(); let moved = document.nodes.find((item: any) => item.id === child.id);
    assert(moved.col === 6 && moved.row === 6, '50% 容器内屏幕移动 12px 转回内部 24px');
    await page.locator('#zoom').selectOption('0.5'); await pick(child.id); rect = (await node(child.id).boundingBox())!;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down(); await page.mouse.move(rect.x + rect.width / 2 + 12, rect.y + rect.height / 2, { steps: 8 }); await page.mouse.up();
    document = await data(); moved = document.nodes.find((item: any) => item.id === child.id);
    assert(moved.col === 10 && moved.row === 6, '画布缩放与组合缩放共同参与坐标换算');
    const handle = (await node(child.id).locator(':scope > .resize-handle').boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down(); await page.mouse.move(handle.x + handle.width / 2 + 6, handle.y + handle.height / 2, { steps: 6 }); await page.mouse.up();
    document = await data(); assert(document.nodes.find((item: any) => item.id === child.id).colSpan === 16, '缩放父级中的尺寸拖拽仍按内部网格吸附');
    await page.locator('#zoom').selectOption('1'); await pick(child.id); await page.locator('#edit-component').click();
    assert(await page.locator('#designer-width').inputValue() === '192', '普通组件包装使用父级设计坐标，不把屏幕缩放误当原始尺寸');
    await page.locator('#designer-save').click(); await size(child.id, 96, 24, '缩放组合内普通组件转为可嵌套组合后外观不变');

    await pick(inner.id); await page.locator('#edit-component').click();
    assert(await page.locator('#designer-width').inputValue() === '480', '进入内层时使用它自己的设计基准');
    await size(nested.id, 168, 48, '内层独立页不继承外部缩放');
    await page.getByRole('button', { name: '添加操作按钮', exact: true }).click();
    await page.locator('#designer-save').click();
    document = await data(); assert(document.nodes.filter((item: any) => item.parentId === inner.id).length === 2, '可在原内层组合基础上添加内容并应用');
    await size(nested.id, 42, 12, '内层应用回工作区后恢复组合比例');
    // 原组合设计范围较小时，整张工作区网格仍可使用，外部显示范围不随内部扩展而膨胀。
    await pick(inner.id); await page.locator('#edit-component').click(); await pick(nested.id);
    const frame = (await page.locator('#canvas').boundingBox())!, from = (await node(nested.id).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(frame.x + 700, frame.y + 450, { steps: 12 }); await page.mouse.up();
    const width = Number(await page.locator('#designer-width').inputValue()), height = Number(await page.locator('#designer-height').inputValue());
    assert(width > 480 && height > 288, '超出原组合虚线范围时自动扩展设计基准，整张网格可编辑');
    assert(await page.locator('#designer-display-width').inputValue() === '240', '内部范围扩展不改变工作区显示尺寸');
    await page.locator('#designer-save').click();
    await size(nested.id, 168 * 0.5 * 240 / width, 48 * 0.5 * 144 / height, '扩展组合后按新设计基准比例缩放');
    const beforeNestedCreate = await data(); const beforeNestedSaved = await saved();
    await pick(inner.id); await page.locator('#edit-component').click(); await page.locator('#new-container').click();
    await change('designer-display-width', '840'); await page.locator('#designer-save').click();
    assert(await page.locator('#designer-breadcrumbs button').count() === 2 && Number(await page.locator('#designer-width').inputValue()) >= 840, '新建子容器应用时可扩展父草稿，而非被旧基准阻挡');
    assert(await saved() === beforeNestedSaved && await page.locator('#designer-display-width').inputValue() === '240', '父草稿扩展仍保持事务隔离与外部显示边界');
    await page.locator('#designer-save').click(); document = await data();
    assert(document.nodes.length === beforeNestedCreate.nodes.length + 1, '最后应用父页才把新建容器写入主工作区');
    assert(!errors.length, `组合比例运行错误：${errors.join('; ')}`);
    console.log('组合比例验证通过：已有组合继续设计、统一网格、分离尺寸、多层缩放、坐标换算、保存恢复。');
  } finally { await context.close(); }
}
