"use server";

import { redirect } from "next/navigation";
import { settSesjonscookie, slettSesjonscookie } from "@/lib/auth/cookie";
import { sjekkPassord, UBRUKELIG_HASH } from "@/lib/auth/passord";
import { finnBrukerForInnlogging } from "@/lib/data/brukere";

// Superadmin-sesjonen gjelder ingen klubb (klubb = null), så den gir ikke
// tilgang til noen klubbs data - bare til oppsett og brukere på /superadmin.
export async function loggInnSuperadmin(formData: FormData) {
  const bruker = await finnBrukerForInnlogging(String(formData.get("epost") ?? ""));
  const passordOk = await sjekkPassord(
    String(formData.get("passord") ?? ""),
    bruker?.passordHash ?? UBRUKELIG_HASH
  );
  if (!bruker || !passordOk || !bruker.erSuperadmin) redirect("/superadmin/login?feil=1");

  await settSesjonscookie({ brukerId: bruker.id, klubb: null });
  redirect("/superadmin");
}

export async function loggUtSuperadmin() {
  await slettSesjonscookie();
  redirect("/");
}
