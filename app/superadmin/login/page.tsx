import { KodeInnlogging } from "@/components/admin/KodeInnlogging";
import { bekreftKodeSuperadmin, sendKodeSuperadmin } from "./actions";

export default async function SuperadminLoginPage({
  searchParams,
}: PageProps<"/superadmin/login">) {
  const { feil, steg, epost } = await searchParams;

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Logg inn</h1>
      <p className="text-sm text-neutral-700 mb-6">Superadmin – klubber og brukere</p>
      <KodeInnlogging
        sendKode={sendKodeSuperadmin}
        bekreftKode={bekreftKodeSuperadmin}
        steg={steg === "kode" ? "kode" : "epost"}
        epost={typeof epost === "string" ? epost : ""}
        feil={typeof feil === "string" ? feil : undefined}
        hvem="er superadmin"
      />
    </div>
  );
}
