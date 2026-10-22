import { button } from './button';
import { card } from './card';
import { metric } from './metric';
import { input } from './input';
import type { ComponentDefinition } from './contract';

export const components: ComponentDefinition[] = [card, metric, button, input];
export const registry = new Map(components.map(component => [component.type, component]));
