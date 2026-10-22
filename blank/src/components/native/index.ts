import { textElements } from './text';
import { structureElements } from './structure';
import { formElements } from './forms';
import { mediaElements } from './media';
import { dataElements } from './data';

export const nativeElements = [...textElements, ...structureElements, ...formElements, ...mediaElements, ...dataElements];
