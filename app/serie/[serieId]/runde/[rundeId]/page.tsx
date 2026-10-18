import { notFound, permanentRedirect } from "next/navigation";
import { finnKlubbSlugForSerie } from "@/lib/data/klubber";
import { rundeUrl } from "@/lib/lenker";

// Gammel rundelenke fra før klubbskillet, se ../../page.tsx.
export default async function GammelRundeLenke({
  params,
}: PageProps<"/serie/[serieId]/runde/[rundeId]">) {
  const { serieId, rundeId } = await params;
  const slug = await finnKlubbSlugForSerie(serieId);
  if (!slug) notFound();
  permanentRedirect(rundeUrl(slug, serieId, rundeId));
}
