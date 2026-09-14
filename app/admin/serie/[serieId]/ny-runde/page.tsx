import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { NyRundeForm } from "./NyRundeForm";

export default async function NyRundePage({
  params,
}: {
  params: Promise<{ serieId: string }>;
}) {
  const { serieId } = await params;
  const serie = await prisma.serie.findUnique({ where: { id: serieId } });
  if (!serie) notFound();

  const spillere = await prisma.spiller.findMany({
    where: { serieId },
    orderBy: { navn: "asc" },
  });
  const sisteRunde = await prisma.runde.findFirst({
    where: { serieId },
    orderBy: { rundenummer: "desc" },
  });

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Ny runde – {serie.navn}</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Runde {(sisteRunde?.rundenummer ?? 0) + 1} · poeng registreres fra -
        {serie.poengGrense} til {serie.poengGrense} (0 er ikke gyldig)
      </p>
      <NyRundeForm
        serieId={serie.id}
        poengGrense={serie.poengGrense}
        spillere={spillere}
      />
    </div>
  );
}
