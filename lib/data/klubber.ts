import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export type Klubb = { id: string; slug: string; navn: string };

// cache(): layout og side på samme request slår opp klubben bare én gang.
export const hentKlubb = cache(async (slug: string): Promise<Klubb | null> => {
  return prisma.klubb.findUnique({
    where: { slug },
    select: { id: true, slug: true, navn: true },
  });
});

export async function hentKlubbEllers404(slug: string): Promise<Klubb> {
  const klubb = await hentKlubb(slug);
  if (!klubb) notFound();
  return klubb;
}

export async function listKlubber() {
  return prisma.klubb.findMany({
    orderBy: { navn: "asc" },
    select: { id: true, slug: true, navn: true, _count: { select: { serier: true } } },
  });
}

// Kun til videresending av gamle lenker (/serie/...) uten klubb i URL-en.
export async function finnKlubbSlugForSerie(serieId: string): Promise<string | null> {
  const serie = await prisma.serie.findUnique({
    where: { id: serieId },
    select: { klubb: { select: { slug: true } } },
  });
  return serie?.klubb.slug ?? null;
}
