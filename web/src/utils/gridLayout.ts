/** Column count that shows every camera as large as possible without scrolling. */

export type GridItem = { aspect: number };

export type GridLayout = { columns: number; tileWidth: number };

export function gridSpacing(width: number) {
  if (width >= 900) return { gap: 12, padding: 16 };
  if (width >= 768) return { gap: 12, padding: 12 };
  return { gap: 8, padding: 10 };
}

export function fitAllLayout(
  items: GridItem[],
  width: number,
  height: number,
): GridLayout {
  const { gap, padding } = gridSpacing(width);
  const availableWidth = Math.max(0, width - padding * 2);
  const availableHeight = Math.max(0, height - padding * 2);
  if (!items.length || !availableWidth || !availableHeight) {
    return { columns: Math.min(2, Math.max(1, items.length)), tileWidth: 0 };
  }

  let best: GridLayout = { columns: 1, tileWidth: 0 };
  for (let columns = 1; columns <= items.length; columns++) {
    const rows = Math.ceil(items.length / columns);
    const columnWidth = (availableWidth - gap * (columns - 1)) / columns;
    let tileHeights = 0;
    for (let row = 0; row < rows; row++) {
      const rowItems = items.slice(row * columns, row * columns + columns);
      tileHeights += Math.max(
        ...rowItems.map((item) => columnWidth / item.aspect),
      );
    }
    const scale =
      tileHeights > 0
        ? Math.min(1, (availableHeight - gap * (rows - 1)) / tileHeights)
        : 1;
    const tileWidth = columnWidth * scale;
    if (tileWidth > best.tileWidth) best = { columns, tileWidth };
  }
  return best;
}
