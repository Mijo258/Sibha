"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { addDays, format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  LocateFixed,
  Loader2,
  MapPin,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
} from "lucide-react";

import {
  AZANS,
  PRAYERS,
  fetchPrayerTimes,
  getNextPrayer,
  getZonedClock,
  type AzanSource,
  type NextPrayer,
  type PrayerLocation,
  type PrayerSchedule,
  type ZonedClock,
} from "@/lib/prayers";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type NotificationStatus = NotificationPermission | "unsupported" | "checking";
type LoadState = "loading" | "ready" | "error";
type PrayerCountdown = NextPrayer & {
  remainingSeconds: number;
  isTomorrow: boolean;
};

const prayerIcons = {
  Fajr: Sunrise,
  Dhuhr: Sun,
  Asr: Sun,
  Maghrib: Sunset,
  Isha: Moon,
};
const glassPanel =
  "rounded-2xl border border-gold/25 bg-card/65 shadow-sm backdrop-blur-xl";

export function PrayerTimes() {
  const [location, setLocation] = useState<PrayerLocation | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [prayerTimes, setPrayerTimes] = useState<PrayerSchedule | null>(null);
  const [selectedAzan, setSelectedAzan] = useState<AzanSource>(AZANS[0].value);
  const [geoState, setGeoState] = useState<"locating" | "ready" | "manual">("locating");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showCityForm, setShowCityForm] = useState(false);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [clock, setClock] = useState<ZonedClock | null>(null);
  const [countdown, setCountdown] = useState<PrayerCountdown | null>(null);
  const [countdownError, setCountdownError] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] =
    useState<NotificationStatus>("checking");
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [azanPlaying, setAzanPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const mounted = useRef(false);
  const activeLocationKey = useRef("");
  const locationRequestId = useRef(0);
  const notificationRequest = useRef<Promise<NotificationPermission> | null>(null);
  const azanAudio = useRef<HTMLAudioElement | null>(null);
  const audioRequestId = useRef(0);
  const notifiedPrayers = useRef(new Set<string>());
  const todaySchedule = useRef<{
    locationKey: string;
    schedule: PrayerSchedule;
  } | null>(null);
  const tomorrowSchedule = useRef<{
    locationKey: string;
    schedule: PrayerSchedule;
  } | null>(null);

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const locationKey = location ? JSON.stringify(location) : "";
  const locationLabel =
    location?.type === "city"
      ? location.city + "، " + location.country
      : "موقعك الحالي";
  const nextPrayer =
    prayerTimes && clock && clock.dateKey === prayerTimes.dateKey
      ? PRAYERS.find((prayer) => prayerTimes.timings[prayer.key] >= clock.time)
      : undefined;
  const countdownUnits = countdown
    ? [
        { label: "ساعات", value: Math.floor(countdown.remainingSeconds / 3600) },
        { label: "دقائق", value: Math.floor(countdown.remainingSeconds / 60) % 60 },
        { label: "ثوانٍ", value: countdown.remainingSeconds % 60 },
      ]
    : [];

  const applyLocation = useCallback((next: PrayerLocation) => {
    activeLocationKey.current = JSON.stringify(next);
    todaySchedule.current = null;
    tomorrowSchedule.current = null;
    setLocation(next);
    setPrayerTimes(null);
    setLoadState("loading");
    setLoadError(null);
    setTimezone(null);
    setClock(null);
    setCountdown(null);
    setCountdownError(null);
    setAlertError(null);
    setAnnouncement(null);
    setLocationError(null);
    setShowCityForm(false);
  }, []);

  const requestLocation = useCallback(async () => {
    const requestId = ++locationRequestId.current;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is unavailable"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12_000,
          maximumAge: 300_000,
        });
      });
      if (!mounted.current || requestId !== locationRequestId.current) return;

      applyLocation({
        type: "coordinates",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setGeoState("ready");
    } catch {
      if (!mounted.current || requestId !== locationRequestId.current) return;
      setGeoState("manual");
      setShowCityForm(true);
      setLocationError("تعذر تحديد موقعك تلقائياً. أدخل المدينة والدولة أدناه.");
    }
  }, [applyLocation]);

  const requestNotifications = useCallback(async () => {
    try {
      let permission: NotificationStatus;
      if (typeof Notification === "undefined") {
        permission = await Promise.resolve("unsupported" as const);
      } else if (Notification.permission === "default") {
        // Reuse a pending browser prompt during Strict Mode's effect replay.
        notificationRequest.current ??= Notification.requestPermission();
        permission = await notificationRequest.current;
      } else {
        permission = await Promise.resolve(Notification.permission);
      }
      if (!mounted.current) return;
      setNotificationStatus(permission);
      setNotificationError(null);
      notificationRequest.current = null;
    } catch {
      if (!mounted.current) return;
      notificationRequest.current = null;
      setNotificationStatus(
        typeof Notification === "undefined" ? "unsupported" : Notification.permission
      );
      setNotificationError("اضغط تفعيل الإشعارات للسماح بالتنبيه من المتصفح.");
    }
  }, []);

  const playAzan = useCallback(async () => {
    const audio = azanAudio.current;
    if (!audio) return;
    const requestId = ++audioRequestId.current;
    setAzanPlaying(true);
    try {
      audio.currentTime = 0;
      await audio.play();
    } catch (error) {
      if (!mounted.current || requestId !== audioRequestId.current) return;
      setAzanPlaying(false);
      setAudioError(
        (error as Error)?.name === "NotAllowedError"
          ? "اضغط تجربة الأذان مرةً للسماح بتشغيل الصوت في هذا المتصفح."
          : "تعذر تشغيل هذا الأذان. جرّب صوتاً آخر."
      );
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void requestLocation();
    void requestNotifications();
    const refreshPermission = () => {
      if (typeof Notification !== "undefined") {
        setNotificationStatus(Notification.permission);
      }
    };
    window.addEventListener("focus", refreshPermission);
    return () => {
      mounted.current = false;
      locationRequestId.current += 1;
      window.removeEventListener("focus", refreshPermission);
    };
  }, [requestLocation, requestNotifications]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    azanAudio.current = audio;
    audio.onplaying = () => {
      if (!mounted.current || audio !== azanAudio.current || audio.paused || audio.error) return;
      setAzanPlaying(true);
      setAudioError(null);
    };
    audio.onpause = audio.onended = () => {
      if (mounted.current && audio === azanAudio.current && (audio.paused || audio.ended)) {
        setAzanPlaying(false);
      }
    };
    audio.onerror = () => {
      if (!mounted.current || audio !== azanAudio.current || !audio.error) return;
      audioRequestId.current += 1;
      setAzanPlaying(false);
      setAudioError("تعذر تحميل ملف الأذان. اختر صوتاً آخر.");
    };
    return () => {
      audioRequestId.current += 1;
      audio.onplaying = audio.onpause = audio.onended = audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      azanAudio.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = azanAudio.current;
    if (!audio) return;
    audioRequestId.current += 1;
    audio.pause();
    audio.src = selectedAzan;
    audio.load();
  }, [selectedAzan]);

  useEffect(() => {
    if (!location) return;
    const tableLocation = location;
    const controller = new AbortController();

    async function loadTimes() {
      try {
        const schedule = await fetchPrayerTimes(
          tableLocation,
          selectedDateKey,
          controller.signal
        );
        if (controller.signal.aborted || activeLocationKey.current !== locationKey) return;
        setPrayerTimes(schedule);
        setLoadState("ready");
        setTimezone(schedule.timezone);
        if (schedule.dateKey === getZonedClock(new Date(), schedule.timezone).dateKey) {
          todaySchedule.current = { locationKey, schedule };
        }
      } catch (error) {
        if (controller.signal.aborted || activeLocationKey.current !== locationKey) return;
        setLoadState("error");
        setLoadError(
          error instanceof Error && error.name === "Error"
            ? error.message
            : "تعذر الاتصال بخدمة المواقيت. تحقق من اتصالك ثم حاول مرة أخرى."
        );
      }
    }
    void loadTimes();
    return () => controller.abort();
  }, [location, locationKey, selectedDateKey, reloadKey]);

  // This schedule always belongs to today in the location's timezone.
  // Changing the calendar date only changes the table.
  useEffect(() => {
    if (!location || !timezone) return;
    const alertLocation = location;
    const alertTimezone = timezone;
    const controller = new AbortController();
    let checking = false;
    let updatingCountdown = false;
    let lastCheckedMinute: string | null = null;
    const pendingRequests = new Map<string, Promise<PrayerSchedule>>();
    const retryAfter = new Map<string, number>();

    async function loadSchedule(dateKey: string): Promise<PrayerSchedule | null> {
      const cached = [todaySchedule.current, tomorrowSchedule.current].find(
        (entry) =>
          entry?.locationKey === locationKey &&
          entry.schedule.timestamps &&
          entry.schedule.dateKey === dateKey &&
          entry.schedule.timezone === alertTimezone
      );
      if (cached) {
        if (dateKey === getZonedClock(new Date(), alertTimezone).dateKey) {
          todaySchedule.current = cached;
        }
        return cached.schedule;
      }
      if (Date.now() < (retryAfter.get(dateKey) ?? 0)) return null;

      let request = pendingRequests.get(dateKey);
      if (!request) {
        request = fetchPrayerTimes(alertLocation, dateKey, controller.signal);
        pendingRequests.set(dateKey, request);
      }
      try {
        const schedule = await request;
        if (controller.signal.aborted || activeLocationKey.current !== locationKey) return null;
        const entry = { locationKey, schedule };
        if (dateKey === getZonedClock(new Date(), alertTimezone).dateKey) {
          todaySchedule.current = entry;
        } else {
          tomorrowSchedule.current = entry;
        }
        return schedule;
      } catch (error) {
        // The one-second display must never retry failed API calls every second.
        retryAfter.set(dateKey, Date.now() + 60_000);
        throw error;
      } finally {
        pendingRequests.delete(dateKey);
      }
    }

    async function updateCountdown() {
      if (
        updatingCountdown ||
        controller.signal.aborted ||
        activeLocationKey.current !== locationKey
      ) return;
      updatingCountdown = true;
      try {
        let now = new Date();
        let localToday = getZonedClock(now, alertTimezone).dateKey;
        let schedule = await loadSchedule(localToday);
        if (!schedule) {
          if (!controller.signal.aborted && activeLocationKey.current === locationKey) {
            setCountdown(null);
          }
          return;
        }
        // A request may have crossed midnight; use the newly current date.
        now = new Date();
        const currentDate = getZonedClock(now, alertTimezone).dateKey;
        if (currentDate !== localToday) {
          localToday = currentDate;
          schedule = await loadSchedule(localToday);
          if (!schedule) return;
        }
        let target = getNextPrayer(schedule, Date.now());
        const tomorrow = format(addDays(parseISO(localToday), 1), "yyyy-MM-dd");
        if (target?.key === "Isha") {
          // Cache tomorrow while Isha is next so the Fajr countdown starts immediately.
          void loadSchedule(tomorrow).catch(() => {
            // loadSchedule limits retries; the current Isha countdown can continue.
          });
        }
        if (!target) {
          const nextDayCache = tomorrowSchedule.current;
          const waitingForTomorrow =
            !nextDayCache ||
            nextDayCache.locationKey !== locationKey ||
            nextDayCache.schedule.dateKey !== tomorrow ||
            nextDayCache.schedule.timezone !== alertTimezone ||
            !nextDayCache.schedule.timestamps;
          if (
            waitingForTomorrow &&
            !controller.signal.aborted &&
            activeLocationKey.current === locationKey
          ) {
            setCountdown(null);
          }
          const nextDay = await loadSchedule(tomorrow);
          if (!nextDay) {
            if (!controller.signal.aborted && activeLocationKey.current === locationKey) {
              setCountdownError("تعذر تحميل وقت الفجر القادم. سنحاول مجدداً تلقائياً.");
            }
            return;
          }
          target = getNextPrayer(nextDay, Date.now());
        }
        if (controller.signal.aborted || activeLocationKey.current !== locationKey) return;
        if (!target) {
          setCountdown(null);
          return;
        }
        const nowTimestamp = Date.now();
        setCountdown({
          ...target,
          remainingSeconds: Math.max(0, Math.ceil((target.timestamp - nowTimestamp) / 1000)),
          isTomorrow: target.dateKey !== getZonedClock(new Date(nowTimestamp), alertTimezone).dateKey,
        });
        setCountdownError(null);
      } catch {
        if (!controller.signal.aborted && activeLocationKey.current === locationKey) {
          setCountdown(null);
          setCountdownError("تعذر تحديث العدّ التنازلي. سنحاول مجدداً تلقائياً.");
        }
      } finally {
        updatingCountdown = false;
      }
    }

    async function checkPrayerMinute() {
      if (
        checking ||
        controller.signal.aborted ||
        activeLocationKey.current !== locationKey
      ) return;
      let now = getZonedClock(new Date(), alertTimezone);
      if (lastCheckedMinute === now.dateKey + "|" + now.time) return;
      checking = true;
      try {
        setClock(now);
        const schedule = await loadSchedule(now.dateKey);
        if (!schedule || controller.signal.aborted || activeLocationKey.current !== locationKey) return;
        // Recheck after a network request so a previous minute cannot fire.
        now = getZonedClock(new Date(), alertTimezone);
        setClock(now);
        setAlertError(null);
        if (schedule.dateKey !== now.dateKey) return;
        lastCheckedMinute = now.dateKey + "|" + now.time;

        for (const prayer of PRAYERS) {
          if (schedule.timings[prayer.key] !== now.time) continue;
          const key = [locationKey, now.dateKey, prayer.key, now.time].join("|");
          if (notifiedPrayers.current.has(key)) continue;
          notifiedPrayers.current.add(key);
          const message = "حان الآن موعد أذان " + prayer.label;
          setAnnouncement(message);

          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification(message, {
                tag: "sibha-prayer-" + key,
                lang: "ar",
                dir: "rtl",
                silent: true,
              });
            } catch {
              setNotificationError("تعذر عرض إشعار النظام في هذا المتصفح؛ يبقى تنبيه الصفحة متاحاً.");
            }
          }
          void playAzan();
        }
      } catch {
        if (!controller.signal.aborted && activeLocationKey.current === locationKey) {
          setAlertError("تعذر تحديث مواقيت اليوم للتنبيهات. سنحاول مجدداً تلقائياً.");
        }
      } finally {
        checking = false;
      }
    }

    const check = () => void checkPrayerMinute();
    const refresh = () => {
      check();
      void updateCountdown();
    };
    const initialCheck = window.setTimeout(refresh, 0);
    // Check each new minute on the shared second tick, rather than up to a
    // minute after the countdown reaches zero.
    const countdownTimer = window.setInterval(refresh, 1_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearTimeout(initialCheck);
      window.clearInterval(countdownTimer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [location, locationKey, timezone, playAzan]);

  function submitCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!city.trim() || !country.trim()) return;
    locationRequestId.current += 1;
    applyLocation({ type: "city", city: city.trim(), country: country.trim() });
    setGeoState("manual");
  }

  function changeDate(date: Date | undefined) {
    if (!date) return;
    setCalendarOpen(false);
    if (format(date, "yyyy-MM-dd") === selectedDateKey) return;
    setSelectedDate(date);
    setPrayerTimes(null);
    setLoadState("loading");
    setLoadError(null);
  }

  function retryTimes() {
    setPrayerTimes(null);
    setLoadState("loading");
    setLoadError(null);
    setReloadKey((key) => key + 1);
  }

  function chooseAzan(value: string | null) {
    const option = AZANS.find((azan) => azan.value === value);
    if (!option || option.value === selectedAzan) return;
    audioRequestId.current += 1;
    azanAudio.current?.pause();
    setAzanPlaying(false);
    setAudioError(null);
    setSelectedAzan(option.value);
  }

  function previewAzan() {
    setAudioError(null);
    if (azanPlaying) {
      audioRequestId.current += 1;
      azanAudio.current?.pause();
      setAzanPlaying(false);
    } else {
      void playAzan();
    }
  }

  return (
    <div className="font-arabic grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="flex min-w-0 flex-col gap-5" aria-label="الموقع ومواقيت الصلاة">
        <div className={cn(glassPanel, "flex flex-wrap items-center justify-between gap-4 p-5")}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
              {geoState === "locating" ? <Loader2 className="size-5 animate-spin" /> : <MapPin className="size-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-lg leading-loose font-bold">
                {location ? <bdi>{locationLabel}</bdi> : geoState === "locating" ? "جارٍ تحديد موقعك…" : "اختر موقع الصلاة"}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {timezone ? <span dir="ltr" className="font-sans text-xs">{timezone}</span> : "مواقيت دقيقة بحسب الموقع والتاريخ"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-10 border-gold/25 bg-background/50 px-3 text-base"
              disabled={geoState === "locating"}
              onClick={() => {
                setGeoState("locating");
                setLocationError(null);
                void requestLocation();
              }}
            >
              <LocateFixed />
              تحديد تلقائي
            </Button>
            <Button
              variant="ghost"
              className="h-10 px-3 text-base"
              onClick={() => setShowCityForm((open) => !open)}
            >
              تغيير الموقع
            </Button>
          </div>
        </div>

        {(showCityForm || (!location && geoState === "manual")) && (
          <form onSubmit={submitCity} className={cn(glassPanel, "flex flex-col gap-4 p-5 sm:p-6")}>
            <div>
              <h2 className="text-xl leading-loose font-bold">المدينة والدولة</h2>
              <p role="status" className="text-base leading-relaxed text-muted-foreground">
                {locationError ?? "أدخل اسم المدينة والدولة للحصول على المواقيت."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="prayer-city" className="text-base">المدينة</label>
                <Input
                  id="prayer-city"
                  name="city"
                  autoComplete="address-level2"
                  required
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="القاهرة"
                  className="h-11 border-gold/25 bg-background/60 text-base dark:bg-background/60"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="prayer-country" className="text-base">الدولة</label>
                <Input
                  id="prayer-country"
                  name="country"
                  autoComplete="country-name"
                  required
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  placeholder="مصر"
                  className="h-11 border-gold/25 bg-background/60 text-base dark:bg-background/60"
                />
              </div>
            </div>
            <Button type="submit" className="h-11 self-start px-5 text-base">عرض المواقيت</Button>
          </form>
        )}

        {location && (
          <div className={cn(glassPanel, "overflow-hidden p-5 sm:p-6")}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl leading-loose font-bold">مواقيت الصلاة</h2>
                {prayerTimes?.hijriDate && (
                  <p className="text-base text-gold">{prayerTimes.hijriDate}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger
                    render={<Button variant="outline" className="h-11 border-gold/25 bg-background/60 px-3 text-base dark:bg-background/60" />}
                  >
                    <CalendarDays />
                    {format(selectedDate, "PPP", { locale: ar })}
                  </PopoverTrigger>
                  <PopoverContent
                    dir="rtl"
                    align="start"
                    sideOffset={8}
                    className="w-auto border border-gold/25 bg-background/90 p-2 backdrop-blur-xl"
                  >
                    <Calendar
                      dir="rtl"
                      mode="single"
                      required
                      locale={ar}
                      numerals="arab"
                      selected={selectedDate}
                      defaultMonth={selectedDate}
                      onSelect={changeDate}
                      autoFocus
                      className="font-arabic bg-transparent"
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  className="h-11 text-base"
                  onClick={() => changeDate(clock ? parseISO(clock.dateKey) : new Date())}
                >
                  اليوم
                </Button>
              </div>
            </div>

            <Table aria-busy={loadState === "loading"} className="text-base">
              <TableCaption className="font-arabic pt-2 text-sm leading-loose">
                طريقة الحساب: الهيئة المصرية العامة للمساحة · المصدر{" "}
                <a href="https://aladhan.com" target="_blank" rel="noreferrer" className="text-gold underline underline-offset-4">Aladhan</a>
              </TableCaption>
              <TableHeader>
                <TableRow className="border-gold/20 hover:bg-transparent">
                  <TableHead scope="col" className="pb-3 text-right text-muted-foreground">الصلاة</TableHead>
                  <TableHead scope="col" className="pb-3 text-center text-muted-foreground">موعد الأذان</TableHead>
                  <TableHead scope="col" className="w-20 pb-3 text-left"><span className="sr-only">الحالة</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadState === "error" ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="py-8 whitespace-normal">
                      <div role="alert" className="flex flex-col items-center gap-3 text-center">
                        <AlertTriangle className="size-5 text-destructive" />
                        <p className="leading-loose text-destructive">{loadError}</p>
                        <Button variant="outline" onClick={retryTimes} className="h-10 text-base">
                          <RotateCcw /> إعادة المحاولة
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : PRAYERS.map((prayer) => {
                  const Icon = prayerIcons[prayer.key];
                  const upcoming = nextPrayer?.key === prayer.key;
                  const atPrayerTime = upcoming && prayerTimes?.timings[prayer.key] === clock?.time;
                  return (
                    <TableRow key={prayer.key} className={cn("border-gold/15", upcoming ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-background/40")}>
                      <TableCell className="py-5">
                        <span className="flex items-center gap-3 text-xl">
                          <Icon aria-hidden="true" className={cn("size-5 shrink-0", upcoming ? "text-primary" : "text-gold")} />
                          {prayer.label}
                        </span>
                      </TableCell>
                      <TableCell className="py-5 text-center">
                        {prayerTimes ? (
                          <span dir="ltr" lang="en" className={cn("font-sans text-xl font-medium tabular-nums sm:text-2xl", upcoming ? "text-primary" : "text-foreground")}>
                            {prayerTimes.timings[prayer.key]}
                          </span>
                        ) : <Skeleton className="mx-auto h-7 w-16 rounded-lg" />}
                      </TableCell>
                      <TableCell className="py-5 text-left">
                        {upcoming && <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-sm text-primary">{atPrayerTime ? "الآن" : "القادمة"}</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {loadState === "loading" && <p role="status" className="sr-only">جارٍ تحميل مواقيت الصلاة</p>}
          </div>
        )}
      </section>

      <aside className={cn(glassPanel, "flex flex-col gap-5 p-5 sm:p-6")} aria-label="إعدادات الأذان والتنبيهات">
        <div className="flex items-center gap-3">
          <Volume2 className="size-5 text-gold" />
          <h2 className="text-2xl leading-loose font-bold">الأذان والتنبيهات</h2>
        </div>
        <section
          aria-labelledby="prayer-countdown-title"
          className="flex flex-col gap-3 rounded-xl border border-gold/25 bg-background/50 p-4 backdrop-blur-md"
        >
          <h3 id="prayer-countdown-title" className="text-base text-muted-foreground">
            الوقت المتبقي للصلاة القادمة
          </h3>
          {countdown ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-2xl leading-loose font-bold text-primary">{countdown.label}</p>
                <p className="text-sm text-muted-foreground">
                  {countdown.isTomorrow && <span>غداً · </span>}
                  <span dir="ltr" className="font-sans tabular-nums">{countdown.time}</span>
                </p>
              </div>
              <div role="timer" aria-live="off">
                <dl dir="ltr" className="grid grid-cols-3 gap-2 text-center">
                  {countdownUnits.map((unit) => (
                    <div key={unit.label} className="flex flex-col gap-1 rounded-lg border border-gold/15 bg-card/50 px-1 py-3">
                      <dt dir="rtl" className="order-2 text-sm text-muted-foreground">{unit.label}</dt>
                      <dd className="order-1 font-sans text-3xl font-medium tabular-nums text-foreground">
                        {String(unit.value).padStart(2, "0")}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          ) : (
            <p role="status" className="text-base leading-loose text-muted-foreground">
              {countdownError ?? (location ? "جارٍ حساب الوقت المتبقي…" : "حدد موقعك لعرض العدّ التنازلي.")}
            </p>
          )}
        </section>
        <div className="flex flex-col gap-2">
          <label id="azan-label" htmlFor="azan-select" className="text-lg text-muted-foreground">اختر صوت الأذان</label>
          <Select value={selectedAzan} onValueChange={chooseAzan} items={AZANS}>
            <SelectTrigger
              id="azan-select"
              aria-labelledby="azan-label"
              className="w-full border-gold/25 bg-background/60 px-3 text-base data-[size=default]:h-11 dark:bg-background/60"
            >
              <SelectValue className="text-right" />
            </SelectTrigger>
            <SelectContent dir="rtl" align="start" alignItemWithTrigger={false} sideOffset={8} className="font-arabic border border-gold/25 bg-background/90 backdrop-blur-xl">
              {AZANS.map((azan) => <SelectItem key={azan.value} value={azan.value} className="min-h-11 py-2 text-base">{azan.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={previewAzan} className="mt-1 h-11 border-gold/25 bg-background/50 text-base">
            {azanPlaying ? <Pause /> : <Play />}
            {azanPlaying ? "إيقاف الأذان" : "تجربة الأذان"}
          </Button>
          <p className="text-sm leading-loose text-muted-foreground">جرّب الأذان مرةً للسماح بتشغيل الصوت في المتصفح.</p>
          {audioError && <p role="alert" className="text-sm leading-loose text-destructive">{audioError}</p>}
        </div>

        <div className="flex flex-col gap-3 border-t border-gold/20 pt-5">
          <h3 className="flex items-center gap-2 text-lg font-bold"><Bell className="size-4 text-gold" /> إشعارات الصلاة</h3>
          {notificationStatus === "granted" ? (
            <p className="flex items-center gap-2 text-base text-primary"><Check className="size-4" /> الإشعارات مفعّلة</p>
          ) : notificationStatus === "unsupported" ? (
            <p className="text-base leading-loose text-muted-foreground">هذا المتصفح لا يدعم إشعارات النظام. تنبيه الصفحة والصوت متاحان.</p>
          ) : notificationStatus === "denied" ? (
            <p className="text-base leading-loose text-muted-foreground">الإشعارات محظورة. اسمح بها من إعدادات الموقع في المتصفح.</p>
          ) : (
            <Button variant="outline" disabled={notificationStatus === "checking"} onClick={() => void requestNotifications()} className="h-11 border-gold/25 bg-background/50 text-base">
              <Bell /> {notificationStatus === "checking" ? "جارٍ طلب الإذن…" : "تفعيل الإشعارات"}
            </Button>
          )}
          {notificationError && <p role="status" className="text-sm leading-loose text-muted-foreground">{notificationError}</p>}
          <p className="text-sm leading-loose text-muted-foreground">تعمل التنبيهات والأذان أثناء بقاء هذه الصفحة مفتوحة، وفق توقيت موقع الصلاة.</p>
          {alertError && <p role="alert" className="text-sm leading-loose text-destructive">{alertError}</p>}
          {announcement && (
            <p role="status" aria-live="polite" className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-3 text-base leading-loose text-primary">{announcement}</p>
          )}
        </div>
      </aside>
    </div>
  );
}
