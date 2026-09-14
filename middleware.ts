import { NextRequest, NextResponse } from "next/server";

// Enkel HTTP Basic Auth for admin-området. Krever ADMIN_PASSWORD satt som
// miljøvariabel - er den ikke satt (f.eks. lokal utvikling), står /admin
// åpent som før. Sett ADMIN_PASSWORD (og evt. ADMIN_USER) i Vercel før
// dette publiseres på nett.
export function middleware(request: NextRequest) {
  const passord = process.env.ADMIN_PASSWORD;
  if (!passord) {
    return NextResponse.next();
  }

  const bruker = process.env.ADMIN_USER ?? "admin";
  const auth = request.headers.get("authorization");

  if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
    const skilleIndex = decoded.indexOf(":");
    const innsendtBruker = decoded.slice(0, skilleIndex);
    const innsendtPassord = decoded.slice(skilleIndex + 1);
    if (innsendtBruker === bruker && innsendtPassord === passord) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Autentisering nødvendig", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
  });
}

export const config = {
  matcher: ["/admin/:path*"],
};
