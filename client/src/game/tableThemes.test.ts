import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("../pages/Home.tsx", import.meta.url), "utf8");
const themeStyleSource = readFileSync(new URL("../pages/tableThemes.css", import.meta.url), "utf8");

describe("preferenza grafica del tavolo", () => {
  it("non trasmette il tema nelle operazioni di matchmaking online", () => {
    const onlineStart = homeSource.match(/function startOnlineMatch\(\) \{[\s\S]*?\n  \}/)?.[0] ?? "";

    expect(onlineStart).toContain("createPrivate.mutate({ scoreLimit: 100 })");
    expect(onlineStart).toContain("joinPrivate.mutate({ inviteCode })");
    expect(onlineStart).toContain("joinOnline.mutate({ scoreLimit: 100 })");
    expect(onlineStart).not.toContain("tableTheme");
  });

  it("persiste il tema solo nel localStorage del browser", () => {
    expect(homeSource).toContain('window.localStorage.getItem("cotecchio-table-theme")');
    expect(homeSource).toContain('window.localStorage.setItem("cotecchio-table-theme", tableTheme)');
  });

  it("definisce anteprime e tavoli distinti, compreso il layout mobile", () => {
    for (const theme of ["taverna", "cibali", "balconera", "massimino", "mestalla"]) {
      expect(themeStyleSource).toContain(`.theme-preview.${theme}`);
      if (theme !== "taverna") expect(themeStyleSource).toContain(`.table-theme-${theme} .table-ring`);
    }
    expect(themeStyleSource).toContain("@media(max-width:620px){.theme-picker>div{grid-template-columns:repeat(3,1fr)}");
  });
});
