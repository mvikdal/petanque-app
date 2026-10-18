import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { hashPassord, sjekkPassord } from "@/lib/auth/passord";
import { lagSesjonstoken, lesSesjonstoken } from "@/lib/auth/sesjon";
import { proxy } from "@/proxy";

// Rene enhetstester uten database: proxy.ts, sesjonstoken og passord.

const sinsen = { id: "klubb-sinsen", slug: "sinsen" };

function forespørsel(sti: string, sesjon?: Parameters<typeof lagSesjonstoken>[0]) {
  const req = new NextRequest(new URL(sti, "http://localhost"));
  if (sesjon) req.cookies.set("sesjon", lagSesjonstoken(sesjon));
  return req;
}

// NextResponse.next() har headeren x-middleware-next, en omdirigering har Location.
function utfall(res: Response) {
  return res.headers.get("location") ?? (res.headers.get("x-middleware-next") ? "slipper gjennom" : "?");
}

describe("proxy.ts", () => {
  it("sender uinnlogget admin til klubbens innlogging, med neste-adressen", () => {
    expect(utfall(proxy(forespørsel("/sinsen/admin/serie/x/runder")))).toBe(
      "http://localhost/sinsen/admin/login?neste=%2Fsinsen%2Fadmin%2Fserie%2Fx%2Frunder"
    );
  });

  it("slipper gjennom innloggingssiden", () => {
    expect(utfall(proxy(forespørsel("/sinsen/admin/login")))).toBe("slipper gjennom");
  });

  it("slipper gjennom med sesjon for riktig klubb", () => {
    expect(utfall(proxy(forespørsel("/sinsen/admin", { brukerId: "b", klubb: sinsen })))).toBe(
      "slipper gjennom"
    );
  });

  it("sender sesjon for en annen klubb til riktig innlogging", () => {
    expect(utfall(proxy(forespørsel("/demo/admin", { brukerId: "b", klubb: sinsen })))).toMatch(
      /^http:\/\/localhost\/demo\/admin\/login/
    );
  });

  it("superadmin-sesjon uten klubb gir ikke klubbadmin", () => {
    expect(utfall(proxy(forespørsel("/sinsen/admin", { brukerId: "b", klubb: null })))).toMatch(
      /\/sinsen\/admin\/login/
    );
  });

  it("/superadmin krever sesjon, innloggingssiden er åpen", () => {
    expect(utfall(proxy(forespørsel("/superadmin")))).toBe("http://localhost/superadmin/login");
    expect(utfall(proxy(forespørsel("/superadmin/login")))).toBe("slipper gjennom");
  });

  it("forfalsket cookie avvises", () => {
    const req = new NextRequest(new URL("/sinsen/admin", "http://localhost"));
    const innhold = Buffer.from(
      JSON.stringify({ brukerId: "b", klubb: sinsen, utløper: Date.now() + 1e9 })
    ).toString("base64url");
    req.cookies.set("sesjon", `${innhold}.falsk-signatur`);
    expect(utfall(proxy(req))).toMatch(/\/sinsen\/admin\/login/);
  });
});

describe("sesjonstoken", () => {
  it("leses tilbake uendret", () => {
    const s = lesSesjonstoken(lagSesjonstoken({ brukerId: "b", klubb: sinsen }));
    expect(s?.brukerId).toBe("b");
    expect(s?.klubb).toEqual(sinsen);
  });

  it("endret innhold med gammel signatur avvises", () => {
    const [, signatur] = lagSesjonstoken({ brukerId: "b", klubb: sinsen }).split(".");
    const endret = Buffer.from(
      JSON.stringify({ brukerId: "b", klubb: { id: "x", slug: "demo" }, utløper: Date.now() + 1e9 })
    ).toString("base64url");
    expect(lesSesjonstoken(`${endret}.${signatur}`)).toBeNull();
  });

  it("utløpt sesjon avvises", () => {
    const hemmelig = process.env.SESSION_SECRET;
    expect(hemmelig).toBeTruthy();
    const nå = Date.now;
    try {
      const token = lagSesjonstoken({ brukerId: "b", klubb: sinsen });
      Date.now = () => nå() + 31 * 24 * 60 * 60 * 1000;
      expect(lesSesjonstoken(token)).toBeNull();
    } finally {
      Date.now = nå;
    }
  });

  it("tull og tom verdi avvises", () => {
    expect(lesSesjonstoken(undefined)).toBeNull();
    expect(lesSesjonstoken("tull")).toBeNull();
    expect(lesSesjonstoken("a.b.c")).toBeNull();
  });
});

describe("passord", () => {
  it("riktig passord godtas, feil avvises, og hashen er saltet", async () => {
    const h1 = await hashPassord("et-passord-123");
    const h2 = await hashPassord("et-passord-123");
    expect(h1).not.toBe(h2);
    expect(await sjekkPassord("et-passord-123", h1)).toBe(true);
    expect(await sjekkPassord("feil-passord", h1)).toBe(false);
    expect(await sjekkPassord("et-passord-123", "ugyldig-format")).toBe(false);
  });
});
