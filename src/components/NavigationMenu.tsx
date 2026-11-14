"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Clock, Home, Infinity as InfinityIcon, Menu } from "lucide-react";

import { TransitionLink } from "@/components/page-transitions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tasbeeh", label: "Tasbeeh", icon: InfinityIcon },
  { href: "/quran", label: "Quran", icon: BookOpen },
  { href: "/prayers", label: "مواقيت الصلاة", icon: Clock },
];

export function NavigationMenu() {
  const pathname = usePathname();

  return <NavigationDrawer key={pathname} pathname={pathname} />;
}

function NavigationDrawer({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Open navigation menu"
            className="fixed top-2 left-4 z-50 size-10 border-border bg-background/75 text-foreground shadow-sm backdrop-blur-xl sm:left-6"
          />
        }
      >
        <Menu aria-hidden="true" className="size-5" />
      </SheetTrigger>

      <SheetContent
        side="left"
        className="gap-6 border-gilded bg-background/85 px-6 pt-16 pb-8 backdrop-blur-2xl"
      >
        <SheetHeader className="gap-2 p-0">
          <SheetTitle className="font-display text-gilded text-3xl">
            Explore
          </SheetTitle>
          <SheetDescription>
            A quiet place for dhikr and recitation.
          </SheetDescription>
        </SheetHeader>

        <nav aria-label="Main navigation" className="flex flex-col gap-2">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;

            return (
              <TransitionLink
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active
                    ? "border-gold/30 bg-gold/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon aria-hidden="true" className="size-5 text-gold" />
                <span
                  dir={href === "/prayers" ? "rtl" : undefined}
                  lang={href === "/prayers" ? "ar" : undefined}
                  className={href === "/prayers" ? "font-arabic text-lg" : undefined}
                >
                  {label}
                </span>
              </TransitionLink>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
