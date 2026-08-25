import { NextResponse } from "next/server";

import { getSurah } from "@/lib/quran";

/**
 * GET /api/surah/[number]
 *
 * Proxies AlQuran.cloud so the browser makes one request instead of two, and
 * so the text/audio zip and basmala handling live in a single place. The
 * Qur'an does not change, so responses are cached for a day.
 */
export const revalidate = 86_400;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params;
  const surahNumber = Number(number);

  if (
    !Number.isInteger(surahNumber) ||
    surahNumber < 1 ||
    surahNumber > 114
  ) {
    return NextResponse.json(
      { error: "Surah number must be an integer between 1 and 114." },
      { status: 400 }
    );
  }

  try {
    const surah = await getSurah(surahNumber);

    return NextResponse.json(surah, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error(`Failed to load surah ${surahNumber}:`, error);

    return NextResponse.json(
      { error: "Could not reach the Qur'an service. Please try again." },
      { status: 502 }
    );
  }
}
