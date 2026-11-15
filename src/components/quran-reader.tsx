"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";

import {
  BASMALA,
  getSurahAudioUrl,
  isReciter,
  RECITERS,
  toArabicNumerals,
  type ReciterBaseUrl,
  type Surah,
  type SurahMeta,
} from "@/lib/quran";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type LoadState = "loading" | "ready" | "error";

type AyahTimeWindow = { startTime: number; endTime: number };

/** Estimate verse windows by text length, covering the entire recording. */
function estimateAyahTimeWindows(
  ayahs: Surah["ayahs"],
  duration: number
): AyahTimeWindow[] {
  if (!Number.isFinite(duration) || duration <= 0 || ayahs.length === 0) {
    return [];
  }

  const totalCharacters = ayahs.reduce(
    (total, ayah) => total + ayah.text.length,
    0
  );
  if (totalCharacters === 0) return [];

  let charactersRead = 0;
  return ayahs.map((ayah, index) => {
    const startTime = (charactersRead / totalCharacters) * duration;
    charactersRead += ayah.text.length;

    return {
      startTime,
      endTime:
        index === ayahs.length - 1
          ? duration
          : (charactersRead / totalCharacters) * duration,
    };
  });
}

function findActiveAyahIndex(windows: AyahTimeWindow[], currentTime: number) {
  if (windows.length === 0 || !Number.isFinite(currentTime)) return -1;

  const lastIndex = windows.length - 1;
  if (currentTime >= windows[lastIndex].endTime) return lastIndex;

  return windows.findIndex(
    ({ startTime, endTime }) =>
      currentTime >= startTime && currentTime < endTime
  );
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

function ReciterSelector({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string | null) => void;
}) {
  return (
    <div
      dir="rtl"
      lang="ar"
      className="flex flex-col gap-2 rounded-xl border border-gold/25 bg-card/60 p-4 backdrop-blur-md"
    >
      <label
        id="reciter-label"
        htmlFor="reciter-select"
        className="font-arabic text-lg leading-loose text-gold"
      >
        اختر القارئ
      </label>
      <Select value={value} onValueChange={onValueChange} items={RECITERS}>
        <SelectTrigger
          id="reciter-select"
          aria-labelledby="reciter-label"
          className="w-full border-gold/30 bg-background/60 px-4 font-arabic text-base backdrop-blur-md hover:bg-background/80 data-[size=default]:h-12 dark:bg-background/60 dark:hover:bg-background/80"
        >
          <SelectValue className="text-right" />
        </SelectTrigger>
        <SelectContent
          dir="rtl"
          lang="ar"
          align="start"
          sideOffset={8}
          alignItemWithTrigger={false}
          className="border border-gold/25 bg-background/90 text-foreground shadow-xl backdrop-blur-xl"
        >
          {RECITERS.map((reciter) => (
            <SelectItem
              key={reciter.value}
              value={reciter.value}
              className="min-h-11 py-2 pl-3 font-arabic text-base"
            >
              {reciter.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function QuranReader({
  surahs,
  listError,
}: {
  surahs: SurahMeta[];
  listError?: string;
}) {
  const [selected, setSelected] = useState(1);
  const [reciter, setReciter] = useState<ReciterBaseUrl>(RECITERS[0].value);
  const [surah, setSurah] = useState<Surah | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [textReloadKey, setTextReloadKey] = useState(0);
  const activeAyahRef = useRef<HTMLLIElement>(null);
  const ayahTimeWindowsRef = useRef<AyahTimeWindow[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioReloadKey, setAudioReloadKey] = useState(0);
  const [usingFallback, setUsingFallback] = useState(false);
  const [audioState, setAudioState] = useState<LoadState>("loading");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const resumePlayback = useRef(false);
  const playRequestId = useRef(0);
  const sourceChanging = useRef(false);

  const ayahs = surah?.ayahs ?? [];
  const displayedSurah =
    surah ?? surahs.find((item) => item.number === selected);
  const selectedReciter =
    RECITERS.find((option) => option.value === reciter) ?? RECITERS[0];
  const ayahCount = displayedSurah?.numberOfAyahs ?? ayahs.length;
  const fallbackBaseUrl =
    "fallback" in selectedReciter ? selectedReciter.fallback : undefined;
  const audioSrc = getSurahAudioUrl(
    usingFallback && fallbackBaseUrl ? fallbackBaseUrl : selectedReciter.value,
    selected
  );
  // Recalculate whether metadata or text arrives first, and for each reciter.
  const ayahTimeWindows = useMemo(
    () => estimateAyahTimeWindows(surah?.ayahs ?? [], duration),
    [surah, duration]
  );
  const activeAyahIndex = useMemo(
    () => findActiveAyahIndex(ayahTimeWindows, currentTime),
    [ayahTimeWindows, currentTime]
  );
  const currentAyahNumber = ayahs[activeAyahIndex]?.numberInSurah;

  const requestPlayback = useCallback(async (element: HTMLAudioElement) => {
    if (element !== audioRef.current) return;

    const requestId = ++playRequestId.current;

    try {
      await element.play();
    } catch (error: unknown) {
      // A stopped or replaced source must not change the new player's state.
      if (
        element !== audioRef.current ||
        requestId !== playRequestId.current
      ) {
        return;
      }

      // Let onError handle media failures and attempt the fallback source.
      if (element.error) return;

      resumePlayback.current = false;
      setPlaying(false);
      const name = (error as Error)?.name;
      if (name === "NotAllowedError" || name === "AbortError") {
        // The user can press Play if the browser blocks automatic playback.
        setAudioState(element.error ? "error" : "ready");
      } else {
        setAudioState("error");
      }
    }
  }, []);

  /* Text loading depends only on the Surah, never on the audio source. */
  useEffect(() => {
    const controller = new AbortController();

    async function loadText() {
      try {
        const response = await fetch(`/api/surah/${selected}`, {
          signal: controller.signal,
        });
        const body = await response.json();

        if (!response.ok) throw new Error(body?.error ?? "Request failed");
        if (controller.signal.aborted) return;

        setSurah(body as Surah);
        setState("ready");
      } catch (error) {
        if (controller.signal.aborted || (error as Error)?.name === "AbortError") {
          return;
        }
        setState("error");
      }
    }

    void loadText();
    return () => controller.abort();
  }, [selected, textReloadKey]);

  /* Reload for the selected recording, a fallback source, or an audio retry. */
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    playRequestId.current += 1;
    // Native controls and volume settings persist on the same audio element.
    element.load();
    if (resumePlayback.current) {
      void requestPlayback(element);
    }
    sourceChanging.current = false;
  }, [audioSrc, audioReloadKey, requestPlayback]);

  useEffect(() => {
    const element = audioRef.current;

    return () => {
      playRequestId.current += 1;
      resumePlayback.current = false;
      element?.pause();
    };
  }, []);

  useEffect(() => {
    ayahTimeWindowsRef.current = ayahTimeWindows;
  }, [ayahTimeWindows]);

  useEffect(() => {
    activeAyahRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeAyahIndex, selected, state]);

  function resetPlayback(resume = false) {
    playRequestId.current += 1;
    resumePlayback.current = resume;
    sourceChanging.current = true;
    ayahTimeWindowsRef.current = [];
    audioRef.current?.pause();
    setPlaying(resume);
    setCurrentTime(0);
    setDuration(0);
    setAudioState("loading");
  }

  function selectSurah(next: number) {
    if (next === selected) return;

    resetPlayback();
    setUsingFallback(false);
    setSelected(next);
    setSurah(null);
    setState("loading");
  }

  function selectReciter(next: string | null) {
    if (!next || next === reciter || !isReciter(next)) return;

    resetPlayback(playing || resumePlayback.current);
    setUsingFallback(false);
    setReciter(next);
  }

  function retryText() {
    setSurah(null);
    setState("loading");
    setTextReloadKey((key) => key + 1);
  }

  function retryAudio() {
    resetPlayback(true);
    setUsingFallback(false);
    setAudioReloadKey((key) => key + 1);
  }

  function startPlayback(element: HTMLAudioElement) {
    if (element !== audioRef.current) return;

    resumePlayback.current = true;
    if (element.ended) {
      element.currentTime = 0;
      setCurrentTime(0);
    }

    setPlaying(true);
    if (element.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      setAudioState("loading");
    }
    void requestPlayback(element);
  }

  function selectAyah(index: number) {
    const element = audioRef.current;
    const window = ayahTimeWindowsRef.current[index];
    if (
      !element ||
      !isCurrentAudio(element) ||
      audioState === "error" ||
      !window ||
      !Number.isFinite(element.duration) ||
      element.duration <= 0
    ) {
      return;
    }

    // Seek within the continuous file; never replace its source for a verse.
    element.currentTime = Math.min(window.startTime, element.duration);
    setCurrentTime(element.currentTime);
    startPlayback(element);
  }

  function markAudioReady(element: HTMLAudioElement) {
    if (
      !isCurrentAudio(element) ||
      element.readyState < HTMLMediaElement.HAVE_METADATA
    ) {
      return;
    }

    setAudioState("ready");
  }

  function updateDuration(element: HTMLAudioElement) {
    if (!isCurrentAudio(element)) return;

    setDuration(
      Number.isFinite(element.duration) && element.duration > 0
        ? element.duration
        : 0
    );
  }

  function updatePlaying(element: HTMLAudioElement) {
    if (!isCurrentAudio(element) || element.error) return;

    // Let onEnded finalize the continuous recording.
    if (element.ended) return;

    if (element.paused) playRequestId.current += 1;
    resumePlayback.current = !element.paused;
    setPlaying(!element.paused);
  }

  function finishPlayback(element: HTMLAudioElement) {
    if (!isCurrentAudio(element) || !element.ended) return;

    playRequestId.current += 1;
    resumePlayback.current = false;
    setPlaying(false);
    setCurrentTime(element.currentTime);
    setAudioState("ready");
  }

  function updatePlaybackTime(element: HTMLAudioElement) {
    if (!isCurrentAudio(element)) return;

    setCurrentTime(element.currentTime);
  }

  function isCurrentAudio(element: HTMLAudioElement) {
    return (
      element === audioRef.current &&
      !sourceChanging.current &&
      element.getAttribute("src") === audioSrc &&
      (!element.currentSrc || element.currentSrc === audioSrc)
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-10">
      {/* Surah browser */}
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

      <article className="flex min-w-0 flex-col gap-6">
        {displayedSurah && (
          <header className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-gilded">
                Surah {displayedSurah.number}
              </Badge>
              <Badge variant="secondary">
                {displayedSurah.revelationType}
              </Badge>
              <Badge variant="secondary">
                {displayedSurah.numberOfAyahs} ayahs
              </Badge>
            </div>

            <h2
              dir="rtl"
              lang="ar"
              className="font-arabic text-gilded text-4xl leading-[1.8] font-bold sm:text-5xl"
            >
              {displayedSurah.name}
            </h2>

            <p className="font-display text-xl">
              {displayedSurah.englishName}
              <span className="text-muted-foreground">
                {" "}
                — {displayedSurah.englishNameTranslation}
              </span>
            </p>
          </header>
        )}

        <ReciterSelector
          value={selectedReciter.value}
          onValueChange={selectReciter}
        />

        {/* Continuous playback remains independent of text loading. */}
        <div
          aria-busy={audioState === "loading"}
          className="sticky top-16 z-20 flex flex-col gap-3 rounded-2xl border border-gilded/70 bg-card/85 p-3.5 shadow-lg backdrop-blur-md sm:p-4"
        >
          {audioState === "loading" && (
            <p
              role="status"
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              {playing ? "Buffering recitation…" : "Loading recitation…"}
            </p>
          )}

          {audioState === "error" && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
            >
              <p className="text-xs text-destructive">
                This recitation is unavailable. Try again or choose another
                reciter.
              </p>
              <Button variant="outline" size="sm" onClick={retryAudio}>
                <RotateCcw />
                Retry audio
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[0.7rem] text-muted-foreground">
            <p>
              Recitation by{" "}
              <span className="font-medium text-[color:var(--gold)]">
                {selectedReciter.englishName}
              </span>
            </p>
            {activeAyahIndex >= 0 && (
              <p className="tabular-nums">
                Estimated ayah {currentAyahNumber} of {ayahCount}
              </p>
            )}
          </div>

          <audio
            ref={audioRef}
            src={audioSrc}
            controls
            preload="metadata"
            aria-label="Continuous Surah recitation"
            className="h-12 w-full min-w-0 rounded-lg [color-scheme:light] dark:[color-scheme:dark]"
            onLoadStart={(event) => {
              if (!isCurrentAudio(event.currentTarget)) return;

              setAudioState("loading");
              setCurrentTime(0);
              setDuration(0);
            }}
            onLoadedMetadata={(event) => {
              updateDuration(event.currentTarget);
              // The full duration drives the proportional verse windows.
              markAudioReady(event.currentTarget);
            }}
            onDurationChange={(event) => updateDuration(event.currentTarget)}
            onCanPlay={(event) => markAudioReady(event.currentTarget)}
            onWaiting={(event) => {
              if (
                !isCurrentAudio(event.currentTarget) ||
                event.currentTarget.readyState >=
                  HTMLMediaElement.HAVE_FUTURE_DATA
              ) {
                return;
              }

              setAudioState("loading");
            }}
            onPlaying={(event) => {
              if (
                !isCurrentAudio(event.currentTarget) ||
                event.currentTarget.paused ||
                event.currentTarget.error
              ) {
                return;
              }

              updatePlaying(event.currentTarget);
              setAudioState("ready");
            }}
            onPlay={(event) => updatePlaying(event.currentTarget)}
            onPause={(event) => updatePlaying(event.currentTarget)}
            onTimeUpdate={(event) => updatePlaybackTime(event.currentTarget)}
            onSeeked={(event) => updatePlaybackTime(event.currentTarget)}
            onEnded={(event) => finishPlayback(event.currentTarget)}
            onError={(event) => {
              if (
                !isCurrentAudio(event.currentTarget) ||
                !event.currentTarget.error
              ) {
                return;
              }

              if (!usingFallback && fallbackBaseUrl) {
                resetPlayback(playing || resumePlayback.current);
                setUsingFallback(true);
                return;
              }

              playRequestId.current += 1;
              resumePlayback.current = false;
              event.currentTarget.pause();
              setPlaying(false);
              setAudioState("error");
              setCurrentTime(0);
              setDuration(0);
            }}
          />
        </div>

        {state === "error" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
            <AlertTriangle className="size-6 text-destructive" />
            <div>
              <p className="font-medium">Could not load the surah text</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check your connection and try again. You can still listen to
                the recitation above.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={retryText}>
              <RotateCcw />
              Retry text
            </Button>
          </div>
        )}

        {state === "loading" && (
          <div
            role="status"
            aria-label="Loading surah text"
            className="flex flex-col gap-4"
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        )}

        {state === "ready" && surah && (
          <div className="flex flex-col gap-6">
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

            <ol className="flex flex-col gap-2">
              {ayahs.map((ayah, index) => {
                const isActive = index === activeAyahIndex;

                return (
                  <li
                    key={ayah.number}
                    id={`ayah-${index}`}
                    ref={isActive ? activeAyahRef : undefined}
                    className="scroll-mt-64"
                  >
                    <button
                      type="button"
                      onClick={() => selectAyah(index)}
                      disabled={
                        ayahTimeWindows.length === 0 || audioState === "error"
                      }
                      aria-pressed={isActive}
                      aria-label={`Play from estimated start of ayah ${ayah.numberInSurah}`}
                      className={cn(
                        "flex w-full gap-4 rounded-xl border px-4 py-4 text-right transition-colors duration-300 sm:px-5",
                        isActive
                          ? "border-primary/40 bg-primary/10 shadow-sm backdrop-blur-sm"
                          : "border-transparent hover:border-border hover:bg-muted/40"
                      )}
                    >
                      <span className="flex shrink-0 flex-col items-center gap-1.5 pt-1">
                        <span
                          className={cn(
                            "font-arabic grid size-8 place-items-center rounded-full border text-[0.7rem] tabular-nums transition-colors duration-300",
                            isActive
                              ? "border-primary/50 bg-primary/10 text-primary"
                              : "border-border text-muted-foreground"
                          )}
                        >
                          {toArabicNumerals(ayah.numberInSurah)}
                        </span>
                      </span>

                      <span
                        dir="rtl"
                        lang="ar"
                        className={cn(
                          "font-arabic flex-1 text-2xl leading-[2.15] transition-colors duration-300 sm:text-[1.7rem]",
                          isActive ? "text-primary" : "text-foreground/85"
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
          </div>
        )}
      </article>
    </div>
  );
}
