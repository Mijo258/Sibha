import Link from "next/link";
import { BookOpen, Headphones, Infinity as InfinityIcon } from "lucide-react";

import { getSurahList, type SurahMeta } from "@/lib/quran";
import { GeometricBackground } from "@/components/geometric-background";
import { QuranReader } from "@/components/quran-reader";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Tasbeeh } from "@/components/tasbeeh";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function Home() {
  // Rendered on the server so the surah index is in the first paint. A failure
  // here must not take the tasbeeh down with it.
  let surahs: SurahMeta[] = [];
  let listError: string | undefined;

  try {
    surahs = await getSurahList();
  } catch {
    listError = "The surah list is unavailable right now. Please refresh.";
  }

  return (
    <>
      <GeometricBackground />
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        {/* ── Hero ── */}
        <section className="flex flex-col items-center gap-6 py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-gilded bg-[color:var(--gold)]/[0.07] px-3 py-1 text-xs text-[color:var(--gold)]">
            <InfinityIcon className="size-3" />
            Count, read, and listen — all in one place
          </span>

          <h1
            dir="rtl"
            lang="ar"
            className="font-arabic text-gilded text-5xl leading-[1.6] font-bold sm:text-7xl"
          >
            بِسْمِ اللّٰهِ
          </h1>

          <div className="flex flex-col items-center gap-3">
            <h2 className="font-display max-w-2xl text-3xl leading-tight font-medium sm:text-5xl">
              A quiet place for <em className="text-gilded not-italic">dhikr</em>{" "}
              and recitation
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
              A digital tasbeeh that keeps your count, and the full Qur&apos;an
              to read in Uthmani script or hear recited verse by verse.
            </p>
          </div>

          {/* nativeButton={false}: these render as anchors, so Base UI must not
              assume the native <button> semantics it defaults to. */}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <Button size="lg" nativeButton={false} render={<Link href="#tasbeeh" />}>
              Begin tasbeeh
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-gilded"
              nativeButton={false}
              render={<Link href="#quran" />}
            >
              <BookOpen />
              Open the Qur&apos;an
            </Button>
          </div>
        </section>

        {/* ── Tasbeeh ── */}
        <section id="tasbeeh" className="scroll-mt-20 pb-20 sm:pb-28">
          <div className="mb-8 flex flex-col items-center gap-2 text-center">
            <p className="text-xs font-medium tracking-[0.25em] text-[color:var(--gold)] uppercase">
              Digital Tasbeeh
            </p>
            <h2 className="font-display text-3xl font-medium sm:text-4xl">
              Keep your count
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Tap the orb — or focus it and press{" "}
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">
                Space
              </kbd>
              . Counts and any dhikr you add are saved on this device.
            </p>
          </div>

          <Card className="mx-auto max-w-3xl border-gilded/60 bg-card/70 backdrop-blur-sm [--card-spacing:--spacing(6)]">
            <CardContent>
              <Tasbeeh />
            </CardContent>
          </Card>
        </section>

        {/* ── Qur'an ── */}
        <section id="quran" className="scroll-mt-20 pb-20 sm:pb-28">
          <div className="mb-8 flex flex-col items-center gap-2 text-center">
            <p className="flex items-center gap-1.5 text-xs font-medium tracking-[0.25em] text-[color:var(--gold)] uppercase">
              <Headphones className="size-3" />
              Read &amp; Listen
            </p>
            <h2 className="font-display text-3xl font-medium sm:text-4xl">
              The Noble Qur&apos;an
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              All 114 surahs. Tap any verse to begin the recitation from there —
              the reader follows along as it plays.
            </p>
          </div>

          <QuranReader surahs={surahs} listError={listError} />
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
