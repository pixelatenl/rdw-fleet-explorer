export interface TreemapInputItem {
  key: string;
  label: string;
  count: number;
  colorToken: string;
  image?: string;
  /** Optional per-tile text color token, passed through to the rect. */
  inkToken?: string;
}

export interface TreemapRect extends TreemapInputItem {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Squarified treemap layout (Bruls, Huizing and van Wijk, 2000). Items are
 * sorted by descending count, then laid out strip by strip against the
 * shorter remaining side, growing each strip only while the worst aspect
 * ratio in it improves. Each tile's area is exactly proportional to its
 * count, so the coordinates can be expressed in any unit: pixels for a
 * measured container, or ratio units rendered as percentages.
 *
 * Pure function: no DOM access, inputs are never mutated.
 */
export function squarifiedTreemap(
  items: TreemapInputItem[],
  width: number,
  height: number,
): TreemapRect[] {
  if (items.length === 0 || width <= 0 || height <= 0) return [];

  const total = items.reduce((sum, item) => sum + item.count, 0);
  if (total <= 0) return [];

  const ordered = [...items].sort((a, b) => b.count - a.count);
  const scale = (width * height) / total;
  const queue = ordered.map((item) => ({ item, area: item.count * scale }));

  const rects: TreemapRect[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let index = 0;

  function worstRatio(row: { area: number }[], side: number): number {
    const rowArea = row.reduce((sum, entry) => sum + entry.area, 0);
    let min = Infinity;
    let max = 0;
    for (const entry of row) {
      if (entry.area < min) min = entry.area;
      if (entry.area > max) max = entry.area;
    }
    const sideSquared = side * side;
    const rowAreaSquared = rowArea * rowArea;
    return Math.max(
      (sideSquared * max) / rowAreaSquared,
      rowAreaSquared / (sideSquared * min),
    );
  }

  while (index < queue.length) {
    const side = Math.min(w, h);
    const row: typeof queue = [];
    let worst = Infinity;

    // Add items to the strip while the worst aspect ratio improves.
    while (index < queue.length) {
      const ratio = worstRatio([...row, queue[index]], side);
      if (row.length === 0 || ratio <= worst) {
        row.push(queue[index]);
        worst = ratio;
        index += 1;
      } else {
        break;
      }
    }

    const rowArea = row.reduce((sum, entry) => sum + entry.area, 0);
    if (w >= h) {
      // Vertical strip on the left, tiles stacked from the top.
      const stripWidth = rowArea / h;
      let tileY = y;
      for (const entry of row) {
        const tileHeight = entry.area / stripWidth;
        rects.push({
          ...entry.item,
          x,
          y: tileY,
          width: stripWidth,
          height: tileHeight,
        });
        tileY += tileHeight;
      }
      x += stripWidth;
      w -= stripWidth;
    } else {
      // Horizontal strip on top, tiles from the left.
      const stripHeight = rowArea / w;
      let tileX = x;
      for (const entry of row) {
        const tileWidth = entry.area / stripHeight;
        rects.push({
          ...entry.item,
          x: tileX,
          y,
          width: tileWidth,
          height: stripHeight,
        });
        tileX += tileWidth;
      }
      y += stripHeight;
      h -= stripHeight;
    }
  }

  return rects;
}
