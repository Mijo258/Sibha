import type { Metadata } from "next";

import { PrayerTimes } from "@/components/prayer-times";

export const metadata: Metadata = {
  title: "مواقيت الصلاة | Maha",
  description:
    "مواقيت الصلاة حسب موقعك، مع اختيار التاريخ وصوت الأذان والتنبيهات.",
};

export default function PrayersPage() {
  return (
    <main
      dir="rtl"
      lang="ar"
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14"
    >
      <header className="mb-10 flex flex-col items-center gap-3 text-center">
        <p
          dir="ltr"
          lang="en"
          className="text-xs font-medium tracking-[0.25em] text-gold uppercase"
        >
          A moment for prayer
        </p>
        <h1 className="font-arabic text-gilded text-4xl leading-relaxed font-bold sm:text-5xl">
          مواقيت الصلاة
        </h1>
        <p className="font-arabic max-w-lg text-lg leading-loose text-muted-foreground">
          اعرف مواقيت الصلاة في موقعك، واختر صوت الأذان الذي تحب.
        </p>
      </header>
      <PrayerTimes />
    </main>
  );
}
