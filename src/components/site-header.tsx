import { TransitionLink } from "@/components/page-transitions";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-gilded/40 bg-background/70 backdrop-blur-lg">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 pr-4 pl-16 sm:pr-6 sm:pl-20">
        <TransitionLink href="/" className="group flex items-center gap-2.5">
          <span
            aria-hidden
            className="relative grid size-8 place-items-center"
          >
            <span className="absolute inset-0 rotate-45 rounded-md border border-gilded bg-[color:var(--gold)]/10 transition-transform duration-300 group-hover:rotate-[60deg]" />
            <span
              dir="rtl"
              lang="ar"
              className="font-arabic text-gilded relative text-sm leading-none"
            >
              م
            </span>
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-base font-semibold">Maha</span>
            <span className="text-[0.6rem] tracking-[0.2em] text-muted-foreground uppercase">
              Tasbeeh &amp; Qur&apos;an
            </span>
          </span>
        </TransitionLink>

        <nav
          aria-label="Quick navigation"
          className="ml-auto flex items-center gap-1 text-sm"
        >
          <TransitionLink
            href="/tasbeeh"
            className="hidden rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground sm:block"
          >
            Tasbeeh
          </TransitionLink>
          <TransitionLink
            href="/quran"
            className="hidden rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground sm:block"
          >
            Qur&apos;an
          </TransitionLink>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
