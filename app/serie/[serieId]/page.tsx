import { notFound, permanentRedirect } from "next/navigation";
import { finnKlubbSlugForSerie } from "@/lib/data/klubber";
import { serieUrl } from "@/lib/lenker";

// Gamle lenker fra før klubbskillet (/serie/...) sendes videre til
// seriens klubb, slik at lenker som allerede er delt fortsatt virker.
export default async function GammelSerieLenke({ params }: PageProps<"/serie/[serieId]">) {
  const { serieId } = await params;
  const slug = await finnKlubbSlugForSerie(serieId);
  if (!slug) notFound();
  permanentRedirect(serieUrl(slug, serieId));
}
