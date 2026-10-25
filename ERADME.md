# ComponentWeb

一个使用 Bun + HTML + CSS + TypeScript 的网格组件布局工作台。原生实现位于 `blank/`；Vue / React 适配暂未实现。

当前 v0.9 包含 **138 项内置素材**：114 项原生标签素材、23 项基础 / 组合组件，以及可嵌套的布局容器。支持工作区原位编辑、真实内部标签修改、逐层组装、多选排版、Flex / Grid、「我的组合」、多布局保存与右键菜单。

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

- **布局库**：标题旁手动切换，新建空白布局或选择已有布局；保存始终更新当前布局，启动恢复最近修改的一份。默认仍显示组件库，旧记录自动迁入，各布局历史相互独立。
- **原位组件编辑**：右键「编辑组件」，在当前工作区修改，背景与其他组件变暗、只读。当前对象可用手柄或宽高字段立即调整，内容只能在编辑框内编排，不能反向撑大父组件；组装或清理后才能完成。嵌套统一右键进入，双击不切层。
- **真实标签修改**：点击组件内部标签或从面板选择，调整文本、位置、宽高、字号和颜色；支持删除 / 恢复、撤销重做与安全持久化。
- **组合比例显示**：内部设计基准与外部显示尺寸独立；工作区按容器实际宽高比例缩放内容、文字、边框与间距，多层组合逐层叠加，不改写原始子项坐标。
- **12px 网格**：80×60 格，画布为 960×720px。拖放按网格吸附；属性面板按像素输入。保留旧 8px 布局的精确位置，不强制舍入。
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
  core/
    grid.ts                 # 12px 网格及 v1 / v2 网格定义
    design-space.ts         # 内部设计基准与外部显示比例
    edit-region.ts          # 显式编辑尺寸、框内边界与范围校验
    types.ts                # 文档、父子关系、容器配置
    model.ts                # 创建、解析、迁移与校验
    tree.ts                 # 层级、边界、同级碰撞与循环检测
    operations.ts           # 批量移动、对齐、分布、组合与子树复制
    combinations.ts         # 本地组合快照与持久化
    store.ts                # 历史记录和旧工作区兼容读写
    layouts.ts              # 多布局保存、最近修改排序及旧记录迁移
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
    layout-library.ts       # 手动库视图切换、布局列表和新建弹窗
    layout-workspace.ts     # 布局切换、独立历史与当前布局自动保存
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
  layout-library-check.ts   # 多布局保存、恢复、门禁及存储失败
```

组件通过 `mount / update / destroy` 与编辑器解耦。布局容器使用 Shadow DOM 内的 slot 让真实子节点参与 CSS 排版，而不是把组件渲染成图片。目录源尺寸沿用 24px 设计单位，由注册表统一转换为当前网格单位。

## 保存与迁移

当前文档格式为 **schemaVersion 3**，保存网格、画布配色、组件列表、`parentId`、容器 `layout` 与内部设计尺寸 `design`。旧容器缺少 `design` 时按原显示像素宽高补齐，保持原视觉与坐标。同级数组顺序决定自动布局顺序；自动布局中的几何尺寸为请求尺寸。原位编辑使用逐层内存草稿，主页面自动保存仍只针对主工作区；只有当前层全部组装并完成，才提交子树更改。标签修改保存为白名单 `elements` 与 `surface` 数据，不保存任意 HTML。

读取 v1（24px）、v2（8px）时，按实际像素换算为 12px 格数，保留亚网格坐标、ID、文案、样式与尺寸，并补齐根级父子关系。再次加载 v3 不重复迁移。布局库使用 `componentweb.layouts.v1`，记录布局 ID、名称、创建 / 修改时间和完整文档；旧 `componentweb.document.v1` 自动迁入默认布局，并保留为当前工作区的兼容镜像。启动以布局库中最近修改的文档为准，不因单纯浏览另一份而改变恢复对象。

「我的组合」单独保存在 `componentweb.combinations.v1`，插入时重建全部 ID 和父子引用。存储失败不会伪报成功；解析会校验组件类型、样式、布局、重复 ID、孤儿、循环和层级深度。

## 验证

已通过 85 项单元测试、1138 次断言及类型检查，覆盖网格迁移、碰撞、多选排版、树结构、样式、组合快照及存储失败。原位编辑另覆盖标签样式白名单、临时叠放、未组装门禁、原位置恢复、多层草稿隔离、反复组装、删除与重建根、模板编辑和自动缩放。浏览器回归覆盖所有内置素材，另外实测多选、框选、批量撤销、Flex / Grid、子项排序、嵌套拖入 / 移出、组合保存与独立副本、右键键盘导航、滚轮 / 触屏滚动和四档响应式。组装显示回归额外检查散件不被编辑框遮挡、右键不误入子项、保存重载后的完整子树、缩放拖动及旧偏移数据的背景填充。

布局库另覆盖旧记录迁移、命名新建、当前布局覆盖保存、最近修改恢复、独立历史、切换前保存、组件草稿门禁、失败恢复和四档响应式；截图为 `/tmp/componentweb-layout-library.png` 与 `/tmp/componentweb-layout-library-mobile.png`。

axe 对编辑器、布局库及新建弹窗、代表性原生标签、组合组件和嵌套布局执行自动检查。自动检查不代替真实读屏器、其他浏览器及触屏设备的人工验收。

当前 Bun CSS 压缩器可能对标准 `::details-content` 选择器发出警告，但会保留该规则；组件库另有整面板滚动回退。开发与生产构建均需通过滚动回归检查。
