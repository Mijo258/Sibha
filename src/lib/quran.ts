/**
 * AlQuran.cloud text client and continuous Surah reciter sources.
 *
 * Endpoints used (all free, no key):
 *   GET /v1/surah                     → list of all 114 surahs
 *   GET /v1/surah/{n}                 → Arabic text of surah n
 */

const API_BASE = "https://api.alquran.cloud/v1";

export const RECITERS = [
  {
    value: "https://server11.mp3quran.net/alzain",
    label: "الشيخ الزين محمد أحمد",
    englishName: "Al-Zain Mohamed Ahmed",
  },
  {
    value: "https://server11.mp3quran.net/sds",
    label: "الشيخ عبد الرحمن السديس",
    englishName: "Abdul Rahman Al-Sudais",
  },
  {
    value: "https://server8.mp3quran.net/afs",
    label: "الشيخ مشاري العفاسي",
    englishName: "Mishary Rashid Alafasy",
  },
  {
    value: "https://download.quranicaudio.com/quran/ali_jaber",
    label: "الشيخ علي جابر",
    englishName: "Ali Jaber",
  },
] as const;

export type ReciterBaseUrl = (typeof RECITERS)[number]["value"];

export function isReciter(value: string): value is ReciterBaseUrl {
  return RECITERS.some((reciter) => reciter.value === value);
}

/** Both providers use three-digit filenames for complete Surah recordings. */
export function getSurahAudioUrl(
  reciter: ReciterBaseUrl,
  surahNumber: number
) {
  const paddedSurah = String(surahNumber).padStart(3, "0");

  return `${reciter}/${paddedSurah}.mp3`;
}

export type SurahMeta = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
};

export type Ayah = {
  number: number;
  numberInSurah: number;
  text: string;
  juz: number;
  page: number;
  sajda: boolean | { id: number; recommended: boolean; obligatory: boolean };
};

export type SurahDetail = SurahMeta & { ayahs: Ayah[] };

type Envelope<T> = { code: number; status: string; data: T };

async function request<T>(path: string, revalidate: number): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { next: { revalidate } });

  if (!res.ok) {
    throw new Error(`AlQuran.cloud ${path} failed: ${res.status}`);
  }

  const body = (await res.json()) as Envelope<T>;

  if (body.code !== 200 || !body.data) {
    throw new Error(`AlQuran.cloud ${path} returned code ${body.code}`);
  }

  return body.data;
}

/** The surah index is immutable — cache it for a day. */
export function getSurahList() {
  return request<SurahMeta[]>("/surah", 86_400);
}

export function getSurahText(number: number) {
  return request<SurahDetail>(`/surah/${number}`, 86_400);
}

/** Load and prepare the Arabic text independently of audio availability. */
export async function getSurah(number: number) {
  const text = await getSurahText(number);

  const ayahs = text.ayahs.map((ayah) => ({
    number: ayah.number,
    numberInSurah: ayah.numberInSurah,
    text: cleanAyahText(ayah.text),
    sajda: Boolean(ayah.sajda),
    page: ayah.page,
    juz: ayah.juz,
  }));

  // Every surah but Al-Fatiha (1) and At-Tawbah (9) carries the basmala as a
  // prefix on ayah 1. Lift it out so it renders as a heading instead of
  // being read as part of the first verse.
  const opensWithBasmala = number !== 1 && number !== 9;

  if (opensWithBasmala && ayahs[0]) {
    ayahs[0].text = stripBasmala(ayahs[0].text);
  }

  return {
    number: text.number,
    name: text.name,
    englishName: text.englishName,
    englishNameTranslation: text.englishNameTranslation,
    revelationType: text.revelationType,
    numberOfAyahs: text.numberOfAyahs,
    showBasmala: opensWithBasmala,
    ayahs,
  };
}

export type Surah = Awaited<ReturnType<typeof getSurah>>;
export type SurahAyah = Surah["ayahs"][number];

/** The API pads verses with newlines and an occasional BOM. */
function cleanAyahText(text: string) {
  return text.replace(/﻿/g, "").trim();
}

/**
 * Strips harakat, Qur'anic annotation marks and tatweel, then folds
 * alif/ya/ta-marbuta variants, so two spellings of the same word compare
 * equal across editions.
 *
 * Ranges are written as escapes and stop short of U+0660 so that
 * Arabic-Indic digits survive.
 */
function normalizeArabic(word: string) {
  return word
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
    .replace(/[آأإاٱ]/g, "ا")
    .replace(/[يیى]/g, "ي")
    .replace(/ة/g, "ه");
}

const BASMALA_WORDS = [
  "بسم", // bism
  "الله", // Allah
  "الرحمن", // ar-Rahman
  "الرحيم", // ar-Raheem
].map(normalizeArabic);

/**
 * Removes a leading "In the name of Allah…" from ayah 1.
 *
 * Compared word-by-word after normalisation rather than against a literal
 * string: editions disagree on diacritics and on which alif/ya codepoints
 * they use, so an exact match is not dependable. Returns the input unchanged
 * when the basmala is absent, or when it is the entire verse (Al-Fatiha).
 */
function stripBasmala(text: string) {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= BASMALA_WORDS.length) return text;

  const matches = BASMALA_WORDS.every(
    (expected, i) => normalizeArabic(words[i]) === expected
  );

  if (!matches) return text;

  return words.slice(BASMALA_WORDS.length).join(" ").trim() || text;
}

/** Rendered as its own heading line above ayah 1. */
export const BASMALA =
  "بِسمِ ٱللَّهِ ٱلرَّحمَٰنِ ٱلرَّحِيمِ";

/** Converts 42 → ٤٢ for verse markers. */
export function toArabicNumerals(n: number) {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
}
