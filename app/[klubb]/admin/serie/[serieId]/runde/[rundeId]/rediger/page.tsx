import { krevKlubbAdminSide } from "@/lib/klubb-admin";
import { hentRundeForRedigering, listSpillere } from "@/lib/data/serier";
import { notFound } from "next/navigation";
import { RundeForm } from "@/components/admin/RundeForm";

export default async function RedigerRundePage({
  params,
}: {
  params: Promise<{ klubb: string; serieId: string; rundeId: string }>;
}) {
  const { klubb: klubbSlug, serieId, rundeId } = await params;
  const klubb = await krevKlubbAdminSide(klubbSlug);
  const runde = await hentRundeForRedigering(klubb.id, serieId, rundeId);
  if (!runde) notFound();

  const spillere = await listSpillere(klubb.id, serieId);

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
        klubbSlug={klubb.slug}
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
