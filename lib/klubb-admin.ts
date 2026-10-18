import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lesSesjonstoken, SESJONSCOOKIE, type Sesjon } from "@/lib/auth/sesjon";
import { hentKlubbtilgang, type Rolle } from "@/lib/data/brukere";
import { hentKlubb, type Klubb } from "@/lib/data/klubber";

// Server-side tilgangssjekk for klubbadmin. proxy.ts stopper uinnloggede
// forespørsler til /[klubb]/admin, men hver admin-side og hver server
// action sjekker likevel selv, slik Next.js anbefaler - en action kan
// kalles direkte uten å gå via en side.

export type KlubbKontekst = Klubb & { brukerId: string; rolle: Rolle };

export async function hentSesjon(): Promise<Sesjon | null> {
  return lesSesjonstoken((await cookies()).get(SESJONSCOOKIE)?.value);
}

async function sjekkTilgang(slug: string): Promise<KlubbKontekst | null> {
  const klubb = await hentKlubb(slug);
  const sesjon = await hentSesjon();
  if (!klubb || !sesjon || sesjon.klubb?.id !== klubb.id) return null;
  const tilgang = await hentKlubbtilgang(sesjon.brukerId, klubb.id);
  return tilgang ? { ...klubb, brukerId: sesjon.brukerId, rolle: tilgang.rolle } : null;
}

// For server actions: kaster hvis man ikke er innlogget i akkurat denne klubben.
export async function krevKlubbAdmin(slug: string): Promise<KlubbKontekst> {
  const kontekst = await sjekkTilgang(slug);
  if (!kontekst) throw new Error("Ikke innlogget som admin i denne klubben.");
  return kontekst;
}

// For admin-sider: sender til klubbens innloggingsside.
export async function krevKlubbAdminSide(slug: string): Promise<KlubbKontekst> {
  const kontekst = await sjekkTilgang(slug);
  if (!kontekst) redirect(`/${slug}/admin/login`);
  return kontekst;
}
