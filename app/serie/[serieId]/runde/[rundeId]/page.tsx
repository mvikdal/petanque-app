import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { rangerRunde } from "@/lib/ranking";

function ScoreCell({ verdi }: { verdi: number }) {
  const farge = verdi > 0 ? "text-emerald-700" : "text-rose-700";
  return (
    <span className={`font-semibold ${farge}`}>
      {verdi > 0 ? `+${verdi}` : verdi}
    </span>
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
      serie: true,
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
              <th className="px-3 py-2 text-neutral-700">Poengforskjell</th>
            </tr>
          </thead>
          <tbody>
            {rangert.map((r) => (
              <tr
                key={r.spillerId}
                className={`border-b border-neutral-100 last:border-0 ${
                  r.plass === 1 ? "bg-rose-50" : ""
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
                <td className="px-3 py-2 font-medium text-neutral-900">{r.sumSeire}</td>
                <td className="px-3 py-2">
                  <ScoreCell verdi={r.sumPoengforskjell} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
