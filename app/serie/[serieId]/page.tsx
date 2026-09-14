import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import {
  beregnSesongtabell,
  rangerRunde,
  type SpillerMedRunder,
} from "@/lib/ranking";

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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold">{serie.navn}</h1>
        <p className="text-sm text-neutral-500">
          Poeng til {serie.poengGrense} · beste {serie.antallTellendeRunder} runder
          teller · {serie.status}
        </p>
      </div>

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
              const rangert = rangerRunde(
                runde.deltakelser.map((d) => ({
                  spillerId: d.spillerId,
                  spillerNavn: d.spiller.navn,
                  kamp1: d.kamp1,
                  kamp2: d.kamp2,
                  kamp3: d.kamp3,
                }))
              );
              const vinner = rangert[0];
              return (
                <li key={runde.id}>
                  <Link
                    href={`/serie/${serie.id}/runde/${runde.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50"
                  >
                    <span>
                      Runde {runde.rundenummer} ·{" "}
                      {new Date(runde.dato).toLocaleDateString("no-NO")}
                    </span>
                    {vinner && (
                      <span className="text-xs text-neutral-500">
                        Vinner: {vinner.spillerNavn} ({vinner.sumSeire}-
                        {3 - vinner.sumSeire})
                      </span>
                    )}
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
