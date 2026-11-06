// Engangskoder for innlogging. Bare den nyeste koden til en bruker kan
// brukes - en ny kode gjør de tidligere ugyldige. Eldre rader blir
// liggende en time, fordi de teller med i grensen for antall koder.
import { prisma } from "@/lib/prisma";
import {
  hashKode,
  kodeStemmer,
  KODE_LEVETID_MINUTTER,
  lagKode,
  MAKS_FEIL_PER_KODE,
  MAKS_KODER_PER_TIME,
} from "@/lib/auth/engangskode";

const EN_TIME = 60 * 60 * 1000;

export class ForMangeKoder extends Error {
  constructor() {
    super("For mange koder er sendt. Vent en time og prøv igjen.");
  }
}

// Lager og lagrer en ny kode, og returnerer den i klartekst så den kan
// sendes på e-post. Kaster ForMangeKoder hvis grensen er nådd.
export async function opprettKode(brukerId: string): Promise<string> {
  const timeSiden = new Date(Date.now() - EN_TIME);
  await prisma.innloggingskode.deleteMany({ where: { brukerId, opprettet: { lt: timeSiden } } });
  const sisteTime = await prisma.innloggingskode.count({ where: { brukerId } });
  if (sisteTime >= MAKS_KODER_PER_TIME) throw new ForMangeKoder();

  const kode = lagKode();
  await prisma.innloggingskode.create({
    data: {
      brukerId,
      kodeHash: hashKode(kode),
      gyldigTil: new Date(Date.now() + KODE_LEVETID_MINUTTER * 60 * 1000),
    },
  });
  return kode;
}

// Sjekker koden mot brukerens nyeste kode. Riktig kode gjør koden brukt
// (den kan ikke brukes igjen), feil kode teller som et feilforsøk.
export async function brukKode(brukerId: string, kode: string): Promise<boolean> {
  const nyeste = await prisma.innloggingskode.findFirst({
    where: { brukerId },
    orderBy: { opprettet: "desc" },
  });
  if (
    !nyeste ||
    nyeste.gyldigTil.getTime() <= Date.now() ||
    nyeste.antallFeil >= MAKS_FEIL_PER_KODE
  ) {
    return false;
  }

  if (!kodeStemmer(kode, nyeste.kodeHash)) {
    await prisma.innloggingskode.update({
      where: { id: nyeste.id },
      data: { antallFeil: { increment: 1 } },
    });
    return false;
  }

  // Betinget oppdatering, så to samtidige forsøk med samme kode ikke
  // begge kan lykkes.
  const { count } = await prisma.innloggingskode.updateMany({
    where: { id: nyeste.id, gyldigTil: { gt: new Date() } },
    data: { gyldigTil: new Date(0) },
  });
  return count === 1;
}
