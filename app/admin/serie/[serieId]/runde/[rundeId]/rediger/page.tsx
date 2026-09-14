import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RundeForm } from "@/components/admin/RundeForm";

export default async function RedigerRundePage({
  params,
}: {
  params: Promise<{ serieId: string; rundeId: string }>;
}) {
  const { serieId, rundeId } = await params;
  const runde = await prisma.runde.findUnique({
    where: { id: rundeId },
    include: { serie: true, deltakelser: true },
  });
  if (!runde || runde.serieId !== serieId) notFound();

  const spillere = await prisma.spiller.findMany({
    where: { serieId },
    orderBy: { navn: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">
        Rediger runde {runde.rundenummer} – {runde.serie.navn}
      </h1>
      <p className="text-sm text-neutral-700 mb-6">
        Endringer her logges med tidspunkt og valgfri kommentar, og vises
        nederst på rundens offentlige side.
      </p>
      <RundeForm
        mode="rediger"
        serieId={serieId}
        rundeId={runde.id}
        poengGrense={runde.serie.poengGrense}
        spillere={spillere}
        initialDato={runde.dato.toISOString().slice(0, 10)}
        initialDeltakelser={runde.deltakelser.map((d) => ({
          spillerId: d.spillerId,
          kamp1: d.kamp1,
          kamp2: d.kamp2,
          kamp3: d.kamp3,
        }))}
      />
    </div>
  );
}
