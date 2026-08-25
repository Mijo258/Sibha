export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-gilded/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center sm:px-6">
        <p
          dir="rtl"
          lang="ar"
          className="font-arabic text-gilded text-lg leading-loose"
        >
          رَبِّ زِدْنِي عِلْمًا
        </p>
        <p className="text-xs text-muted-foreground">
          “My Lord, increase me in knowledge.” — Surah Ta-Ha 20:114
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Qur&apos;an text and recitation from{" "}
          <a
            href="https://alquran.cloud"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            AlQuran.cloud
          </a>
        </p>
      </div>
    </footer>
  );
}
