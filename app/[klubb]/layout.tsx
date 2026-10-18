import type { Metadata } from "next";
import { Topplinje } from "@/components/Topplinje";
import { hentKlubb, hentKlubbEllers404 } from "@/lib/data/klubber";
import { adminUrl, klubbUrl } from "@/lib/lenker";

// Logo per klubb. Klubber uten egen logo vises bare med navn.
const LOGOER: Record<string, { src: string; alt: string }> = {
  sinsen: { src: "/sinsen-logo.png", alt: "Sinsen Petanque" },
};

export async function generateMetadata({
  params,
}: LayoutProps<"/[klubb]">): Promise<Metadata> {
  const klubb = await hentKlubb((await params).klubb);
  return klubb ? { title: `${klubb.navn} – Petanque Seriespill` } : {};
}

// Ukjent slug gir 404 for hele klubbens del av nettstedet.
export default async function KlubbLayout({ children, params }: LayoutProps<"/[klubb]">) {
  const klubb = await hentKlubbEllers404((await params).klubb);

  return (
    <>
      <Topplinje
        tittel={klubb.navn}
        hjemUrl={klubbUrl(klubb.slug)}
        logo={LOGOER[klubb.slug]}
        adminUrl={adminUrl(klubb.slug)}
      />
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">{children}</main>
    </>
  );
}
