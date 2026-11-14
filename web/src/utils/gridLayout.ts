/**
 * Justified "fit all" layout: cameras keep their order and aspect ratio,
 * every tile in a row shares that row's height, and the rows are sized so
 * the whole set fits on screen without scrolling. Mixed resolutions (a
 * portrait doorbell beside wide driveways) then pack without the dead space
 * a fixed column grid leaves.
 */

export type GridItem = { aspect: number };

export type TileRect = { x: number; y: number; width: number; height: number };

export type GridLayout = { rects: TileRect[] };

export function gridSpacing(width: number) {
  if (width >= 900) return { gap: 12, padding: 16 };
  if (width >= 768) return { gap: 12, padding: 12 };
  return { gap: 8, padding: 10 };
}

/**
 * Split items, in order, into `rows` contiguous rows whose summed aspect
 * ratios are as even as possible. Rows with similar aspect sums end up with
 * similar heights, which is what keeps the layout tidy.
 */
export function partitionRows(aspects: number[], rows: number): number[][] {
  const n = aspects.length;
  const prefix = [0];
  for (const aspect of aspects) prefix.push(prefix[prefix.length - 1] + aspect);
  const target = prefix[n] / rows;
  const cost = (from: number, to: number) =>
    (prefix[to] - prefix[from] - target) ** 2;

  // best[r][i]: cheapest split of the first i items into r rows
  const best: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(n + 1).fill(Infinity),
  );
  const cut: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  best[0][0] = 0;
  for (let r = 1; r <= rows; r++) {
    for (let i = r; i <= n; i++) {
      for (let j = r - 1; j < i; j++) {
        const total = best[r - 1][j] + cost(j, i);
        if (total < best[r][i]) {
          best[r][i] = total;
          cut[r][i] = j;
        }
      }
    }
  }

  const result: number[][] = [];
  let end = n;
  for (let r = rows; r > 0; r--) {
    const start = cut[r][end];
    result.unshift(Array.from({ length: end - start }, (_, k) => start + k));
    end = start;
  }
  return result;
}

export function fitAllLayout(
  items: GridItem[],
  width: number,
  height: number,
): GridLayout {
  const { gap, padding } = gridSpacing(width);
  const availableWidth = Math.max(0, width - padding * 2);
  const availableHeight = Math.max(0, height - padding * 2);
  if (!items.length || !availableWidth || !availableHeight)
    return { rects: [] };

  const aspects = items.map((item) => item.aspect);
  let best: { rects: TileRect[]; area: number } = { rects: [], area: -1 };

  for (let rowCount = 1; rowCount <= items.length; rowCount++) {
    const rows = partitionRows(aspects, rowCount);
    // height each row needs to span the full width
    const natural = rows.map((row) => {
      const aspectSum = row.reduce((sum, i) => sum + aspects[i], 0);
      return (availableWidth - gap * (row.length - 1)) / aspectSum;
    });
    const naturalHeight = natural.reduce((sum, h) => sum + h, 0);
    const scale = Math.min(
      1,
      (availableHeight - gap * (rows.length - 1)) / naturalHeight,
    );
    if (scale <= 0) continue;

    const rowHeights = natural.map((h) => h * scale);
    const blockHeight =
      rowHeights.reduce((sum, h) => sum + h, 0) + gap * (rows.length - 1);
    let y = padding + Math.max(0, (availableHeight - blockHeight) / 2);
    const rects: TileRect[] = new Array(items.length);
    let area = 0;

    rows.forEach((row, r) => {
      const rowHeight = rowHeights[r];
      const widths = row.map((i) => rowHeight * aspects[i]);
      const rowWidth =
        widths.reduce((sum, w) => sum + w, 0) + gap * (row.length - 1);
      let x = padding + Math.max(0, (availableWidth - rowWidth) / 2);
      row.forEach((i, k) => {
        rects[i] = { x, y, width: widths[k], height: rowHeight };
        area += widths[k] * rowHeight;
        x += widths[k] + gap;
      });
      y += rowHeight + gap;
    });

    if (area > best.area) best = { rects, area };
  }
  return { rects: best.rects };
}
