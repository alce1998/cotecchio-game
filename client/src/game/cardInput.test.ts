import { describe, expect, it } from "vitest";
import { beginsCardDrag, beginsPointerDrag, commitsCardDrop } from "./cardInput";

describe("gesti della mano", () => {
  it("mantiene lo scorrimento orizzontale separato dal trascinamento verticale", () => {
    expect(beginsCardDrag(28, 5)).toBe(false);
    expect(beginsCardDrag(3, -26)).toBe(true);
  });

  it("consente il trascinamento del mouse anche con un percorso diagonale", () => {
    expect(beginsPointerDrag("mouse", 120, -50)).toBe(true);
    expect(beginsPointerDrag("touch", 120, -50)).toBe(false);
  });

  it("gioca una carta solo quando il rilascio avviene nel campo", () => {
    expect(commitsCardDrop(true, true)).toBe(true);
    expect(commitsCardDrop(true, false)).toBe(false);
    expect(commitsCardDrop(false, true)).toBe(false);
  });
});
