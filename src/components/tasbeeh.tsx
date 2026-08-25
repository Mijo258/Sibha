"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, RotateCcw, Sparkles, Trash2, Undo2 } from "lucide-react";

import { useLocalStorage } from "@/hooks/use-local-storage";
import { DEFAULT_DHIKR, TARGET_PRESETS, type Dhikr } from "@/lib/dhikr";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/**
 * Everything the tasbeeh remembers, in one localStorage record so that a
 * count and the dhikr it belongs to can never be written out of step.
 */
type TasbeehState = {
  activeId: string;
  counts: Record<string, number>;
  custom: Dhikr[];
};

const STORAGE_KEY = "noor-tasbeeh";

const INITIAL_STATE: TasbeehState = {
  activeId: DEFAULT_DHIKR[0].id,
  counts: {},
  custom: [],
};

const RING = 264;

function vibrate(pattern: number | number[]) {
  // Chrome logs a console error if the frame has never been activated, which
  // happens when something clicks the orb programmatically. A real tap or
  // keypress always sets this, so the check costs nothing in practice.
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
    return;
  }

  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Unsupported or blocked by permissions policy — silent by design.
  }
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Gold arc around the orb. Wraps once per round rather than saturating, so
 * bead 34 of a 33-count dhikr starts a fresh arc.
 */
function ProgressRing({ count, target }: { count: number; target: number }) {
  const stroke = 6;
  const r = (RING - stroke) / 2 - 6;
  const circumference = 2 * Math.PI * r;

  const intoRound = count % target;
  const complete = count > 0 && intoRound === 0;
  const fraction = complete ? 1 : intoRound / target;

  return (
    <svg
      viewBox={`0 0 ${RING} ${RING}`}
      className="absolute inset-0 size-full -rotate-90"
      aria-hidden
    >
      <circle
        cx={RING / 2}
        cy={RING / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="stroke-border/70"
      />
      <motion.circle
        cx={RING / 2}
        cy={RING / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={false}
        animate={{ strokeDashoffset: circumference * (1 - fraction) }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        style={{ stroke: "var(--gold)" }}
      />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function AddDhikrDialog({ onAdd }: { onAdd: (d: Omit<Dhikr, "id">) => void }) {
  const [open, setOpen] = useState(false);
  const [arabic, setArabic] = useState("");
  const [transliteration, setTransliteration] = useState("");
  const [translation, setTranslation] = useState("");
  const [target, setTarget] = useState(33);

  function reset() {
    setArabic("");
    setTransliteration("");
    setTranslation("");
    setTarget(33);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const name = transliteration.trim() || arabic.trim();
    if (!name) return;

    onAdd({
      arabic: arabic.trim() || name,
      transliteration: transliteration.trim(),
      translation: translation.trim(),
      target: Math.max(1, target),
      custom: true,
    });

    reset();
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-gilded text-[color:var(--gold)]"
          />
        }
      >
        <Plus />
        Add dhikr
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Add a custom dhikr
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground">
              Arabic
            </span>
            <Input
              value={arabic}
              onChange={(e) => setArabic(e.target.value)}
              placeholder="سُبْحَانَ اللّٰه"
              dir="rtl"
              className="h-11 font-arabic text-lg leading-loose"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground">
              Transliteration
            </span>
            <Input
              value={transliteration}
              onChange={(e) => setTransliteration(e.target.value)}
              placeholder="Subhan Allah"
              className="h-9"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground">
              Meaning
            </span>
            <Input
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="Glory be to Allah"
              className="h-9"
            />
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground">
              Beads per round
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {TARGET_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTarget(preset)}
                  aria-pressed={target === preset}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                    target === preset
                      ? "bg-[color:var(--gold)] text-[color:var(--navy)]"
                      : "bg-muted text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </fieldset>

          <Button type="submit" size="lg" className="mt-1 gap-1.5">
            <Check />
            Add to my list
          </Button>

          <p className="text-xs text-muted-foreground">
            Arabic is optional — a transliteration alone is enough. Your list is
            saved on this device.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

export function Tasbeeh() {
  const [state, setState, hydrated] = useLocalStorage<TasbeehState>(
    STORAGE_KEY,
    INITIAL_STATE
  );

  const dhikrList = [...DEFAULT_DHIKR, ...state.custom];
  const active =
    dhikrList.find((d) => d.id === state.activeId) ?? dhikrList[0];

  const count = state.counts[active.id] ?? 0;
  const rounds = Math.floor(count / active.target);
  const intoRound = count % active.target;
  const remaining = intoRound === 0 && count > 0 ? 0 : active.target - intoRound;
  const sessionTotal = Object.values(state.counts).reduce((a, b) => a + b, 0);

  /** Round-completion flourish. */
  const [celebrating, setCelebrating] = useState(false);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Expanding rings, one per tap. */
  const [ripples, setRipples] = useState<number[]>([]);
  const rippleSeq = useRef(0);

  useEffect(() => {
    return () => {
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    };
  }, []);

  // Plain handlers: nothing depends on their identity, so the React Compiler
  // memoizes them better than hand-written dependency lists can.
  function increment() {
    const next = count + 1;
    const roundDone = next % active.target === 0;

    setState((prev) => ({
      ...prev,
      counts: {
        ...prev.counts,
        [active.id]: (prev.counts[active.id] ?? 0) + 1,
      },
    }));

    const id = (rippleSeq.current += 1);
    setRipples((prev) => [...prev, id]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r !== id));
    }, 750);

    if (roundDone) {
      vibrate([20, 55, 20, 55, 40]);
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
      setCelebrating(true);
      celebrateTimer.current = setTimeout(() => setCelebrating(false), 2000);
    } else {
      vibrate(14);
    }
  }

  function undo() {
    setState((prev) => ({
      ...prev,
      counts: {
        ...prev.counts,
        [active.id]: Math.max(0, (prev.counts[active.id] ?? 0) - 1),
      },
    }));
  }

  function resetCount() {
    setState((prev) => ({
      ...prev,
      counts: { ...prev.counts, [active.id]: 0 },
    }));
    vibrate(45);
  }

  /**
   * No global key listener here on purpose. The orb is a real <button>, so it
   * already counts on Space and Enter when focused; binding Space at the
   * window would swallow page-scroll everywhere else on the page.
   */

  function selectDhikr(id: string) {
    setState((prev) => ({ ...prev, activeId: id }));
  }

  function addCustom(dhikr: Omit<Dhikr, "id">) {
    const id = `custom-${Date.now().toString(36)}`;
    setState((prev) => ({
      ...prev,
      custom: [...prev.custom, { ...dhikr, id }],
      activeId: id,
    }));
  }

  function removeCustom(id: string) {
    setState((prev) => {
      const counts = { ...prev.counts };
      delete counts[id];

      return {
        activeId: prev.activeId === id ? DEFAULT_DHIKR[0].id : prev.activeId,
        custom: prev.custom.filter((d) => d.id !== id),
        counts,
      };
    });
  }

  return (
    <div className="flex flex-col items-center gap-7">
      {/* ── The dhikr being recited, directly above the counter ── */}
      <div className="flex min-h-24 flex-col items-center justify-end gap-2 text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex flex-col items-center gap-1.5"
          >
            <p
              dir="rtl"
              lang="ar"
              className="font-arabic text-3xl leading-[1.9] text-foreground sm:text-4xl"
            >
              {active.arabic}
            </p>
            {(active.transliteration || active.translation) && (
              <p className="max-w-xs text-sm text-muted-foreground">
                {active.transliteration && (
                  <span className="font-medium text-[color:var(--gold)]">
                    {active.transliteration}
                  </span>
                )}
                {active.transliteration && active.translation && " — "}
                {active.translation}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Orb ── */}
      <div
        className="relative grid shrink-0 place-items-center"
        style={{ width: RING, height: RING }}
      >
        <div
          className="animate-halo absolute inset-6 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--primary), transparent 55%), transparent 70%)",
          }}
        />

        {hydrated && <ProgressRing count={count} target={active.target} />}

        {/* Tap ripples */}
        <AnimatePresence>
          {ripples.map((id) => (
            <motion.span
              key={id}
              aria-hidden
              initial={{ opacity: 0.5, scale: 0.72 }}
              animate={{ opacity: 0, scale: 1.32 }}
              transition={{ duration: 0.75, ease: "easeOut" }}
              className="pointer-events-none absolute size-44 rounded-full border-2"
              style={{ borderColor: "var(--gold)" }}
            />
          ))}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={increment}
          whileTap={{ scale: 0.955 }}
          transition={{ type: "spring", stiffness: 520, damping: 26 }}
          aria-label={`Count ${active.transliteration || active.arabic}`}
          className={cn(
            "relative grid size-44 place-items-center rounded-full",
            "border border-gilded bg-gradient-to-b from-card to-secondary/70",
            "shadow-[0_18px_50px_-18px_color-mix(in_oklch,var(--gold),transparent_55%)]",
            "outline-none select-none",
            "focus-visible:ring-4 focus-visible:ring-[color:var(--gold)]/40"
          )}
        >
          <span className="pointer-events-none absolute inset-1.5 rounded-full border border-gilded/60" />

          <span className="flex flex-col items-center gap-0.5">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={count}
                initial={{ opacity: 0, y: 16, scale: 0.82 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.82, position: "absolute" }}
                transition={{ type: "spring", stiffness: 340, damping: 24 }}
                // Sans, not the display face: Cormorant's zero is a perfect
                // circle, so "0 of 33" reads as the letter O. `zero` slashes it
                // where the font supports it.
                className="text-gilded text-[3.25rem] leading-none font-semibold tabular-nums [font-feature-settings:'zero'] [font-variant-numeric:slashed-zero_tabular-nums]"
              >
                {hydrated ? count : 0}
              </motion.span>
            </AnimatePresence>
            <span className="text-[0.65rem] font-medium tracking-[0.22em] text-muted-foreground uppercase">
              of {active.target}
            </span>
          </span>
        </motion.button>

        {/* Round-complete flourish */}
        <AnimatePresence>
          {celebrating && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.9 }}
              className="absolute -bottom-1 flex items-center gap-1.5 rounded-full border border-gilded bg-card px-3 py-1 text-xs font-medium text-[color:var(--gold)] shadow-lg"
            >
              <Sparkles className="size-3" />
              Round {rounds} complete
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Counter readouts ── */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span>
          Remaining{" "}
          <strong className="font-semibold text-foreground tabular-nums">
            {hydrated ? remaining : active.target}
          </strong>
        </span>
        <span aria-hidden className="text-border">
          •
        </span>
        <span>
          Rounds{" "}
          <strong className="font-semibold text-foreground tabular-nums">
            {hydrated ? rounds : 0}
          </strong>
        </span>
        <span aria-hidden className="text-border">
          •
        </span>
        <span>
          Session total{" "}
          <strong className="font-semibold text-foreground tabular-nums">
            {hydrated ? sessionTotal : 0}
          </strong>
        </span>
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={undo}
          disabled={count === 0}
          className="gap-1.5"
        >
          <Undo2 />
          Undo
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={resetCount}
          disabled={count === 0}
          className="gap-1.5"
        >
          <RotateCcw />
          Reset
        </Button>
      </div>

      <p aria-live="polite" className="sr-only">
        {active.transliteration || active.arabic}: {count}
      </p>

      <Separator className="my-1" />

      {/* ── Dhikr list ── */}
      <div className="flex w-full flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Choose a dhikr
          </h3>
          <AddDhikrDialog onAdd={addCustom} />
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {dhikrList.map((dhikr) => {
            const isActive = dhikr.id === active.id;
            const dhikrCount = state.counts[dhikr.id] ?? 0;

            return (
              // The remove control is a sibling of the selector, not a child —
              // nesting one button inside another is invalid HTML.
              <li key={dhikr.id} className="relative">
                <button
                  type="button"
                  onClick={() => selectDhikr(dhikr.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-3 text-left transition-colors",
                    dhikr.custom && "pr-11",
                    isActive
                      ? "border-gilded bg-[color:var(--gold)]/10"
                      : "border-border hover:border-gilded/60 hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      dir="rtl"
                      lang="ar"
                      className="font-arabic truncate text-lg leading-loose"
                    >
                      {dhikr.arabic}
                    </span>
                    {dhikrCount > 0 && (
                      <Badge
                        variant={isActive ? "default" : "secondary"}
                        className="shrink-0 tabular-nums"
                      >
                        {hydrated ? dhikrCount : 0}
                      </Badge>
                    )}
                  </div>
                  {dhikr.transliteration && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {dhikr.transliteration}
                    </span>
                  )}
                </button>

                {dhikr.custom && (
                  <button
                    type="button"
                    onClick={() => removeCustom(dhikr.id)}
                    aria-label={`Remove ${dhikr.transliteration || dhikr.arabic}`}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
