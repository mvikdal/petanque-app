import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import {
  beregnRundeResultat,
  beregnSesongtabell,
  rangerRunde,
  sammenlignRundeResultat,
  type SpillerMedRunder,
} from "@/lib/ranking";

function formatPoeng(p: number) {
  return p > 0 ? `+${p}` : String(p);
}

export default async function SeriePage({
  params,
}: {
  params: Promise<{ serieId: string }>;
}) {
  const { serieId } = await params;
  const serie = await prisma.serie.findUnique({
    where: { id: serieId },
    include: {
      runder: {
        orderBy: { rundenummer: "desc" },
        include: { deltakelser: { include: { spiller: true } } },
      },
    },
  });
  if (!serie) notFound();

  const perSpiller = new Map<string, SpillerMedRunder>();
  for (const runde of serie.runder) {
    for (const d of runde.deltakelser) {
      const eksisterende = perSpiller.get(d.spillerId) ?? {
        spillerId: d.spillerId,
        spillerNavn: d.spiller.navn,
        runder: [],
      };
      eksisterende.runder.push({
        sumSeire: [d.kamp1, d.kamp2, d.kamp3].filter((p) => p > 0).length,
        sumPoengforskjell: d.kamp1 + d.kamp2 + d.kamp3,
      });
      perSpiller.set(d.spillerId, eksisterende);
    }
  }
  const sesongtabell = beregnSesongtabell(
    Array.from(perSpiller.values()),
    serie.antallTellendeRunder
  );

  // Serierekord: beste enkeltrunde-resultat (sumSeire, deretter sumPoengforskjell)
  // registrert i serien så langt. Flere kan dele rekorden.
  type Serierekord = {
    spillerNavn: string;
    rundeId: string;
    rundenummer: number;
    dato: Date;
    sumSeire: number;
    sumPoengforskjell: number;
  };
  let serierekord: Serierekord[] = [];
  for (const runde of serie.runder) {
    for (const d of runde.deltakelser) {
      const resultat = beregnRundeResultat(d);
      const sammenligning =
        serierekord.length === 0
          ? -1
          : sammenlignRundeResultat(resultat, serierekord[0]);
      if (sammenligning < 0) {
        serierekord = [
          {
            spillerNavn: d.spiller.navn,
            rundeId: runde.id,
            rundenummer: runde.rundenummer,
            dato: runde.dato,
            ...resultat,
          },
        ];
      } else if (sammenligning === 0) {
        serierekord.push({
          spillerNavn: d.spiller.navn,
          rundeId: runde.id,
          rundenummer: runde.rundenummer,
          dato: runde.dato,
          ...resultat,
        });
      }
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{serie.navn}</h1>
        <p className="text-sm text-neutral-700">
          Poeng til {serie.poengGrense} · beste {serie.antallTellendeRunder} runder
          teller · {serie.status}
        </p>
      </div>

      {serierekord.length > 0 && (
        <section className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 shadow-sm">
          <h2 className="text-xs font-bold text-rose-700 uppercase tracking-wide mb-1">
            🏆 Serierekord
          </h2>
          {serierekord.map((r) => (
            <div key={`${r.spillerNavn}-${r.rundeId}`} className="text-sm text-neutral-900">
              <span className="font-bold">{r.spillerNavn}</span> – {r.sumSeire} seire,{" "}
              <span className="font-semibold">{formatPoeng(r.sumPoengforskjell)} poeng</span>{" "}
              <Link
                href={`/serie/${serie.id}/runde/${r.rundeId}`}
                className="text-rose-700 hover:underline"
              >
                (runde {r.rundenummer} · {new Date(r.dato).toLocaleDateString("no-NO")})
              </Link>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2 className="font-semibold text-neutral-900 border-b-2 border-indigo-600 inline-block pb-1 mb-3">
          Sesongtabell
        </h2>
        {sesongtabell.length === 0 ? (
          <p className="text-sm text-neutral-700">Ingen fullførte runder ennå.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white border border-neutral-200 rounded-lg shadow-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-3 py-2 border-b border-neutral-200 text-neutral-700" rowSpan={2}>
                    #
                  </th>
                  <th className="px-3 py-2 border-b border-neutral-200 text-neutral-700" rowSpan={2}>
                    Spiller
                  </th>
                  <th
                    className="px-3 py-2 bg-indigo-100 text-indigo-900 font-semibold text-center border-b border-indigo-200"
                    colSpan={2}
                  >
                    Tellende runder – {serie.antallTellendeRunder}
                  </th>
                  <th
                    className="px-3 py-2 bg-neutral-100 text-neutral-700 font-semibold text-center border-b border-neutral-300"
                    colSpan={2}
                  >
                    Alle runder – {serie.runder.length}
                  </th>
                  <th className="px-3 py-2 border-b border-neutral-200 text-neutral-700" rowSpan={2}>
                    Runder spilt
                  </th>
                </tr>
                <tr className="text-left">
                  <th className="px-3 py-2 bg-indigo-100 text-indigo-900 border-b border-indigo-200">
                    Snitt seire
                  </th>
                  <th className="px-3 py-2 bg-indigo-100 text-indigo-900 border-b border-indigo-200">
                    Poeng
                  </th>
                  <th className="px-3 py-2 bg-neutral-100 text-neutral-700 border-b border-neutral-300">
                    Snitt seire
                  </th>
                  <th className="px-3 py-2 bg-neutral-100 text-neutral-700 border-b border-neutral-300">
                    Poeng
                  </th>
                </tr>
              </thead>
              <tbody>
                {sesongtabell.map((s, i) => (
                  <tr key={s.spillerId} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-2 text-neutral-900">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold text-neutral-900">{s.spillerNavn}</td>
                    <td className="px-3 py-2 bg-indigo-50 font-medium text-neutral-900">
                      {s.blokkA.snittSeire.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 bg-indigo-50 font-medium text-neutral-900">
                      {s.blokkA.totaltPoeng}
                    </td>
                    <td className="px-3 py-2 bg-neutral-50 text-neutral-700">
                      {s.blokkB.snittSeire.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 bg-neutral-50 text-neutral-700">
                      {s.blokkB.totaltPoeng}
                    </td>
                    <td className="px-3 py-2 text-neutral-900">{s.antallSpilteRunder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-neutral-900 border-b-2 border-indigo-600 inline-block pb-1 mb-3">
          Rundehistorikk
        </h2>
        {serie.runder.length === 0 ? (
          <p className="text-sm text-neutral-700">Ingen runder registrert ennå.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white shadow-sm">
            {serie.runder.map((runde) => {
              const topp3 = rangerRunde(
                runde.deltakelser.map((d) => ({
                  spillerId: d.spillerId,
                  spillerNavn: d.spiller.navn,
                  kamp1: d.kamp1,
                  kamp2: d.kamp2,
                  kamp3: d.kamp3,
                }))
              ).slice(0, 3);
              return (
                <li key={runde.id}>
                  <Link
                    href={`/serie/${serie.id}/runde/${runde.id}`}
                    className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-neutral-50"
                  >
                    <span className="font-medium text-neutral-900">
                      Runde {runde.rundenummer} ·{" "}
                      {new Date(runde.dato).toLocaleDateString("no-NO")}
                    </span>
                    <div className="text-sm text-neutral-700 text-right space-y-0.5">
                      {topp3.map((r) => (
                        <div
                          key={r.spillerId}
                          className={r.plass === 1 ? "font-bold text-rose-700" : undefined}
                        >
                          {r.plass}. {r.spillerNavn} ({r.sumSeire},{" "}
                          {formatPoeng(r.sumPoengforskjell)})
                        </div>
                      ))}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
