import { loggInnSuperadmin } from "./actions";

export default async function SuperadminLoginPage({
  searchParams,
}: PageProps<"/superadmin/login">) {
  const { feil } = await searchParams;

  return (
    <div className="max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Logg inn</h1>
      <p className="text-sm text-neutral-700 mb-6">Superadmin – klubber og brukere</p>
      <form
        action={loggInnSuperadmin}
        className="bg-white border border-neutral-200 rounded-lg p-4 space-y-4 shadow-sm"
      >
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="epost">
            E-post
          </label>
          <input
            id="epost"
            name="epost"
            type="email"
            autoComplete="username"
            required
            className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="passord">
            Passord
          </label>
          <input
            id="passord"
            name="passord"
            type="password"
            autoComplete="current-password"
            required
            className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
          />
        </div>
        {feil && (
          <p className="text-sm font-medium text-red-800 bg-red-50 border border-red-300 rounded px-3 py-2">
            Feil e-post eller passord, eller brukeren er ikke superadmin.
          </p>
        )}
        <button
          type="submit"
          className="w-full bg-indigo-700 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-indigo-800"
        >
          Logg inn
        </button>
      </form>
    </div>
  );
}
