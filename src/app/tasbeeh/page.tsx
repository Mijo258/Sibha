import type { Metadata } from "next";

import { Tasbeeh } from "@/components/tasbeeh";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Tasbeeh — Keep your count | Maha",
  description:
    "A digital tasbeeh counter that saves your counts and custom dhikr on this device.",
};

export default function TasbeehPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-medium tracking-[0.25em] text-[color:var(--gold)] uppercase">
          Digital Tasbeeh
        </p>
        <h1 className="font-display text-3xl font-medium sm:text-4xl">
          Keep your count
        </h1>
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
    </main>
  );
}
