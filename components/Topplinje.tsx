import Image from "next/image";
import Link from "next/link";

// Topplinjen med tittel til venstre og (for klubbsider) tannhjul til
// admin til høyre. Sinsen har egen logo; andre klubber vises uten.
export function Topplinje({
  tittel,
  hjemUrl,
  logo,
  adminUrl,
}: {
  tittel: string;
  hjemUrl: string;
  logo?: { src: string; alt: string };
  adminUrl?: string;
}) {
  return (
    <header className="bg-indigo-950">
      <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
        <Link href={hjemUrl} className="flex items-center gap-3 font-semibold text-white text-lg">
          {logo && <Image src={logo.src} alt={logo.alt} width={36} height={36} loading="eager" />}
          {tittel}
        </Link>
        {adminUrl && (
          <Link
            href={adminUrl}
            prefetch={false}
            aria-label="Admin"
            title="Admin"
            className="text-indigo-200 hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
              aria-hidden="true"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Link>
        )}
      </div>
    </header>
  );
}
