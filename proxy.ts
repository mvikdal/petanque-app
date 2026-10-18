import { NextRequest, NextResponse } from "next/server";
import { lesSesjonstoken, SESJONSCOOKIE } from "@/lib/auth/sesjon";

// Port foran admin-områdene (klubbskillet, 2026-10-18). Kun admin krever
// innlogging - klubbenes offentlige sider er åpne.
//
// /[klubb]/admin krever en sesjon for akkurat den klubben. Er man ikke
// innlogget, eller innlogget i en annen klubb, sendes man til klubbens
// innloggingsside. Dette er bare første sperre: admin-sidene og hver
// server action sjekker også selv på serveren (lib/klubb-admin.ts), slik
// Next.js anbefaler.
//
// "middleware.ts" heter "proxy.ts" fra Next.js v16, se
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sesjon = lesSesjonstoken(request.cookies.get(SESJONSCOOKIE)?.value);

  // /superadmin krever en gyldig sesjon. Om brukeren faktisk er superadmin,
  // sjekkes mot databasen på serveren (lib/superadmin.ts).
  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) {
    if (pathname === "/superadmin/login" || sesjon) return NextResponse.next();
    return NextResponse.redirect(new URL("/superadmin/login", request.url));
  }

  const [, klubbSlug, admin, underside] = pathname.split("/");
  if (admin !== "admin" || underside === "login") return NextResponse.next();

  if (sesjon?.klubb?.slug === klubbSlug) return NextResponse.next();

  const login = new URL(`/${klubbSlug}/admin/login`, request.url);
  login.searchParams.set("neste", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/:klubb/admin/:path*", "/superadmin/:path*"],
};
