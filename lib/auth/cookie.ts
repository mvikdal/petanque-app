import { cookies } from "next/headers";
import {
  lagSesjonstoken,
  SESJONSCOOKIE,
  SESJONSLEVETID_SEKUNDER,
  type Sesjon,
} from "@/lib/auth/sesjon";

// Setter sesjonscookien etter innlogging. Én sesjon om gangen: en ny
// innlogging (i en annen klubb eller på /superadmin) erstatter den forrige.
export async function settSesjonscookie(sesjon: Omit<Sesjon, "utløper">) {
  (await cookies()).set(SESJONSCOOKIE, lagSesjonstoken(sesjon), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESJONSLEVETID_SEKUNDER,
  });
}

export async function slettSesjonscookie() {
  (await cookies()).delete(SESJONSCOOKIE);
}
