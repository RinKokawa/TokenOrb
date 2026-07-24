export type Point = { x: number; y: number };

export type Size = { width: number; height: number };

export type Rectangle = Point & Size;

export type WorkArea = Rectangle;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const computeDragPosition = (
  startBounds: Rectangle,
  startCursor: Point,
  cursor: Point,
): Point => ({
  x: startBounds.x + cursor.x - startCursor.x,
  y: startBounds.y + cursor.y - startCursor.y,
});

export const clampPointToWorkArea = (point: Point, size: Size, workArea: WorkArea): Point => ({
  x: clamp(point.x, workArea.x, workArea.x + workArea.width - size.width),
  y: clamp(point.y, workArea.y, workArea.y + workArea.height - size.height),
});

export const clampBoundsToWorkArea = (bounds: Rectangle, workArea: WorkArea): Rectangle => ({
  x: clamp(bounds.x, workArea.x, workArea.x + workArea.width - bounds.width),
  y: clamp(bounds.y, workArea.y, workArea.y + workArea.height - bounds.height),
  width: bounds.width,
  height: bounds.height,
});

export const positionResizedBoundsInWorkArea = (
  currentBounds: Rectangle,
  targetSize: Size,
  workArea: WorkArea,
): Rectangle =>
  clampBoundsToWorkArea(
    {
      x: currentBounds.x,
      y: currentBounds.y,
      width: targetSize.width,
      height: targetSize.height,
    },
    workArea,
  );

export const isWithinWorkArea = (bounds: Rectangle, workArea: WorkArea): boolean =>
  bounds.x >= workArea.x &&
  bounds.y >= workArea.y &&
  bounds.x + bounds.width <= workArea.x + workArea.width &&
  bounds.y + bounds.height <= workArea.y + workArea.height;
