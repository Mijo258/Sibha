export type Dhikr = {
  id: string;
  arabic: string;
  transliteration: string;
  translation: string;
  /** Beads in one round. Completing a round is what the ring animates toward. */
  target: number;
  custom?: boolean;
};

/**
 * The tasbeeh recited after each salah (33 / 33 / 34) followed by the
 * adhkar most commonly counted on a misbaha.
 */
export const DEFAULT_DHIKR: Dhikr[] = [
  {
    id: "subhanallah",
    arabic: "سُبْحَانَ اللّٰه",
    transliteration: "Subhan Allah",
    translation: "Glory be to Allah",
    target: 33,
  },
  {
    id: "alhamdulillah",
    arabic: "اَلْحَمْدُ لِلّٰه",
    transliteration: "Alhamdulillah",
    translation: "All praise is due to Allah",
    target: 33,
  },
  {
    id: "allahu-akbar",
    arabic: "اَللّٰهُ أَكْبَر",
    transliteration: "Allahu Akbar",
    translation: "Allah is the Greatest",
    target: 34,
  },
  {
    id: "tahlil",
    arabic: "لَا إِلٰهَ إِلَّا اللّٰه",
    transliteration: "La ilaha illa Allah",
    translation: "There is no deity except Allah",
    target: 100,
  },
  {
    id: "istighfar",
    arabic: "أَسْتَغْفِرُ اللّٰه",
    transliteration: "Astaghfirullah",
    translation: "I seek forgiveness from Allah",
    target: 100,
  },
  {
    id: "hawla",
    arabic: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللّٰه",
    transliteration: "La hawla wa la quwwata illa billah",
    translation: "There is no might nor power except with Allah",
    target: 33,
  },
  {
    id: "tasbih-hamd",
    arabic: "سُبْحَانَ اللّٰهِ وَبِحَمْدِهِ",
    transliteration: "Subhan Allahi wa bihamdih",
    translation: "Glory be to Allah, and praise be to Him",
    target: 100,
  },
  {
    id: "salawat",
    arabic: "اَللّٰهُمَّ صَلِّ عَلٰى مُحَمَّد",
    transliteration: "Allahumma salli ala Muhammad",
    translation: "O Allah, send blessings upon Muhammad",
    target: 100,
  },
];

export const TARGET_PRESETS = [11, 33, 34, 99, 100, 1000];
