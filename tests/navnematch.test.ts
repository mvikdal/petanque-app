import { describe, expect, it } from "vitest";
import { matchSpillere, normaliserNavn } from "@/lib/navnematch";

const spillere = [
  { id: "oy", navn: "Øystein" },
  { id: "lars", navn: "Lars" },
  { id: "jan", navn: "Jan Erik Hansen" },
  { id: "morten", navn: "Morten" },
  { id: "marius", navn: "Marius" },
  { id: "rene", navn: "René" },
  { id: "aase", navn: "Åse" },
];
const ider = (navn: string[]) => matchSpillere(navn, spillere).map((t) => t.spillerId);

describe("matchSpillere", () => {
  it("eksakte treff, uavhengig av store/små bokstaver", () => {
    expect(matchSpillere(["Lars", "øystein"], spillere)).toEqual([
      { spillerId: "lars", sikkerhet: "eksakt" },
      { spillerId: "oy", sikkerhet: "eksakt" },
    ]);
  });

  it("bare fornavn og skrivefeil gir sannsynlig treff", () => {
    expect(matchSpillere(["Jan", "Mortn", "Oystein"], spillere)).toEqual([
      { spillerId: "jan", sikkerhet: "sannsynlig" },
      { spillerId: "morten", sikkerhet: "sannsynlig" },
      { spillerId: "oy", sikkerhet: "sannsynlig" },
    ]);
  });

  it("aksenter og æøå", () => {
    expect(normaliserNavn(" René! ")).toBe("rene");
    expect(normaliserNavn("Åse")).toBe("åse");
    expect(ider(["Rene", "Åse"])).toEqual(["rene", "aase"]);
  });

  it("flertydige og ukjente navn matches ikke", () => {
    // «Ma» kan være Marius eller Morten (for kort til forkortelse uansett).
    expect(ider(["Mar", "Pete", "Ma"])).toEqual(["marius", null, null]);
    const k = [{ id: "knut", navn: "Knut" }, { id: "kurt", navn: "Kurt" }];
    expect(matchSpillere(["Kut"], k)[0].spillerId).toBeNull(); // like nær begge
  });

  it("samme spiller kan ikke matches to ganger - sikreste treff vinner", () => {
    expect(ider(["Larss", "Lars"])).toEqual([null, "lars"]);
  });
});
