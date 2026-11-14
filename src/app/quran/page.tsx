import type { Metadata } from "next";

import { getSurahList, type SurahMeta } from "@/lib/quran";
import { QuranReader } from "@/components/quran-reader";

export const metadata: Metadata = {
  title: "Qur'an — Read & Listen | Maha",
  description:
    "Browse all 114 surahs, read the Uthmani text, and listen with your choice of reciter.",
};

export default async function QuranPage() {
  let surahs: SurahMeta[] = [];
  let listError: string | undefined;

  try {
    surahs = await getSurahList();
  } catch {
    listError = "The surah list is unavailable right now. Please refresh.";
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-10 flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-medium tracking-[0.25em] text-[color:var(--gold)] uppercase">
          Read &amp; Listen
        </p>
        <h1 className="font-display text-4xl font-medium sm:text-5xl">
          The Noble Qur&apos;an
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          114 surahs in Uthmani script. Choose your reciter below.
        </p>
      </div>

      <QuranReader surahs={surahs} listError={listError} />
    </main>
  );
}
