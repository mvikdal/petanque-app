import { redirect } from "next/navigation";
import { erSuperadmin } from "@/lib/data/superadmin";
import { hentSesjon } from "@/lib/klubb-admin";

// Server-side sjekk for /superadmin. Superadmin-statusen slås opp i
// databasen hver gang, ikke bare fra cookien. proxy.ts krever i tillegg en
// gyldig sesjon før sidene i det hele tatt nås.

export async function krevSuperadmin(): Promise<{ brukerId: string }> {
  const sesjon = await hentSesjon();
  if (!sesjon || !(await erSuperadmin(sesjon.brukerId))) {
    throw new Error("Krever superadmin.");
  }
  return { brukerId: sesjon.brukerId };
}

export async function krevSuperadminSide(): Promise<{ brukerId: string }> {
  const sesjon = await hentSesjon();
  if (!sesjon || !(await erSuperadmin(sesjon.brukerId))) redirect("/superadmin/login");
  return { brukerId: sesjon.brukerId };
}
