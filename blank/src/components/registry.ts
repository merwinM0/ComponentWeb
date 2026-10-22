import { button } from './button';
import { card } from './card';
import { metric } from './metric';
import { input } from './input';
import type { ComponentDefinition } from './contract';
import { nativeElements } from './native';
import { commonComponents } from './common';

export const components: ComponentDefinition[] = [card, metric, button, input, ...commonComponents, ...nativeElements];
export const registry = new Map(components.map(component => [component.type, component]));
