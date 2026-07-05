/**
 * ============================================================
 * diagramCapacity.test.js — Editor Panel Clutter / Capacity Tests
 * ============================================================
 *
 * WHY THIS FILE EXISTS:
 * (getDefaultElementPosition / getDefaultElementSize in diagramUtils.js,
 * the same helpers UMLEditor.addElement() now calls) and measuring two
 * concrete, reproducible signals of clutter:
 *
 *   1. Overlap count — how many pairs of boxes visually collide.
 *   2. Diagram bounds — how large the full canvas grows, compared
 *      against a typical 1600x900 laptop viewport at 100% zoom.
 *
 * These are not pass/fail correctness tests of the transformation
 * algorithms — they are a capacity benchmark, intended to be read
 * (and cited in the thesis) as much as run.
 * ============================================================
 */

import {
  getDefaultElementPosition,
  getDefaultElementSize,
  countOverlappingPairs,
  computeDiagramBounds,
} from '../diagramUtils';

/** Builds N sequentially-placed default class elements, exactly as
 *  clicking "Class" in the tool palette N times would. */
function buildDefaultClassElements(n) {
  const elements = [];
  for (let i = 0; i < n; i++) {
    const { x, y } = getDefaultElementPosition(i);
    const { width, height } = getDefaultElementSize('class');
    elements.push({ id: `el-${i}`, type: 'class', x, y, width, height, name: `Class${i}` });
  }
  return elements;
}

// A common laptop/editor viewport at 100% zoom, used only as a reference
// point for "would this fit on screen without scrolling or zooming out".
const VIEWPORT = { width: 1600, height: 900 };

describe('Editor Panel capacity / clutter benchmark', () => {
  const capacityReport = [];

  afterAll(() => {
    // Printed once at the end of the run so the numbers are easy to
    // paste into the thesis or a follow-up compliance response.
    // eslint-disable-next-line no-console
    console.table(capacityReport);
  });

  test.each([5, 10, 20, 30, 40, 50])(
    'placing %i default class elements — overlap & bounds check',
    (count) => {
      const elements = buildDefaultClassElements(count);
      const overlaps = countOverlappingPairs(elements);
      const bounds = computeDiagramBounds(elements);
      const exceedsViewport = bounds.width > VIEWPORT.width || bounds.height > VIEWPORT.height;

      capacityReport.push({
        elements: count,
        overlappingPairs: overlaps,
        diagramWidth: Math.round(bounds.width),
        diagramHeight: Math.round(bounds.height),
        exceedsDefaultViewport: exceedsViewport,
      });

      // Sanity: bounds must grow monotonically and never be degenerate.
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);

      // The known clutter behavior at default placement: because each new
      // element cascades by only 20px while boxes are 200x150, overlap is
      // expected well before 20 elements. This assertion documents that
      // fact rather than hiding it, so it will fail loudly (as an early
      // warning) if the default cascade offset is ever widened enough to
      // remove the overlap this comment describes.
      if (count >= 10) {
        expect(overlaps).toBeGreaterThan(0);
      }
    }
  );

  test('documents the element count at which the canvas first exceeds a standard 1600x900 viewport', () => {
    let firstOverflowAt = null;
    for (let n = 1; n <= 60; n++) {
      const bounds = computeDiagramBounds(buildDefaultClassElements(n));
      if (bounds.width > VIEWPORT.width || bounds.height > VIEWPORT.height) {
        firstOverflowAt = n;
        break;
      }
    }
    // eslint-disable-next-line no-console
    console.log(`First exceeds 1600x900 viewport at element count: ${firstOverflowAt}`);
    expect(firstOverflowAt).not.toBeNull();
  });

  test('documents the element count at which boxes first start overlapping under default placement', () => {
    let firstOverlapAt = null;
    for (let n = 1; n <= 60; n++) {
      if (countOverlappingPairs(buildDefaultClassElements(n)) > 0) {
        firstOverlapAt = n;
        break;
      }
    }
    // eslint-disable-next-line no-console
    console.log(`First overlapping pair appears at element count: ${firstOverlapAt}`);
    expect(firstOverlapAt).not.toBeNull();
  });
});
