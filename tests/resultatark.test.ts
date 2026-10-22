import { describe, expect, it } from "vitest";
import { kontrollerRad, tolkDato, type LestRad } from "@/lib/resultatark";

// Parene «seier±forskjell» slik de står på det håndskrevne eksempelarket
// (docs/eksempelark/handskrevet-21okt.jpg). Siste par er totalen.
const par = (s: number, f: number | null) => ({ seier: f === null ? null : s, forskjell: f });
const rad = (navn: string, p: [number, number][], total: [number, number] | null): LestRad => ({
  navnPaaArk: navn,
  kamp1: par(...p[0]),
  kamp2: par(...p[1]),
  kamp3: par(...p[2]),
  total: total && { seire: total[0], forskjell: total[1] },
  usikkert: false,
});

const handskrevet = [
  rad("Endre", [[0, -7], [1, 5], [0, -10]], [1, -12]),
  rad("Øystein", [[0, -7], [1, 6], [1, 10]], [2, 9]),
  rad("Robin", [[1, 3], [0, -5], [1, 12]], [2, 10]),
  rad("Jan", [[0, -3], [1, 5], [1, 12]], [2, 14]),
  rad("Knut", [[1, 3], [0, -5], [0, -12]], [1, -14]),
  rad("Geir", [[1, 7], [0, -6], [0, -12]], [1, -11]),
  rad("Morten", [[1, 7], [0, -6], [0, -10]], [1, -9]),
];

describe("kontrollerRad", () => {
  it.each(handskrevet.map((r) => [r.navnPaaArk, r] as const))("%s går opp", (_n, r) => {
    expect(kontrollerRad(r, 13)).toEqual([]);
  });

  it("flagger fortegn som ikke stemmer med seier/tap", () => {
    const r = rad("Jan", [[0, 3], [1, 5], [1, 12]], null);
    expect(kontrollerRad(r, 13)).toEqual([expect.stringMatching(/Kamp 1: fortegnet/)]);
  });

  it("flagger feil total («1+5» lest som 15)", () => {
    const r = rad("Jan", [[0, -3], [1, 15], [1, 12]], [2, 14]);
    const advarsler = kontrollerRad(r, 13);
    expect(advarsler).toContainEqual(expect.stringMatching(/Kamp 2: ugyldig/));
    expect(advarsler).toContainEqual(expect.stringMatching(/Summen \(24\)/));
  });

  it("flagger feil antall seire", () => {
    const r = rad("Knut", [[1, 3], [0, -5], [0, -12]], [2, -14]);
    expect(kontrollerRad(r, 13)).toEqual([expect.stringMatching(/Antall seire/)]);
  });

  it("godtar kamp som ikke ble spilt, og flagger tom rad", () => {
    expect(kontrollerRad(rad("A", [[1, 4], [0, null as never], [0, null as never]], [1, 4]), 13)).toEqual([]);
    expect(kontrollerRad(rad("B", [[0, null as never], [0, null as never], [0, null as never]], null), 13))
      .toEqual(["Fant ingen resultater i raden."]);
  });
});

describe("tolkDato", () => {
  const start = new Date("2026-09-01");
  const slutt = new Date("2027-04-30");

  it.each([
    ["14. okt.", "2026-10-14"],
    ["21 okt", "2026-10-21"],
    ["Dato: 3. februar", "2027-02-03"],
    ["14.10", "2026-10-14"],
    ["14.10.2026", "2026-10-14"],
    ["2026-10-14", "2026-10-14"],
  ])("%s -> %s", (tekst, forventet) => {
    expect(tolkDato(tekst, start, slutt)).toBe(forventet);
  });

  it("gir null for manglende eller ugyldig dato", () => {
    expect(tolkDato(null, start, slutt)).toBeNull();
    expect(tolkDato("Vinterkula", start, slutt)).toBeNull();
    expect(tolkDato("31. feb", start, slutt)).toBeNull();
  });
});
