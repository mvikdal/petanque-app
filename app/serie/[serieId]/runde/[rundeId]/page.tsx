import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import {
  beregnRundeoppsummering,
  rangerRunde,
  type PlassBevegelse,
  type RundeResultat,
  type Rundeoppsummering,
} from "@/lib/ranking";

function ScoreCell({ verdi, kursiv = false }: { verdi: number | null; kursiv?: boolean }) {
  if (verdi === null) {
    return <span className="text-neutral-400">–</span>;
  }
  const farge = verdi > 0 ? "text-emerald-700" : "text-rose-700";
  return (
    <span className={`font-semibold ${farge} ${kursiv ? "italic" : ""}`}>
      {verdi > 0 ? `+${verdi}` : verdi}
    </span>
  );
}

function kortDato(dato: Date) {
  return new Date(dato).toLocaleDateString("no-NO", { day: "numeric", month: "numeric" });
}

function formatPoeng(p: number) {
  return p > 0 ? `+${p}` : String(p);
}

function formatResultat(r: RundeResultat) {
  return `${r.sumSeire} ${formatPoeng(r.sumPoengforskjell)}`;
}

// "Anne", "Anne og Bjørn", "Anne, Bjørn og Cecilie"
function listeNavn(navn: string[]) {
  if (navn.length <= 1) return navn.join("");
  return `${navn.slice(0, -1).join(", ")} og ${navn[navn.length - 1]}`;
}

function plasser(antall: number) {
  return antall === 1 ? "plass" : "plasser";
}

// Endring i sesongtabellen etter runden. Uendret plassering vises ikke.
function BevegelseCelle({ bevegelse }: { bevegelse: PlassBevegelse | undefined }) {
  if (!bevegelse) return null;
  if (bevegelse.før === null) {
    return (
      <span className="text-xs text-neutral-400" title={`Første runde – ${bevegelse.etter}. plass`}>
        ny
      </span>
    );
  }
  const endring = bevegelse.før - bevegelse.etter;
  if (endring === 0) return null;
  const tittel = `Fra ${bevegelse.før}. til ${bevegelse.etter}. plass`;
  return endring > 0 ? (
    <span className="font-semibold text-green-700 whitespace-nowrap" title={tittel}>
      ▲ {endring}
    </span>
  ) : (
    <span className="font-semibold text-red-700 whitespace-nowrap" title={tittel}>
      ▼ {-endring}
    </span>
  );
}

function Oppsummering({ o }: { o: Rundeoppsummering }) {
  const setninger: ReactNode[] = [];

  setninger.push(<>{o.antallDeltakere} deltakere.</>);

  const medaljer: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  for (const p of o.pall) {
    setninger.push(
      <>
        {medaljer[p.plass]} {p.plass}. plass: <strong>{listeNavn(p.spillerNavn)}</strong> –{" "}
        {p.resultat.sumSeire} {p.resultat.sumSeire === 1 ? "seier" : "seire"},{" "}
        {formatPoeng(p.resultat.sumPoengforskjell)}
        {p.plass === 1 && o.serierekord === "ny" && ". Ny serierekord!"}
        {p.plass === 1 && o.serierekord === "tangert" && ". Tangerte serierekorden."}
      </>
    );
  }

  if (o.personligeRekorder.length > 0) {
    setninger.push(
      <>
        ⭐ Ny personlig rekord:{" "}
        {listeNavn(
          o.personligeRekorder.map((p) => `${p.spillerNavn} (${formatResultat(p.resultat)})`)
        )}
        .
      </>
    );
  }

  if (o.ukensKlatrere.length === 1) {
    const k = o.ukensKlatrere[0];
    setninger.push(
      <>
        📈 Ukens klatrer: <strong>{k.spillerNavn}</strong>, opp {k.opp} {plasser(k.opp)} til{" "}
        {k.plassEtter}. plass.
      </>
    );
  } else if (o.ukensKlatrere.length > 1) {
    const opp = o.ukensKlatrere[0].opp;
    setninger.push(
      <>
        📈 Ukens klatrere: <strong>{listeNavn(o.ukensKlatrere.map((k) => k.spillerNavn))}</strong>,
        opp {opp} {plasser(opp)}.
      </>
    );
  }

  if (o.leder && !o.erFørsteRunde) {
    setninger.push(
      o.leder.før !== o.leder.etter ? (
        <>
          Ny leder i sesongtabellen: <strong>{o.leder.etter}</strong>.
        </>
      ) : (
        <>{o.leder.etter} leder fortsatt sesongtabellen.</>
      )
    );
  }

  if (setninger.length === 0) return null;

  return (
    <section className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 shadow-sm">
      <h2 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">
        Oppsummering
      </h2>
      <ul className="text-sm text-neutral-900 space-y-0.5">
        {setninger.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </section>
  );
}

export default async function RundePage({
  params,
}: {
  params: Promise<{ serieId: string; rundeId: string }>;
}) {
  const { serieId, rundeId } = await params;
  const runde = await prisma.runde.findUnique({
    where: { id: rundeId },
    include: {
      serie: {
        include: {
          runder: { include: { deltakelser: { include: { spiller: true } } } },
        },
      },
      deltakelser: { include: { spiller: true } },
      endringer: { orderBy: { tidspunkt: "desc" } },
    },
  });
  if (!runde || runde.serieId !== serieId) notFound();

  const rangert = rangerRunde(
    runde.deltakelser.map((d) => ({
      spillerId: d.spillerId,
      spillerNavn: d.spiller.navn,
      kamp1: d.kamp1,
      kamp2: d.kamp2,
      kamp3: d.kamp3,
    }))
  );

  // Oppsummering og plassbevegelse trenger hele serien: sesongtabellen
  // beregnes med og uten denne runden.
  const oppsummering = beregnRundeoppsummering(
    runde.serie.runder.map((r) => ({
      rundeId: r.id,
      dato: r.dato,
      rundenummer: r.rundenummer,
      deltakelser: r.deltakelser.map((d) => ({
        spillerId: d.spillerId,
        spillerNavn: d.spiller.navn,
        kamp1: d.kamp1,
        kamp2: d.kamp2,
        kamp3: d.kamp3,
      })),
    })),
    runde.id,
    runde.serie.antallTellendeRunder
  );

  // Forrige/neste runde i datorekkefølge (rundenummer følger datoen).
  const kronologisk = [...runde.serie.runder].sort(
    (a, b) => a.dato.getTime() - b.dato.getTime() || a.rundenummer - b.rundenummer
  );
  const indeks = kronologisk.findIndex((r) => r.id === runde.id);
  const forrige = kronologisk[indeks - 1];
  const neste = kronologisk[indeks + 1];

  const navigasjon = (
    <nav className="flex justify-between gap-4 text-sm" aria-label="Runder i serien">
      {forrige ? (
        <Link
          href={`/serie/${serieId}/runde/${forrige.id}`}
          className="text-indigo-700 font-medium hover:underline"
        >
          ← Runde {forrige.rundenummer} · {kortDato(forrige.dato)}
        </Link>
      ) : (
        <span />
      )}
      {neste && (
        <Link
          href={`/serie/${serieId}/runde/${neste.id}`}
          className="text-indigo-700 font-medium hover:underline text-right"
        >
          Runde {neste.rundenummer} · {kortDato(neste.dato)} →
        </Link>
      )}
    </nav>
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/serie/${serieId}`} className="text-sm text-indigo-700 font-medium hover:underline">
          ← {runde.serie.navn}
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900 mt-1">
          Runde {runde.rundenummer} · {new Date(runde.dato).toLocaleDateString("no-NO")}
        </h1>
      </div>

      {navigasjon}

      <Oppsummering o={oppsummering} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg shadow-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left">
              <th className="px-3 py-2 text-neutral-700">Plass</th>
              <th className="px-3 py-2 text-neutral-700">Spiller</th>
              <th className="px-3 py-2 text-neutral-700">Kamp 1</th>
              <th className="px-3 py-2 text-neutral-700">Kamp 2</th>
              <th className="px-3 py-2 text-neutral-700">Kamp 3</th>
              <th className="px-3 py-2 text-neutral-700">Seire</th>
              <th className="px-3 py-2 text-neutral-700">Poeng</th>
              <th
                className="px-3 py-2 text-neutral-700 text-center"
                title="Endring i sesongtabellen etter denne runden"
              >
                Klatring
              </th>
            </tr>
          </thead>
          <tbody>
            {rangert.map((r, i) => (
              <tr
                key={r.spillerId}
                className={`border-b border-neutral-100 last:border-0 ${
                  r.plass === 1 ? "bg-amber-50" : i % 2 === 1 ? "bg-neutral-50" : ""
                }`}
              >
                <td className="px-3 py-2 font-semibold text-neutral-900">{r.plass}</td>
                <td className="px-3 py-2 font-semibold text-neutral-900">{r.spillerNavn}</td>
                <td className="px-3 py-2">
                  <ScoreCell verdi={r.kamp1} />
                </td>
                <td className="px-3 py-2">
                  <ScoreCell verdi={r.kamp2} />
                </td>
                <td className="px-3 py-2">
                  <ScoreCell verdi={r.kamp3} />
                </td>
                <td
                  className={`px-3 py-2 font-medium text-neutral-900 ${
                    r.erFullstendig ? "" : "italic"
                  }`}
                >
                  {r.sumSeire}
                </td>
                <td className="px-3 py-2">
                  <ScoreCell verdi={r.sumPoengforskjell} kursiv={!r.erFullstendig} />
                </td>
                <td className="px-3 py-2 text-center">
                  <BevegelseCelle bevegelse={oppsummering.bevegelse.get(r.spillerId)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rangert.some((r) => !r.erFullstendig) && (
          <p className="mt-2 text-xs text-neutral-700">
            <span className="italic">Kursiv</span> seire og poeng: ufullstendig resultat – ikke
            alle kampene ble spilt i runden.
          </p>
        )}
      </div>

      {navigasjon}

      {runde.endringer.length > 0 && (
        <div className="text-sm text-neutral-700 border-t border-neutral-200 pt-4">
          <p className="font-semibold text-neutral-900 mb-2">Rettet i etterkant</p>
          <ul className="space-y-1">
            {runde.endringer.map((e) => (
              <li key={e.id}>
                {new Date(e.tidspunkt).toLocaleString("no-NO", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {e.kommentar ? ` – ${e.kommentar}` : " – (ingen kommentar)"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
