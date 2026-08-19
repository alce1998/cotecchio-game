export function beginsCardDrag(deltaX: number, deltaY: number, threshold = 10) {
  return Math.abs(deltaY) >= Math.abs(deltaX) && Math.hypot(deltaX, deltaY) > threshold;
}

export function beginsPointerDrag(pointerType: string, deltaX: number, deltaY: number, threshold = 10) {
  if (pointerType === "mouse") return Math.hypot(deltaX, deltaY) > threshold;
  return beginsCardDrag(deltaX, deltaY, threshold);
}

export function commitsCardDrop(wasDragging: boolean, isOverTrickZone: boolean) {
  return wasDragging && isOverTrickZone;
}
