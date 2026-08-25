"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { Button } from "@/components/ui/button";

/**
 * The `dark` class on <html> is the single source of truth — ThemeScript sets
 * it before first paint, and this component both reads and writes it. A
 * MutationObserver feeds changes back so the icon can never disagree with the
 * document.
 */
function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains("dark");

/** Matches ThemeScript's default, so the server markup agrees. */
const isDarkOnServer = () => true;

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, isDarkOnServer);
  const hydrated = useIsHydrated();

  function toggle() {
    const next = !dark;

    document.documentElement.classList.toggle("dark", next);

    try {
      window.localStorage.setItem("noor-theme", next ? "dark" : "light");
    } catch {
      // Storage unavailable — the toggle still works for this page view.
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {/* Held back until hydration so the icon cannot contradict the DOM. */}
      {hydrated ? dark ? <Sun /> : <Moon /> : null}
    </Button>
  );
}
