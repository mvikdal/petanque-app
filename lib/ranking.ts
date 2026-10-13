// Ren beregningslogikk for seriespill, se docs/petanque-seriespill-spec.md §5-6.
// Ingen avhengighet til Prisma-typer, slik at funksjonene er lette å teste isolert.

// En spiller har ikke alltid anledning til å spille alle 3 kampene i en
// runde (avklart 2026-10-13) - null betyr "ikke spilt", ikke 0-1-0 tap.
export type KampResultat = {
  kamp1: number | null;
  kamp2: number | null;
  kamp3: number | null;
};

export type RundeResultat = {
  sumSeire: number; // 0-3, kun av spilte kamper
  sumPoengforskjell: number; // signert sum over de spilte kampene
  erFullstendig: boolean; // true kun hvis alle 3 kampene er spilt
};

export function beregnRundeResultat(k: KampResultat): RundeResultat {
  const kamper = [k.kamp1, k.kamp2, k.kamp3];
  const spilteKamper = kamper.filter((p): p is number => p !== null);
  return {
    sumSeire: spilteKamper.filter((p) => p > 0).length,
    sumPoengforskjell: spilteKamper.reduce((sum, p) => sum + p, 0),
    erFullstendig: spilteKamper.length === 3,
  };
}

// Sorterer rundescore høyest først: flest sumSeire, ved likt best sumPoengforskjell (spec §5).
export function sammenlignRundeResultat(a: RundeResultat, b: RundeResultat): number {
  if (b.sumSeire !== a.sumSeire) return b.sumSeire - a.sumSeire;
  return b.sumPoengforskjell - a.sumPoengforskjell;
}

export type SpillerIRunde = {
  spillerId: string;
  spillerNavn: string;
} & KampResultat;

export type RangertSpillerIRunde = SpillerIRunde &
  RundeResultat & { plass: number };

// Rangering innad i én runde, spec §5.
export function rangerRunde(deltakelser: SpillerIRunde[]): RangertSpillerIRunde[] {
  return deltakelser
    .map((d) => ({ ...d, ...beregnRundeResultat(d) }))
    .sort(sammenlignRundeResultat)
    .map((d, i) => ({ ...d, plass: i + 1 }));
}

export type SpillerSesongBlokk = {
  snittSeire: number;
  totaltPoeng: number;
  antallRunder: number;
};

export type SpillerSesongResultat = {
  spillerId: string;
  spillerNavn: string;
  antallSpilteRunder: number;
  blokkA: SpillerSesongBlokk; // beste N runder - grunnlag for rangering
  blokkB: SpillerSesongBlokk; // alle spilte runder - kun til sammenligning
};

function beregnBlokk(runder: RundeResultat[]): SpillerSesongBlokk {
  if (runder.length === 0) {
    return { snittSeire: 0, totaltPoeng: 0, antallRunder: 0 };
  }
  const totaltPoeng = runder.reduce((sum, r) => sum + r.sumPoengforskjell, 0);
  const totalSeire = runder.reduce((sum, r) => sum + r.sumSeire, 0);
  return {
    snittSeire: totalSeire / runder.length,
    totaltPoeng,
    antallRunder: runder.length,
  };
}

export type SpillerMedRunder = {
  spillerId: string;
  spillerNavn: string;
  runder: RundeResultat[]; // én per fullført runde spilleren deltok i
};

// Sesongtabell, spec §6: rangert på blokk A (beste N runder), blokk B kun informativ.
export function beregnSesongtabell(
  spillere: SpillerMedRunder[],
  antallTellendeRunder: number
): SpillerSesongResultat[] {
  return spillere
    .map((s) => {
      const sortert = [...s.runder].sort(sammenlignRundeResultat);
      const besteN = sortert.slice(0, antallTellendeRunder);
      return {
        spillerId: s.spillerId,
        spillerNavn: s.spillerNavn,
        antallSpilteRunder: s.runder.length,
        blokkA: beregnBlokk(besteN),
        blokkB: beregnBlokk(sortert),
      };
    })
    .sort((a, b) => {
      if (b.blokkA.snittSeire !== a.blokkA.snittSeire) {
        return b.blokkA.snittSeire - a.blokkA.snittSeire;
      }
      return b.blokkA.totaltPoeng - a.blokkA.totaltPoeng;
    });
}

// Gyldig poengforskjell-område følger seriens poengGrense (avklart 2026-09-14).
export function erGyldigPoengforskjell(verdi: number, poengGrense: number): boolean {
  return Number.isInteger(verdi) && verdi !== 0 && Math.abs(verdi) <= poengGrense;
}
