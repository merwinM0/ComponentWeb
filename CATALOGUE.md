# 素材目录与配色

当前共 **137 项素材**：23 项组合/基础组件，114 项原生标签素材（覆盖 98 种实际标签，含 16 种额外 input 类型）。所有素材都使用真实 DOM，而不是画布截图。

## 组合与基础组件（23 项）

内容卡片、数据指标、操作按钮、文本输入，以及：

- 导航：顶部导航、面包屑、分页器、标签页。
- 表单：开关、复选框组、单选框组、选择器、搜索栏。
- 内容：标签徽章、头像名片、信息列表、数据表格、进度卡片、骨架占位。
- 反馈：提示消息、手风琴、文字提示、对话框。

在预览模式下可操作开关、表单、标签页、分页、折叠和弹窗。标签页支持方向键 / Home / End；对话框支持 Escape、原生模态焦点管理；文字提示支持悬停、聚焦与 Escape 隐藏。

## 原生标签（114 项）

| 分类 | 数量 | 标签 |
| --- | ---: | --- |
| 文本排版 | 41 | h1–h6、p、span、strong、em、b、i、small、mark、del、ins、sub、sup、code、pre、kbd、samp、blockquote、q、abbr、cite、time、address、s、u、dfn、bdi、bdo、a、br、hr、data、wbr、ruby、rt、rp |
| 结构布局 | 20 | div、section、article、header、footer、main、aside、nav、search、hgroup、menu、dialog、ul、ol、li、dl、dt、dd、details、summary |
| 原生表单 | 28 | input、textarea、select、option、optgroup、datalist、label、button、form、fieldset、legend、output，以及下面的 input 类型 |
| 媒体图形 | 13 | img、figure、figcaption、picture、video、audio、map、area、object、embed、iframe、svg、canvas |
| 原生数据 | 12 | table、thead、tbody、tfoot、tr、th、td、caption、colgroup、col、progress、meter |

额外 input 类型：number、password、email、search、date、datetime-local、time、month、week、url、tel、file、color、range、checkbox、radio。普通文本 input 单列为素材。

标签名会直接显示在素材卡片与属性面板中；搜索支持中文名称、类型 ID 和 HTML 标签名，例如 `h1`、`table`、`input-date`。

### 标签边界

- 表格单元格、列表项、下拉选项等需要父级的元素，会使用合法的父级结构承载，不创建孤立的无效 HTML。
- div / section 等容器目前只是独立网格素材，**暂不支持嵌套拖入**。
- head、meta、title、link、base、script、style、template、slot、隐藏 input 等非独立可视内容，不作为可拖拽素材；不支持执行任意 HTML / JavaScript。
- source / track 属于媒体内部配置，不作为单独占据网格的组件；picture 示例内部使用 source。
- object / embed 固定使用本地可信 SVG 示例；iframe 使用禁用脚本的 sandbox 与静态 srcdoc，不开放任意页面嵌入。
- 图片、音频、视频可在属性面板填写 HTTP(S) 地址，超链接支持 HTTP(S) / mailto / tel；拒绝 javascript、file 等协议。
- 外部媒体是否加载成功取决于服务器、网络及浏览器策略；视频字幕等生产内容要求仍需自行补充。

## 颜色编辑

选中组件后，右侧可以分别修改：

1. 背景色。
2. 文字色。
3. 边框色。
4. 强调色（链接、选中项、开关、进度等）。

支持原生拾色器、`#RRGGBB` 输入、冰川蓝 / 薄荷绿 / 暖砂橙 / 浅色纸四套预设、恢复默认。拾色过程实时预览，确认后只写入一次历史记录。文字与背景显示对比度提示；提示不阻止用户选择低对比颜色，也不代表所有内部元素都通过完整无障碍认证。原生表单控件会按组件背景切换 light / dark color-scheme。

无论是否选中组件，属性面板下方都能修改画布背景与网格线色。网格线使用用户选择颜色的低透明度版本，保持内容优先。组件图像本身不进行色相替换，修改背景仅影响图片外部承载区域。

所有颜色都支持撤销、重做和本地保存。旧版记录会自动补齐缺失颜色，不清空已有布局；旧按钮以强调色填充的视觉也会保留。

## 圆角与边框

选中组件，在右侧「圆角与边框」设置：

- 圆角半径：0～120px 的整数，**默认 0px（直角）**，支持 0 / 4 / 8 / 16 / 24px 预设。
- 边框粗细：0～12px 的整数，默认 1px。
- 边框样式：实线（默认）、虚线、点线、无边框；粗细为 0px 时也隐藏边框。
- 一键恢复直角和默认边框；配色预设不会覆盖形状设置。

设置作用于组件自己的容器与可控控件，而不只是编辑器选中框。组件外壳和内容使用 border-box，修改不影响网格位置和占位尺寸。图片内容、SVG 绘图形状、浏览器原生单选指示器和音视频内部控制条不进行重绘；编辑器工具栏等界面元素不受组件样式设置影响。

设置保存在组件 props 的 `radius` / `borderWidth` / `borderStyle`，支持复制、撤销、重做和本地恢复。旧记录缺少这些字段时补齐为 0px 直角、1px 实线，不修改布局、文案或配色；非法值会被校验拦截。

## 目录扩展

- `components/native/`：按文本、结构、表单、媒体、数据分类定义原生素材，复用 `factory.ts` 的隔离渲染与清理逻辑。
- `components/common/`：常见组合组件，交互监听器通过 AbortController 统一销毁。
- `components/colors.ts`：共享颜色默认值、预设、格式校验和对比度算法。
- `editor/color-controls.ts`：通用拾色与 HEX 控件。
- `components/shape.ts`：圆角、边框默认值与格式校验。
- `editor/shape-controls.ts`：圆角输入、预设、边框粗细与样式。
- `editor/inspector.ts`：属性、形状与颜色面板，与组件库浏览分离。

增加素材时实现组件协议并加入注册表即可；工作区拖放与碰撞逻辑无需改动。

## 8px 细网格与尺寸约定

工作区为 120×90 格，每格 8px，画布物理尺寸保持 960×720px。移动、调整尺寸和属性输入均可精确到一格；方向键微调 8px，Shift + 方向键微调 40px。视觉上每 48px 绘制一条主网格线，其余细网格降低透明度，避免密集网格盖过内容。

已有素材的默认和最小像素尺寸不缩小。目录源文件中的 `size` / `min` 继续以 24px 为设计单位；`registry.ts` 在注册边界统一转换成当前 8px 格数，组件实现不需要批量改写。编辑器必须使用注册表中的定义，而不是绕过注册表直接读取原始目录尺寸。

例如内容卡片仍为 288×192px，对应新网格 36×24 格；现在可以把宽度微调为 280px 或 296px，而不必一次跳 24px。素材卡片、选中标签和拖动提示显示像素尺寸，属性面板仍以整数格输入并附带像素说明。

旧 v1 文档按 24px → 8px 比例迁移为 v2；位置和尺寸的整数格数乘以 3，组件 ID、样式和实际像素几何保持不变。不接受未知网格或版本与网格不匹配的数据。
