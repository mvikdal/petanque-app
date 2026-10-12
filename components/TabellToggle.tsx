"use client";

import { useState, type ReactNode } from "react";

export function TabellToggle({
  sesongtabell,
  totaltabell,
}: {
  sesongtabell: ReactNode;
  totaltabell: ReactNode;
}) {
  const [visning, setVisning] = useState<"sesong" | "total">("sesong");

  return (
    <section>
      <div className="flex gap-4 mb-3">
        <button
          type="button"
          onClick={() => setVisning("sesong")}
          className={
            visning === "sesong"
              ? "font-semibold text-neutral-900 border-b-2 border-indigo-600 pb-1"
              : "font-semibold text-neutral-500 border-b-2 border-transparent pb-1 hover:text-neutral-700"
          }
        >
          Sesongtabell
        </button>
        <button
          type="button"
          onClick={() => setVisning("total")}
          className={
            visning === "total"
              ? "font-semibold text-neutral-900 border-b-2 border-indigo-600 pb-1"
              : "font-semibold text-neutral-500 border-b-2 border-transparent pb-1 hover:text-neutral-700"
          }
        >
          Totaltabell
        </button>
      </div>
      {visning === "sesong" ? sesongtabell : totaltabell}
    </section>
  );
}
