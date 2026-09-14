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
        <h1 className="text-xl font-semibold">{serie.navn}</h1>
        <p className="text-sm text-neutral-500">
          Poeng til {serie.poengGrense} · beste {serie.antallTellendeRunder} runder
          teller · {serie.status}
        </p>
      </div>

      {serierekord.length > 0 && (
        <section className="bg-white border border-neutral-200 rounded-md px-4 py-3">
          <h2 className="text-xs font-medium text-neutral-500 uppercase mb-1">
            Serierekord
          </h2>
          {serierekord.map((r) => (
            <div key={`${r.spillerNavn}-${r.rundeId}`} className="text-sm">
              <span className="font-medium">{r.spillerNavn}</span> – {r.sumSeire} seire,{" "}
              {formatPoeng(r.sumPoengforskjell)} poeng{" "}
              <Link
                href={`/serie/${serie.id}/runde/${r.rundeId}`}
                className="text-neutral-500 hover:underline"
              >
                (runde {r.rundenummer} · {new Date(r.dato).toLocaleDateString("no-NO")})
              </Link>
            </div>
          ))}
        </section>
      )}

      <section>
        <h2 className="font-medium mb-3">Sesongtabell</h2>
        {sesongtabell.length === 0 ? (
          <p className="text-sm text-neutral-500">Ingen fullførte runder ennå.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm bg-white border border-neutral-200 rounded-md">
              <thead>
                <tr className="border-b border-neutral-200 text-left">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Spiller</th>
                  <th className="px-3 py-2" title={`Beste ${serie.antallTellendeRunder} runder`}>
                    Snitt seire (N)
                  </th>
                  <th className="px-3 py-2">Poeng (N)</th>
                  <th className="px-3 py-2 text-neutral-400">Snitt seire (alle)</th>
                  <th className="px-3 py-2 text-neutral-400">Poeng (alle)</th>
                  <th className="px-3 py-2">Runder spilt</th>
                </tr>
              </thead>
              <tbody>
                {sesongtabell.map((s, i) => (
                  <tr key={s.spillerId} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{s.spillerNavn}</td>
                    <td className="px-3 py-2">{s.blokkA.snittSeire.toFixed(2)}</td>
                    <td className="px-3 py-2">{s.blokkA.totaltPoeng}</td>
                    <td className="px-3 py-2 text-neutral-400">
                      {s.blokkB.snittSeire.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-neutral-400">{s.blokkB.totaltPoeng}</td>
                    <td className="px-3 py-2">{s.antallSpilteRunder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-3">Rundehistorikk</h2>
        {serie.runder.length === 0 ? (
          <p className="text-sm text-neutral-500">Ingen runder registrert ennå.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-md bg-white">
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
                    <span>
                      Runde {runde.rundenummer} ·{" "}
                      {new Date(runde.dato).toLocaleDateString("no-NO")}
                    </span>
                    <div className="text-xs text-neutral-500 text-right space-y-0.5">
                      {topp3.map((r) => (
                        <div key={r.spillerId}>
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
