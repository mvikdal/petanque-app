import { NextRequest, NextResponse } from "next/server";
import { erGyldigAdminAuth } from "@/lib/admin-auth";

// Enkel HTTP Basic Auth for admin-området. Krever ADMIN_PASSWORD satt som
// miljøvariabel - er den ikke satt (f.eks. lokal utvikling), står /admin
// åpent som før. Sett ADMIN_PASSWORD (og evt. ADMIN_USER) i Vercel før
// dette publiseres på nett.
//
// "middleware.ts" er deprecated fra Next.js v16 til fordel for "proxy.ts"
// (se node_modules/next/dist/docs/.../proxy.md) - dette er den gjeldende
// konvensjonen for denne versjonen. Selve autorisasjonssjekken er likevel
// IKKE den eneste sperren: hver admin server action verifiserer også
// uavhengig (lib/admin-auth.ts#assertAdmin), slik Next.js selv anbefaler.
export function proxy(request: NextRequest) {
  if (erGyldigAdminAuth(request.headers.get("authorization"))) {
    return NextResponse.next();
  }

  // Next.js prefetcher lenker (som "Admin"-lenken i header på alle
  // offentlige sider) i bakgrunnen. En 401 med WWW-Authenticate på en slik
  // bakgrunnsforespørsel får nettleseren til å vise innloggingsboksen oppå
  // SIDEN BRUKEREN FAKTISK ER PÅ, selv om de aldri navigerte til /admin.
  // Prefetch er nå skrudd av på selve lenken også (se app/layout.tsx), men
  // vi utelater uansett WWW-Authenticate-headeren for slike forespørsler
  // som et ekstra lag - innholdet blokkeres fortsatt (401), bare uten å
  // trigge nettleserens native dialog.
  const erPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch");

  return new NextResponse("Autentisering nødvendig", {
    status: 401,
    headers: erPrefetch
      ? {}
      : { "WWW-Authenticate": 'Basic realm="Admin"' },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
