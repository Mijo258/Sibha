import { BookOpen, Infinity as InfinityIcon } from "lucide-react";

import { TransitionLink } from "@/components/page-transitions";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
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

        {/* These render as anchors, so Base UI must use non-button semantics. */}
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <Button
            size="lg"
            nativeButton={false}
            render={<TransitionLink href="/tasbeeh" />}
          >
            Begin tasbeeh
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-gilded"
            nativeButton={false}
            render={<TransitionLink href="/quran" />}
          >
            <BookOpen />
            Open the Qur&apos;an
          </Button>
        </div>
      </section>
    </main>
  );
}
