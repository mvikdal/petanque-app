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

  return new NextResponse("Autentisering nødvendig", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
