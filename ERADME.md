# ComponentWeb

一个使用 Bun + HTML + CSS + TypeScript 的网格组件布局工作台。原生实现位于 `blank/`；Vue / React 适配暂未实现。

当前 v0.16 包含 **138 项内置素材**：114 项原生标签素材、23 项基础 / 组合组件，以及可嵌套的布局容器。支持工作区原位编辑、真实内部标签修改、逐层组装、多选排版、Flex / Grid、「我的组合」、多布局保存与右键菜单。

- [工作区原位组件编辑](./COMPONENT_DESIGN.md)
- [工作台操作说明](./WORKBENCH.md)
- [素材与样式目录](./CATALOGUE.md)
- [后续路线](./ROADMAP.md)

## 启动与验证

```bash
bun install
bun run dev
```

打开 http://localhost:3000 。

```bash
bun test
bun run typecheck
bun run build

# 首次运行浏览器检查需安装 Chromium 和相应系统库
bunx playwright install chromium
bun run test:browser
```

浏览器脚本自动启动 3107 端口的测试服务器，并使用隔离上下文，结束后关闭服务器与浏览器，不使用日常工作区的存储。截图位于 `/tmp/componentweb-v4-nested.png`、`/tmp/componentweb-v2-desktop.png`、`/tmp/componentweb-v2-mobile.png` 和 `/tmp/componentweb-grid12.png`。原位编辑截图为 `/tmp/componentweb-inline-edit.png`、`/tmp/componentweb-inline-edit-mobile.png`；组装显示与旧偏移背景回归截图为 `/tmp/componentweb-assembly-render.png`、`/tmp/componentweb-edit-background.png`。

## 核心能力

- **首页与布局库**：整屏固定交互网格覆盖首页视口，包括内容外留白和列表区域；滚动不偏移，标题、按钮及内容宽度稳定。默认静止，鼠标经过或点击时出现光照、选框和预览轻微偏转，进入编辑器时隐藏背景。根地址提供完整布局列表、双新建入口、继续最近布局和搜索直达；增强可关闭并遵循系统减少动态。进入编辑器后，点击导航栏当前名称切换最近修改的 5 个布局。品牌标志或菜单可返回首页，显式布局地址支持刷新恢复与前进后退。保存始终更新当前布局，各布局历史独立，旧记录自动迁入。
- **亮暗主题**：顶栏右侧切换，编辑页位于保存右侧；默认暗色，亮色网格白底黑线。画布自定义配色自动记入浏览器，切换主题覆盖为相应默认网格色，不新增配色收藏，也不改变组件自身的颜色或布局修改时间。首页新建 / 搜索工具区透明，搜索使用细焦点边框；暗色搜索框单独加稳定底色与高对比文字，不受指针光照干扰，布局列表保留原结构。
- **原位组件编辑**：右键「编辑组件」，在当前工作区修改，背景与其他组件变暗、只读。当前对象可用手柄或宽高字段立即调整，内容只能在编辑框内编排，不能反向撑大父组件；组装或清理后才能完成。嵌套统一右键进入，双击不切层。
- **真实标签修改**：点击组件内部标签或从面板选择，调整文本、位置、宽高、字号和颜色；支持删除 / 恢复、撤销重做与安全持久化。
- **组合比例显示**：内部设计基准与外部显示尺寸独立；工作区按容器实际宽高比例缩放内容、文字、边框与间距，多层组合逐层叠加，不改写原始子项坐标。
- **桌面横屏比例 / 12px 网格**：默认 16:9、等比适应工作区，不以超大像素扩边。1344×756 / 112×63 格仅为内部坐标基准；窗口变化只改变显示倍率，手动 100% 保留。旧节点、设计尺寸和标签基准不变；手机、竖屏与其他比例仍在路线待办。
- **多选排版**：Shift 点击、框选、整体移动、六种对齐与水平 / 垂直等间距分布。整次校验和提交，单步撤销。
- **真实容器**：自由、Flex、Grid 三种布局；多层嵌套、跨层拖动、父容器选择、层级导航、子项顺序调整及解散容器。
- **我的组合**：保存选区与完整子树为本地快照，支持拖入复用、独立副本、重命名和删除。
- **右键菜单**：按空白画布、单选、多选和素材类别提供操作。支持「更多」、菜单键和 Shift + F10。文本编辑区域保留原生菜单。
- **独立样式**：背景、文字、边框和强调色；HEX、拾色器、配色预设、对比度提示。圆角默认 0px，并可设置圆角、边框粗细和样式。
- **编辑 / 预览**：编辑模式接管布局，预览模式允许操作组件内部控件。支持缩放、复制、删除、历史记录与本地自动保存。

## 约束与数据安全

- 工作区根组件不能重叠；父子包含不视为碰撞。原位编辑可临时叠放，组装后的内部容器支持叠放设置。对齐、分布、组合和换层若会越界或碰撞，整次取消，不自动推挤。
- 自动布局按真实 CSS 排版，空间不足时在容器内滚动。当前没有子项 flex-grow 或 Grid 跨行跨列配置。
- 最多 8 层容器嵌套、300 个节点 / 工作区、100 份本地布局和 50 个本地组合；容器不能成为自己或后代的子项。
- 现有原生 div / section 素材仍为标签演示，承载子项请使用新增的「布局容器」。
- Shadow DOM 是样式封装，不是安全沙箱。只渲染可信模板，用户文案使用 textContent，不执行任意 HTML / JavaScript。
- 保存仅覆盖当前站点与当前浏览器；不提供跨标签页冲突合并、跨设备同步、导出或后端。

## 架构

```text
blank/src/
  main.ts
  styles.css / catalogue.css / workbench.css
  layout-library.css / home-hero.css / theme.css
  core/
    grid.ts                 # 16:9 坐标基准、12px 网格与旧范围兼容
    canvas-view.ts          # 可见工作区的统一适应倍率，不修改布局
    design-space.ts         # 内部设计基准与外部显示比例
    edit-region.ts          # 显式编辑尺寸、框内边界与范围校验
    types.ts                # 文档、父子关系、容器配置
    model.ts                # 创建、解析、迁移与校验
    tree.ts                 # 层级、边界、同级碰撞与循环检测
    operations.ts           # 批量移动、对齐、分布、组合与子树复制
    combinations.ts         # 本地组合快照与持久化
    store.ts                # 历史记录和旧工作区兼容读写
    layouts.ts              # 多布局保存、最近五项及旧记录迁移
    layout-route.ts         # 静态部署可用的布局哈希地址
    home-pointer.ts         # 固定视口装饰坐标、吸附与受限偏转
    theme.ts                # 浏览器级主题、网格偏好及校验
    store-router.ts         # 主工作区与草稿的历史路由
    inline-edit.ts          # 多层原位编辑、门禁与提交事务
    assembly.ts             # 散件组装与内部叠放
    element-edits.ts        # 原生标签与缩放元数据校验
  editor/
    editor.ts               # 事务、选区与工作台装配
    inline-editing.ts       # 同一工作区的编辑工具条与层级
    element-editing.ts / element-panel.ts / element-dom.ts
    native-surface.ts       # 标签外扩后的内容自动缩放
    canvas-renderer.ts      # 真实 DOM / slot / Flex / Grid
    gestures.ts             # 多选拖动、框选、换层与排序
    panels.ts               # 素材分类与搜索
    layout-library.ts       # 首页布局列表、搜索、新建及快捷继续
    home-interaction.ts     # 整屏反馈、背景与行共享一帧及静态偏好
    theme.ts                # 主题按钮、外观变量和可读性隔离
    layout-navigation.ts    # 导航栏最近五项与键盘菜单
    layout-workspace.ts     # 页面路由、布局切换、独立历史与自动保存
    inspector.ts            # 属性、样式与层级
    layout-panel.ts / layers.ts
    context-menu.ts / selection-actions.ts
    combination-dialogs.ts / combination-tiles.ts
    color-controls.ts / shape-controls.ts
  components/
    contract.ts / registry.ts
    colors.ts / shape.ts
    container/
    native/ / common/
    button/ / card/ / metric/ / input/
scripts/
  browser-check.ts          # 浏览器与 axe 总入口
  workbench-check.ts        # 多选、嵌套、组合和右键
  nesting-drag-check.ts     # 跨层拖动与删除恢复
  inline-edit-check.ts      # 原位标签编辑、散件门禁、嵌套与自动缩放
  assembly-render-check.ts  # 散件可见性、右键命中、反复编辑与背景填充
  layout-library-check.ts   # 首页、最近五项、地址恢复与离开门禁
  home-appearance-check.ts  # 整屏 / 宽屏 / 滚动、默认静止、触控与可达性
  theme-check.ts            # 亮暗切换、透明工具区、配色与草稿隔离
  desktop-canvas-check.ts   # 16:9 等比适应、倍率、旧远处数据与搜索对比
```

组件通过 `mount / update / destroy` 与编辑器解耦。布局容器使用 Shadow DOM 内的 slot 让真实子节点参与 CSS 排版，而不是把组件渲染成图片。目录源尺寸沿用 24px 设计单位，由注册表统一转换为当前网格单位。

## 保存与迁移

当前文档格式为 **schemaVersion 5**，默认 16:9、1344×756 / 112×63 格，保存逻辑网格、画布配色、组件列表、`parentId`、容器 `layout` 与内部设计尺寸 `design`。默认适应工作区是视图状态，不是修改像素或伪装为 100%。旧容器缺少 `design` 时按原显示像素宽高补齐，保持原视觉与坐标。同级数组顺序决定自动布局顺序；自动布局中的几何尺寸为请求尺寸。原位编辑使用逐层内存草稿，主页面自动保存仍只针对主工作区；只有当前层全部组装并完成，才提交子树更改。标签修改保存为白名单 `elements` 与 `surface` 数据，不保存任意 HTML。

读取 v1（24px）、v2（8px）时，按实际像素换算为 12px 格数，保留亚网格坐标、ID、文案、样式与尺寸，并补齐根级父子关系。v3 和普通 v4 旧布局恢复到正常 16:9，不改节点、嵌套、标签修改、内部设计尺寸或原生基准；v4 若已有内容在新范围之外，则仅该布局保留原范围并标记兼容，默认等比全览，不裁剪或压缩数据。v5 保留自己的有效网格范围，不重复迁移。旧记录按原边界检查；只读加载不覆盖原库或组合记录，保存时写为 v5。布局库使用 `componentweb.layouts.v1`，记录布局 ID、名称、创建 / 修改时间和完整文档；旧 `componentweb.document.v1` 自动迁入默认布局，并保留为当前工作区的兼容镜像。根地址显示首页，列表和最近菜单按修改时间排序；显式布局地址只打开指定记录，刷新不跳到其他布局。地址仅定位当前浏览器中的记录，不是布局分享或导出。单纯打开布局、返回首页不修改时间。

外观偏好单独保存在 `componentweb.theme.v1`，记录模式与当前画布背景 / 网格线色。首次缺少新偏好时兼容旧画布配色；此后实际显示以浏览器偏好为准，切换布局不恢复旧色。主题切换仅写偏好键，重置为该主题默认网格，不改布局、历史或组件。文档原有 `appearance` 字段保留兼容，并继续记录画布配色操作的历史；撤销基线使用操作前实际可见的配色，避免切换主题后第一次撤销跳回旧布局颜色。首页始终使用主题默认网格，避免自定义画布背景降低界面文字对比度。

「我的组合」单独保存在 `componentweb.combinations.v1`，插入时重建全部 ID 和父子引用。存储失败不会伪报成功；解析会校验组件类型、样式、布局、重复 ID、孤儿、循环和层级深度。

## 验证

已通过 120 项单元测试、1353 次断言及类型检查，覆盖网格迁移、碰撞、多选排版、树结构、样式、组合快照及存储失败。原位编辑另覆盖标签样式白名单、临时叠放、未组装门禁、原位置恢复、多层草稿隔离、反复组装、删除与重建根、模板编辑和自动缩放。浏览器回归覆盖所有内置素材，另外实测多选、框选、批量撤销、Flex / Grid、子项排序、嵌套拖入 / 移出、组合保存与独立副本、右键键盘导航、滚轮 / 触屏滚动和四档响应式。组装显示回归额外检查散件不被编辑框遮挡、右键不误入子项、保存重载后的完整子树、缩放拖动及旧偏移数据的背景填充。

布局库另覆盖首页选择、新建 / 搜索、最近五项排序、当前布局保存、地址刷新、前进后退、旧记录迁移、独立历史、草稿与保存失败门禁、键盘菜单及四档响应式。截图为 `/tmp/componentweb-layout-home.png`、`/tmp/componentweb-layout-home-mobile.png`、`/tmp/componentweb-layout-recent.png` 和 `/tmp/componentweb-layout-recent-mobile.png`。

首页交互另覆盖固定视口铺满、四角与留白响应、介绍区离屏后列表区域仍可交互、滚动坐标不偏移、2560 / 3440px 宽屏内容限宽、默认无动画 / 无空闲帧、指针光照与预览偏转、点击反馈固定在点击处、背景与布局行共享一帧、触屏留白正常滚动、关闭偏好、减少动态、首屏可达性与布局数据隔离。截图为 `/tmp/componentweb-home-interaction-idle.png`、`/tmp/componentweb-home-interaction.png`、`/tmp/componentweb-home-interaction-mobile.png`、`/tmp/componentweb-home-interaction-touch.png`、`/tmp/componentweb-home-fullscreen-wide.png` 和 `/tmp/componentweb-home-fullscreen-scrolled.png`。

亮暗主题另覆盖透明工具区与单层细焦点、首页 / 保存右侧开关、默认暗色与白底黑线、刷新记忆、自定义网格、切换重置、配色可见基线撤销、布局修改时间不变、真实组件不重建、编辑草稿保留、偏好存储失败、触控及四档响应式。截图为 `/tmp/componentweb-theme-dark-home.png`、`/tmp/componentweb-theme-light-home.png`、`/tmp/componentweb-theme-light-editor.png` 和 `/tmp/componentweb-theme-light-mobile.png`。

桌面专项覆盖暗色搜索文字 / 占位至少 7:1、细边框至少 3:1、指针光照经过时内容像素稳定；验证 1280、1440、1920、2560、3440、3840 六档电脑横屏的 16:9 完整等比适应、真实手动倍率、适应状态下的拖放 / 历史 / 保存 / 刷新、原位编辑模式恢复、最小原生尺寸合法性、普通旧布局恢复比例、旧远处内容兼容和主题隔离。截图为 `/tmp/componentweb-search-contrast.png`、`/tmp/componentweb-canvas-aspect-1920.png` 和 `/tmp/componentweb-canvas-aspect-3840.png`。

axe 对亮暗编辑器、首页及最近布局菜单、新建弹窗、代表性原生标签、组合组件和嵌套布局执行自动检查。自动检查不代替真实读屏器、其他浏览器及触屏设备的人工验收。

当前 Bun CSS 压缩器可能对标准 `::details-content` 选择器发出警告，但会保留该规则；组件库另有整面板滚动回退。开发与生产构建均需通过滚动回归检查。
