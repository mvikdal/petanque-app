// Delt admin-autorisasjonslogikk. Brukes av proxy.ts (gatekeeper for siden)
// OG uavhengig inne i hver admin server action (lib/admin-auth.ts#assertAdmin) -
// ifølge Next.js' egen anbefaling skal man ikke stole utelukkende på proxy for
// å beskytte Server Functions, siden en fremtidig matcher-endring eller
// refaktorering stille kan fjerne dekningen. Se:
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
export function erGyldigAdminAuth(authorizationHeader: string | null): boolean {
  const passord = process.env.ADMIN_PASSWORD;
  if (!passord) {
    // Ingen passord satt (f.eks. lokal utvikling) - admin står åpent.
    return true;
  }

  if (!authorizationHeader?.startsWith("Basic ")) {
    return false;
  }

  const bruker = process.env.ADMIN_USER ?? "admin";
  const decoded = Buffer.from(authorizationHeader.slice(6), "base64").toString(
    "utf-8"
  );
  const skilleIndex = decoded.indexOf(":");
  const innsendtBruker = decoded.slice(0, skilleIndex);
  const innsendtPassord = decoded.slice(skilleIndex + 1);
  return innsendtBruker === bruker && innsendtPassord === passord;
}

// Kastes i hver admin server action som en siste, uavhengig sperre -
// selv om proxy.ts av en eller annen grunn ikke skulle kjøre for et gitt
// kall, kan ingen mutasjon (opprette serie/spiller/runde, rette en runde)
// noensinne lykkes uten gyldige admin-opplysninger i selve requesten.
export async function assertAdmin() {
  const { headers } = await import("next/headers");
  const authorizationHeader = (await headers()).get("authorization");
  if (!erGyldigAdminAuth(authorizationHeader)) {
    throw new Error("Ikke autorisert.");
  }
}
