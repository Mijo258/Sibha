"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useTransition,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAnimate, useReducedMotion } from "framer-motion";

type NavigationOptions = { replace: boolean; scroll: boolean };

type PageTransitionContextValue = {
  contentRef: RefObject<HTMLDivElement | null>;
  navigate: (href: string, options: NavigationOptions) => Promise<void>;
};

const PageTransitionContext = createContext<PageTransitionContextValue | null>(
  null
);

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reducedMotion = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const navigating = useRef(false);
  const navigationId = useRef(0);

  useEffect(() => {
    if (pending) return;

    navigating.current = false;
    navigationId.current += 1;
    if (scope.current) {
      // Reveal the persistent frame as the new template fades in.
      void animate(scope.current, { opacity: 1 }, { duration: 0 });
    }
  }, [pathname, pending, scope, animate]);

  async function navigate(href: string, options: NavigationOptions) {
    if (navigating.current) return;
    navigating.current = true;
    const requestId = ++navigationId.current;

    if (scope.current && !reducedMotion) {
      await animate(
        scope.current,
        { opacity: 0 },
        { duration: 0.18, ease: "easeOut" }
      );
    }

    // A browser navigation during the fade cancels this older request.
    if (requestId !== navigationId.current) return;

    startTransition(() => {
      if (options.replace) {
        router.replace(href, { scroll: options.scroll });
      } else {
        router.push(href, { scroll: options.scroll });
      }
    });
  }

  return (
    <PageTransitionContext.Provider value={{ contentRef: scope, navigate }}>
      {children}
    </PageTransitionContext.Provider>
  );
}

export function PageTransitionContent({ children }: { children: ReactNode }) {
  const transition = useContext(PageTransitionContext);

  return (
    <div ref={transition?.contentRef} className="flex flex-1 flex-col">
      {children}
    </div>
  );
}

type TransitionLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "onNavigate"
> & { href: string };

export function TransitionLink({
  href,
  replace = false,
  scroll = true,
  ...props
}: TransitionLinkProps) {
  const pathname = usePathname();
  const transition = useContext(PageTransitionContext);

  return (
    <Link
      {...props}
      href={href}
      replace={replace}
      scroll={scroll}
      onNavigate={(event) => {
        const destination = href.split(/[?#]/)[0];
        if (
          !transition ||
          !href.startsWith("/") ||
          href.startsWith("//") ||
          destination === pathname
        ) {
          return;
        }

        // onNavigate preserves Next.js prefetching and modified-click behavior.
        event.preventDefault();
        void transition.navigate(href, { replace, scroll });
      }}
    />
  );
}
