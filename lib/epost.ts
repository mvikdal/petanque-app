import nodemailer, { type Transporter } from "nodemailer";
import { KODE_LEVETID_MINUTTER } from "@/lib/auth/engangskode";

// Utsending av e-post via en Gmail-konto over SMTP (2026-10-24). Kontoen
// må ha totrinnsbekreftelse og et app-passord. EPOST_BRUKER er
// Gmail-adressen og EPOST_APP_PASSORD er app-passordet. sendEpost() er
// generell og tar vedlegg, så den kan også brukes til sikkerhetskopier.
//
// Uten EPOST_BRUKER utenfor produksjon skrives e-posten til konsollen i
// stedet, så innlogging virker ved lokal utvikling.

export type Epost = {
  til: string;
  emne: string;
  tekst: string;
  vedlegg?: { filnavn: string; innhold: string | Buffer; type?: string }[];
};

let transport: Transporter | undefined;

function hentTransport() {
  const bruker = process.env.EPOST_BRUKER;
  const passord = process.env.EPOST_APP_PASSORD;
  if (!bruker || !passord) return null;
  transport ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: bruker, pass: passord },
  });
  return transport;
}

export async function sendEpost(epost: Epost) {
  const t = hentTransport();
  if (!t) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EPOST_BRUKER og EPOST_APP_PASSORD må være satt for å sende e-post.");
    }
    console.log(`[e-post til ${epost.til}] ${epost.emne}\n${epost.tekst}`);
    return;
  }
  await t.sendMail({
    from: { name: "Petanque-serien", address: process.env.EPOST_BRUKER! },
    to: epost.til,
    subject: epost.emne,
    text: epost.tekst,
    attachments: epost.vedlegg?.map((v) => ({
      filename: v.filnavn,
      content: v.innhold,
      contentType: v.type,
    })),
  });
}

export async function sendInnloggingskode(til: string, kode: string, gjelder: string) {
  await sendEpost({
    til,
    emne: `Innloggingskode: ${kode}`,
    tekst:
      `Koden din for innlogging som admin i ${gjelder} er:\n\n` +
      `    ${kode}\n\n` +
      `Koden gjelder i ${KODE_LEVETID_MINUTTER} minutter og kan bare brukes én gang.\n` +
      `Har du ikke bedt om denne koden, kan du se bort fra e-posten.`,
  });
}
