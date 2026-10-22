import type { Page } from 'playwright';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

export async function checkShapeSettings(page: Page) {
  await page.locator('.node').first().click();
  const article = page.locator('.node').first().locator('.component-host article');
  const computed = () => article.evaluate(element => {
    const style = getComputedStyle(element);
    return { radius: style.borderTopLeftRadius, width: style.borderTopWidth, border: style.borderTopStyle };
  });
  const originalSize = await page.locator('.node').first().evaluate(element => [element.style.width, element.style.height, element.style.left, element.style.top]);
  assert((await computed()).radius === '0px', '初始组件为直角');
  await page.locator('#prop-radius').fill('16');
  await page.locator('#prop-radius').press('Tab');
  assert((await computed()).radius === '16px', '圆角应用到真实组件，而非只应用到编辑器外框');
  assert(await page.locator('.node').first().evaluate(element => getComputedStyle(element).borderTopLeftRadius) === '16px', '选中外框跟随圆角');
  await page.locator('#prop-borderWidth').fill('3');
  await page.locator('#prop-borderWidth').press('Tab');
  await page.locator('#prop-borderStyle').selectOption('dashed');
  let result = await computed();
  assert(result.width === '3px' && result.border === 'dashed', '边框粗细和虚线生效');
  await page.locator('#undo').click();
  assert((await computed()).border === 'solid', '边框样式可撤销');
  await page.locator('#undo').click();
  assert((await computed()).width === '1px', '边框宽度可撤销');
  await page.locator('#redo').click(); await page.locator('#redo').click();
  result = await computed();
  assert(result.width === '3px' && result.border === 'dashed', '边框可重做');
  await page.getByRole('button', { name: '应用薄荷绿配色' }).click();
  assert((await computed()).radius === '16px', '配色预设不覆盖形状设置');
  await page.locator('#save').click();
  await page.reload();
  await page.locator('.node').first().click();
  assert(await page.locator('#prop-radius').inputValue() === '16', '圆角本地保存恢复');
  result = await computed();
  assert(result.width === '3px' && result.border === 'dashed', '边框本地保存恢复');
  await page.locator('#duplicate').click();
  assert(await page.locator('#prop-radius').inputValue() === '16', '复制保留圆角');
  assert(await page.locator('#prop-borderStyle').inputValue() === 'dashed', '复制保留边框');
  await page.locator('#preview').click();
  assert(await page.locator('#prop-radius').isDisabled(), '预览模式禁用形状编辑');
  await page.locator('#preview').click();
  await page.locator('#delete').click();
  await page.locator('.node').first().click();
  await page.locator('#prop-borderStyle').selectOption('none');
  assert((await computed()).width === '0px', '无边框生效');
  await page.locator('#prop-borderWidth').fill('0');
  await page.locator('#prop-borderWidth').press('Tab');
  await page.locator('#prop-borderStyle').selectOption('solid');
  assert((await computed()).width === '0px', '0px 边框生效');
  await page.locator('#prop-radius').fill('-1');
  await page.locator('#prop-radius').dispatchEvent('change');
  assert(!(await page.locator('#prop-radius').evaluate((input: HTMLInputElement) => input.validity.valid)), '非法圆角输入被拦截');
  assert((await computed()).radius === '16px', '非法设置不改变组件');
  await page.getByRole('button', { name: '圆角预设 8 px', exact: true }).click();
  assert((await computed()).radius === '8px', '圆角预设可恢复非法输入');
  await page.locator('#reset-shape').click();
  result = await computed();
  assert(result.radius === '0px' && result.width === '1px' && result.border === 'solid', '恢复直角与默认边框');
  const size = await page.locator('.node').first().evaluate(element => [element.style.width, element.style.height, element.style.left, element.style.top]);
  assert(JSON.stringify(size) === JSON.stringify(originalSize), '样式设置不改变网格占位');
  await page.getByRole('button', { name: '恢复组件默认配色', exact: false }).click();
  assert(await page.locator('.node').count() === 4, '测试后恢复初始组件数');
  console.log('形状验证通过：默认直角、圆角、边框、预设、校验、复制、预览、撤销重做和保存还原。');
}
