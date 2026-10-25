import { importedDefinition, readImports } from './imported';
import { button } from './button';
import { card } from './card';
import { metric } from './metric';
import { input } from './input';
import type { ComponentDefinition } from './contract';
import { nativeElements } from './native';
import { commonComponents } from './common';
import { container } from './container';
import { catalogueSize } from '../core/grid';

// 只在注册边界换算一次，目录中的组件实现与默认物理尺寸保持不变。
export const components: ComponentDefinition[] = [card, metric, button, input, ...commonComponents, ...nativeElements, container]
  .map(definition => ({ ...definition, size: catalogueSize(definition.size), min: catalogueSize(definition.min) }));
components.push(...readImports().map(importedDefinition));
export const registry = new Map(components.map(component => [component.type, component]));
