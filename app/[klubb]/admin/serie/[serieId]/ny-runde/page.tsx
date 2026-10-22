import { harBildetolkning, krevKlubbAdminSide } from "@/lib/klubb-admin";
import { hentSerie, listSpillere } from "@/lib/data/serier";
import { notFound } from "next/navigation";
import { RundeForm } from "@/components/admin/RundeForm";

export default async function NyRundePage({
  params,
}: {
  params: Promise<{ klubb: string; serieId: string }>;
}) {
  const { klubb: klubbSlug, serieId } = await params;
  const klubb = await krevKlubbAdminSide(klubbSlug);
  const serie = await hentSerie(klubb.id, serieId);
  if (!serie) notFound();

  const spillere = await listSpillere(klubb.id, serieId);
  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Ny runde – {serie.navn}</h1>
      <p className="text-sm text-neutral-700 mb-6">
        Rundenummer settes etter datoen · poeng registreres fra -{serie.poengGrense} til{" "}
        {serie.poengGrense} (0 er ikke gyldig)
      </p>
      <RundeForm
        mode="ny"
        klubbSlug={klubb.slug}
        serieId={serie.id}
        poengGrense={serie.poengGrense}
        bildetolkning={harBildetolkning(klubb)}
        spillere={spillere}
      />
    </div>
  );
}
