// Kobler navn lest fra et resultatark til spillerne i serien. Bare treff
// som er entydige godtas - alt annet blir stående umatchet, så admin
// velger spiller selv.

export type Treff = { spillerId: string | null; sikkerhet: "eksakt" | "sannsynlig" | null };

type Spiller = { id: string; navn: string };

// Små bokstaver, uten tegnsetting og aksenter (é -> e), men med æ, ø og å.
export function normaliserNavn(navn: string) {
  return navn
    .toLowerCase()
    .normalize("NFD")
    .replace(/å/g, "å")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .replace(/[^\p{L}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  let forrige = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const rad = [i];
    for (let j = 1; j <= b.length; j++) {
      rad[j] = Math.min(
        forrige[j] + 1,
        rad[j - 1] + 1,
        forrige[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    forrige = rad;
  }
  return forrige[b.length];
}

// rang: 0 = eksakt, 1 = fornavn/forkortelse, 2 = skrivefeil (+ avstand).
function finnKandidat(arknavn: string, spillere: { id: string; norm: string }[]) {
  if (!arknavn) return null;

  const eksakt = spillere.filter((s) => s.norm === arknavn);
  if (eksakt.length === 1) return { id: eksakt[0].id, rang: 0 };
  if (eksakt.length > 1) return null;

  const delvis = spillere.filter(
    (s) =>
      s.norm.split(" ")[0] === arknavn ||
      (arknavn.length >= 3 && s.norm.startsWith(arknavn)) ||
      arknavn.startsWith(s.norm + " ")
  );
  if (delvis.length === 1) return { id: delvis[0].id, rang: 1 };
  if (delvis.length > 1) return null;

  const maks = arknavn.length <= 4 ? 1 : 2;
  const avstander = spillere
    .map((s) => ({
      id: s.id,
      avstand: Math.min(levenshtein(arknavn, s.norm), levenshtein(arknavn, s.norm.split(" ")[0])),
    }))
    .filter((a) => a.avstand <= maks)
    .sort((a, b) => a.avstand - b.avstand);
  if (avstander.length === 0) return null;
  if (avstander.length > 1 && avstander[1].avstand === avstander[0].avstand) return null;
  return { id: avstander[0].id, rang: 2 + avstander[0].avstand / 10 };
}

// Ett treff per navn, i samme rekkefølge. Får to navn samme spiller,
// beholdes det sikreste treffet og det andre blir umatchet.
export function matchSpillere(navnPaaArk: string[], spillere: Spiller[]): Treff[] {
  const normert = spillere.map((s) => ({ id: s.id, norm: normaliserNavn(s.navn) }));
  const kandidater = navnPaaArk.map((n) => finnKandidat(normaliserNavn(n), normert));

  const treff: Treff[] = navnPaaArk.map(() => ({ spillerId: null, sikkerhet: null }));
  const brukt = new Set<string>();
  const rekkefølge = kandidater
    .map((k, i) => ({ k, i }))
    .filter((x) => x.k !== null)
    .sort((a, b) => a.k!.rang - b.k!.rang);

  for (const { k, i } of rekkefølge) {
    if (brukt.has(k!.id)) continue;
    brukt.add(k!.id);
    treff[i] = { spillerId: k!.id, sikkerhet: k!.rang === 0 ? "eksakt" : "sannsynlig" };
  }
  return treff;
}
