"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import {
  BASMALA,
  RECITER_NAME,
  toArabicNumerals,
  type Surah,
  type SurahMeta,
} from "@/lib/quran";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";

type LoadState = "loading" | "ready" | "error";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/** Reads a slider callback value that may be a scalar or a tuple. */
function firstValue(value: number | readonly number[]) {
  return Array.isArray(value) ? value[0] : (value as number);
}

/* ────────────────────────────────────────────────────────────────────────── */

/** Number plate in the shape of a rotated square — a nod to girih tiling. */
function SurahNumber({ n, active }: { n: number; active: boolean }) {
  return (
    <span className="relative grid size-9 shrink-0 place-items-center">
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rotate-45 rounded-[5px] border transition-colors",
          active
            ? "border-[color:var(--gold)] bg-[color:var(--gold)]/15"
            : "border-border"
        )}
      />
      <span
        className={cn(
          "relative text-xs font-medium tabular-nums",
          active ? "text-[color:var(--gold)]" : "text-muted-foreground"
        )}
      >
        {n}
      </span>
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function SurahBrowser({
  surahs,
  selected,
  onSelect,
}: {
  surahs: SurahMeta[];
  selected: number;
  onSelect: (n: number) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return surahs;

    return surahs.filter(
      (s) =>
        String(s.number) === q ||
        s.englishName.toLowerCase().includes(q) ||
        s.englishNameTranslation.toLowerCase().includes(q) ||
        s.name.includes(query.trim())
    );
  }, [query, surahs]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search 114 surahs…"
          aria-label="Search surahs"
          className="h-9 pl-8"
        />
      </div>

      <ScrollArea className="h-72 pr-3 lg:h-[calc(100vh-16rem)]">
        {filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            No surah matches “{query}”.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((surah) => {
              const active = surah.number === selected;

              return (
                <li key={surah.number}>
                  <button
                    type="button"
                    onClick={() => onSelect(surah.number)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                      active
                        ? "bg-[color:var(--gold)]/10 ring-1 ring-[color:var(--gold)]/40"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <SurahNumber n={surah.number} active={active} />

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            active && "text-[color:var(--gold)]"
                          )}
                        >
                          {surah.englishName}
                        </span>
                        <span
                          dir="rtl"
                          lang="ar"
                          className="font-arabic shrink-0 text-base leading-loose"
                        >
                          {surah.name}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {surah.englishNameTranslation} · {surah.numberOfAyahs}{" "}
                        ayahs
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

export function QuranReader({
  surahs,
  listError,
}: {
  surahs: SurahMeta[];
  listError?: string;
}) {
  const [selected, setSelected] = useState(1);
  const [surah, setSurah] = useState<Surah | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  /** True once the user has started playback, so we do not autoplay on load. */
  const hasInteracted = useRef(false);

  const ayahs = surah?.ayahs ?? [];
  const activeAyah = ayahs[activeIndex];

  /* ── Load the selected surah ── */
  useEffect(() => {
    const controller = new AbortController();

    // Only the outcome is written here. Everything that a *selection* implies
    // is reset in the handler below, where the user action actually happens.
    async function load() {
      try {
        const response = await fetch(`/api/surah/${selected}`, {
          signal: controller.signal,
        });

        const body = await response.json();
        if (!response.ok) throw new Error(body?.error ?? "Request failed");

        setSurah(body as Surah);
        setState("ready");
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
        setState("error");
      }
    }

    void load();
    return () => controller.abort();
  }, [selected, reloadKey]);

  function resetPlayback() {
    setPlaying(false);
    setActiveIndex(0);
    setCurrentTime(0);
    setDuration(0);
  }

  function selectSurah(next: number) {
    if (next === selected) return;

    setSelected(next);
    setSurah(null);
    setState("loading");
    resetPlayback();
  }

  function retry() {
    setSurah(null);
    setState("loading");
    resetPlayback();
    setReloadKey((key) => key + 1);
  }

  /* ── Drive the element from state ── */
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    if (playing) {
      // A src swap mid-play can reject with AbortError; treat any failure as a
      // stop so the button never lies about what the audio is doing.
      void element.play().catch(() => setPlaying(false));
    } else {
      element.pause();
    }
  }, [playing, activeIndex, surah]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    element.volume = volume;
    element.muted = muted;
  }, [volume, muted]);

  /* ── Follow the recitation down the page ── */
  useEffect(() => {
    if (!playing || !hasInteracted.current) return;

    const node = document.getElementById(`ayah-${activeIndex}`);
    if (!node) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    node.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
  }, [activeIndex, playing]);

  const togglePlay = useCallback(() => {
    hasInteracted.current = true;
    setPlaying((prev) => !prev);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= ayahs.length) return;
      setActiveIndex(index);
      setCurrentTime(0);
    },
    [ayahs.length]
  );

  const playFrom = useCallback(
    (index: number) => {
      hasInteracted.current = true;

      // Re-tapping the verse already playing restarts it. The src does not
      // change in that case, so the element needs rewinding by hand.
      if (index === activeIndex) {
        const element = audioRef.current;
        if (element) element.currentTime = 0;
      }

      setActiveIndex(index);
      setCurrentTime(0);
      setPlaying(true);
    },
    [activeIndex]
  );

  /** Auto-advance: the API serves one file per ayah, so a surah is a queue. */
  const handleEnded = useCallback(() => {
    if (activeIndex < ayahs.length - 1) {
      setActiveIndex((prev) => prev + 1);
      setCurrentTime(0);
      return;
    }

    setPlaying(false);
    setActiveIndex(0);
    setCurrentTime(0);
  }, [activeIndex, ayahs.length]);

  const restart = useCallback(() => {
    setActiveIndex(0);
    setCurrentTime(0);

    const element = audioRef.current;
    if (element) element.currentTime = 0;
  }, []);

  const progressMax = duration > 0 ? duration : 1;

  return (
    <div className="grid gap-8 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-10">
      {/* ── Sidebar ── */}
      <aside className="flex min-h-0 flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
        <h2 className="font-display flex items-center gap-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">
          <BookOpen className="size-3.5" />
          Surahs
        </h2>

        {listError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {listError}
          </p>
        ) : (
          <SurahBrowser
            surahs={surahs}
            selected={selected}
            onSelect={selectSurah}
          />
        )}
      </aside>

      {/* ── Reader ── */}
      <div className="min-w-0">
        {state === "error" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
            <AlertTriangle className="size-6 text-destructive" />
            <div>
              <p className="font-medium">Could not load this surah</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The Qur&apos;an service did not respond. Check your connection
                and try again.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={retry}
            >
              <RotateCcw />
              Retry
            </Button>
          </div>
        )}

        {state === "loading" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="h-9 w-52" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {state === "ready" && surah && (
          <article className="flex flex-col gap-6">
            {/* Surah header */}
            <header className="flex flex-col items-center gap-3 text-center">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-gilded">
                  Surah {surah.number}
                </Badge>
                <Badge variant="secondary">{surah.revelationType}</Badge>
                <Badge variant="secondary">{surah.numberOfAyahs} ayahs</Badge>
              </div>

              <h2
                dir="rtl"
                lang="ar"
                className="font-arabic text-gilded text-4xl leading-[1.8] font-bold sm:text-5xl"
              >
                {surah.name}
              </h2>

              <p className="font-display text-xl">
                {surah.englishName}
                <span className="text-muted-foreground">
                  {" "}
                  — {surah.englishNameTranslation}
                </span>
              </p>
            </header>

            {/* Player */}
            <div className="sticky top-2 z-20 flex flex-col gap-3 rounded-2xl border border-gilded/70 bg-card/85 p-3.5 shadow-lg backdrop-blur-md sm:p-4">
              <div className="flex items-center gap-3">
                <Button
                  size="icon-lg"
                  onClick={togglePlay}
                  aria-label={playing ? "Pause recitation" : "Play recitation"}
                  className="size-11 shrink-0 rounded-full"
                >
                  {playing ? (
                    <Pause className="size-4.5" />
                  ) : (
                    <Play className="size-4.5" />
                  )}
                </Button>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => goTo(activeIndex - 1)}
                    disabled={activeIndex === 0}
                    aria-label="Previous ayah"
                  >
                    <SkipBack />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => goTo(activeIndex + 1)}
                    disabled={activeIndex >= ayahs.length - 1}
                    aria-label="Next ayah"
                  >
                    <SkipForward />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={restart}
                    aria-label="Restart surah"
                  >
                    <RotateCcw />
                  </Button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-medium">
                      Ayah{" "}
                      <span className="tabular-nums">
                        {activeAyah?.numberInSurah ?? 1}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        of {surah.numberOfAyahs}
                      </span>
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <Slider
                    // Passed as a tuple so the wrapper renders a single thumb.
                    value={[Math.min(currentTime, progressMax)]}
                    min={0}
                    max={progressMax}
                    step={0.5}
                    aria-label="Seek within ayah"
                    onValueChange={(value: number | readonly number[]) => {
                      const next = firstValue(value);
                      setCurrentTime(next);

                      const element = audioRef.current;
                      if (element) element.currentTime = next;
                    }}
                    className="mt-1.5"
                  />
                </div>

                <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? "Unmute" : "Mute"}
                  >
                    {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
                  </Button>
                  <Slider
                    value={[muted ? 0 : volume]}
                    min={0}
                    max={1}
                    step={0.05}
                    aria-label="Volume"
                    onValueChange={(value: number | readonly number[]) => {
                      const next = firstValue(value);
                      setVolume(next);
                      setMuted(next === 0);
                    }}
                    className="w-20"
                  />
                </div>
              </div>

              <p className="text-[0.7rem] text-muted-foreground">
                Recitation by{" "}
                <span className="font-medium text-[color:var(--gold)]">
                  {RECITER_NAME}
                </span>{" "}
                · plays through the surah ayah by ayah
              </p>

              {/* One file per ayah; src swaps as the queue advances. */}
              <audio
                ref={audioRef}
                src={activeAyah?.audio}
                preload="metadata"
                onEnded={handleEnded}
                onLoadStart={() => {
                  // New source: the previous ayah's duration no longer applies.
                  setDuration(0);
                  setCurrentTime(0);
                }}
                onTimeUpdate={(event) =>
                  setCurrentTime(event.currentTarget.currentTime)
                }
                onLoadedMetadata={(event) =>
                  setDuration(event.currentTarget.duration)
                }
                onError={() => setPlaying(false)}
              />
            </div>

            {/* Basmala heading, lifted off ayah 1 */}
            {surah.showBasmala && (
              <>
                <p
                  dir="rtl"
                  lang="ar"
                  className="font-arabic text-gilded py-2 text-center text-2xl leading-[2] sm:text-3xl"
                >
                  {BASMALA}
                </p>
                <Separator className="mx-auto max-w-xs" />
              </>
            )}

            {/* Ayahs */}
            <ol className="flex flex-col gap-2">
              {ayahs.map((ayah, index) => {
                const isActive = index === activeIndex;
                const isReciting = isActive && playing;

                return (
                  <li key={ayah.number} id={`ayah-${index}`}>
                    <button
                      type="button"
                      onClick={() => playFrom(index)}
                      aria-label={`Play from ayah ${ayah.numberInSurah}`}
                      className={cn(
                        "flex w-full gap-4 rounded-xl border px-4 py-4 text-right transition-colors sm:px-5",
                        isActive
                          ? "border-gilded bg-[color:var(--gold)]/[0.07]"
                          : "border-transparent hover:border-border hover:bg-muted/40"
                      )}
                    >
                      <span className="flex shrink-0 flex-col items-center gap-1.5 pt-1">
                        <span
                          className={cn(
                            "font-arabic grid size-8 place-items-center rounded-full border text-[0.7rem] tabular-nums transition-colors",
                            isActive
                              ? "border-[color:var(--gold)] text-[color:var(--gold)]"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {toArabicNumerals(ayah.numberInSurah)}
                        </span>

                        <AnimatePresence>
                          {isReciting && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.6 }}
                              className="text-[color:var(--gold)]"
                            >
                              <Loader2 className="size-3 animate-spin" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>

                      <span
                        dir="rtl"
                        lang="ar"
                        className={cn(
                          "font-arabic flex-1 text-2xl leading-[2.15] transition-colors sm:text-[1.7rem]",
                          isActive ? "text-foreground" : "text-foreground/85"
                        )}
                      >
                        {ayah.text}
                        {ayah.sajda && (
                          <span
                            title="Place of prostration"
                            className="ms-2 align-middle text-sm text-[color:var(--gold)]"
                          >
                            ۩
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </article>
        )}
      </div>
    </div>
  );
}
