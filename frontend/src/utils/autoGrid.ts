/**
 * Auto-grid layout algorithm for GroupCanvas.
 *
 * cols = ceil(sqrt(N))
 * rows = ceil(N / cols)
 * cellW = (canvasW - padding*(cols+1)) / cols
 * cellH = (canvasH - topbarH - promptBarH - padding*(rows+1)) / rows
 * Last row panes are centered if fewer than cols.
 */

export interface GridLayout {
  pane_id: string;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  z_index: number;
}

interface AutoGridOptions {
  canvasW: number;
  canvasH: number;
  topbarH?: number;
  promptBarH?: number;
  padding?: number;
}

export function calculateAutoGrid(
  paneIds: string[],
  opts: AutoGridOptions
): GridLayout[] {
  const {
    canvasW,
    canvasH,
    topbarH = 32,
    promptBarH = 56,
    padding = 8,
  } = opts;

  const N = paneIds.length;
  if (N === 0) return [];

  const usableH = canvasH - topbarH - promptBarH;

  const cols = Math.ceil(Math.sqrt(N));
  const rows = Math.ceil(N / cols);

  const cellW = (canvasW - padding * (cols + 1)) / cols;
  const cellH = (usableH - padding * (rows + 1)) / rows;

  const layouts: GridLayout[] = [];

  for (let i = 0; i < N; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;

    // Panes in the last row — center them if fewer than cols
    const panesInThisRow = row === rows - 1 ? N - row * cols : cols;
    const rowOffset =
      panesInThisRow < cols
        ? ((cols - panesInThisRow) * (cellW + padding)) / 2
        : 0;

    const pos_x = padding + col * (cellW + padding) + rowOffset;
    const pos_y = topbarH + padding + row * (cellH + padding);

    layouts.push({
      pane_id: paneIds[i],
      pos_x,
      pos_y,
      width: cellW,
      height: cellH,
      z_index: 1,
    });
  }

  return layouts;
}
