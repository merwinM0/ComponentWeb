export interface GuideRect { col: number; row: number; colSpan: number; rowSpan: number }
export interface AlignmentGuide { axis: 'x' | 'y'; at: number; from: number; to: number }
/** Geometry is in world grid coordinates. Guides are visual only; placement still obeys grid and collision rules. */
export function alignmentGuides(moving: GuideRect, siblings: GuideRect[], tolerance: number): AlignmentGuide[] {
  const result: AlignmentGuide[] = [];
  for (const axis of ['x', 'y'] as const) {
    const [position, span, other, otherSpan] = axis === 'x' ? ['col', 'colSpan', 'row', 'rowSpan'] as const : ['row', 'rowSpan', 'col', 'colSpan'] as const;
    let distance = tolerance + 1e-9, chosen: AlignmentGuide | undefined;
    for (const sibling of siblings) {
      for (const fraction of [0, 0.5, 1]) for (const target of [0, 0.5, 1]) {
        const at = sibling[position] + sibling[span] * target;
        const delta = Math.abs(moving[position] + moving[span] * fraction - at);
        if (delta <= tolerance && delta < distance) {
          distance = delta;
          chosen = { axis, at, from: Math.min(moving[other], sibling[other]), to: Math.max(moving[other] + moving[otherSpan], sibling[other] + sibling[otherSpan]) };
        }
      }
    }
    if (chosen) result.push(chosen);
  }
  return result;
}
