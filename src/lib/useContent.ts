import { useEffect, useState } from "react";

export type ContentItem = {
  videoId: string;
  url: string;
  title: string;
  thumbnail: string;
  live: boolean;
  viewers: number | null;
  /** "5 jam lalu", as the channel's own grid writes it. */
  age: string | null;
  /** Runtime of a finished video, e.g. "2.03.50". Null on a broadcast. */
  duration: string | null;
  /** Publishing channel, on the clips tab only. */
  channel?: string;
};

type ApiPayload = {
  fetchedAt: string;
  liveCount: number;
  sources: Record<"streams" | "videos" | "clips", boolean>;
  streams: ContentItem[];
  videos: ContentItem[];
  clips: ContentItem[];
};

type State = {
  streams: ContentItem[];
  videos: ContentItem[];
  clips: ContentItem[];
  /** True when at least one broadcast is confirmed live. */
  live: boolean;
  /** "api" once a response lands, "snapshot" while on the bundled copy. */
  source: "api" | "snapshot" | "loading";
  error: string | null;
};

/** When the snapshot's ages were measured, so the client can keep them honest. */
const SNAPSHOT_AT = "2026-10-08T10:20:00.000Z";

/**
 * Bundled copies of the three lists, taken 2026-10-08.
 *
 * The fallback for a static host with no serverless runtime, and for the window
 * before the fetch resolves. Ages are the channel's own labels from that moment,
 * stored as seconds so `formatAge` can advance them: a snapshot that keeps
 * saying "1 jam lalu" a week later would be lying, and this is the only part of
 * the page that can go stale with no server to refresh it.
 */
const SNAPSHOT_STREAMS: ContentItem[] = [
  { videoId: "UuDwJqqTky0", url: "https://www.youtube.com/watch?v=UuDwJqqTky0", title: "【 Genshin Impact 】 Lanjut archon quest", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "AlRKI3yDsmE", url: "https://www.youtube.com/watch?v=AlRKI3yDsmE", title: "【 Countdown 】 Sebelum tutup", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "BnhK9JocBak", url: "https://www.youtube.com/watch?v=BnhK9JocBak", title: "【 CHAT 】 Kalo beneran apocalypse siapa yang survive?", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "ZIBCgARyigU", url: "https://www.youtube.com/watch?v=ZIBCgARyigU", title: "【 Persona 5 Royal 】 Nyari palace 3? #12", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "qUWrSmIPFhI", url: "https://www.youtube.com/watch?v=qUWrSmIPFhI", title: "【 CHAT 】 Ada yang masih bangun", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "HRPN3CSniY0", url: "https://www.youtube.com/watch?v=HRPN3CSniY0", title: "【 The Walking Dead 】Kayaknya bad ending #3", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "vbzL83kb2Uc", url: "https://www.youtube.com/watch?v=vbzL83kb2Uc", title: "【 The Walking Dead 】Kemana arahnya ya #2", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "LS5p9ce7dC8", url: "https://www.youtube.com/watch?v=LS5p9ce7dC8", title: "【 Genshin Impact 】 Archon quest omg ronova", thumbnail: "", live: false, viewers: null, age: null, duration: null },
];

const SNAPSHOT_VIDEOS: ContentItem[] = [
  { videoId: "GITnRumUm5I", url: "https://www.youtube.com/watch?v=GITnRumUm5I", title: "Iklan baru Pingstar", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "oEhdTE0e2Ho", url: "https://www.youtube.com/watch?v=oEhdTE0e2Ho", title: "Sukidakara - Pingu &  ⁨@NagatsuAkiza (Cover)", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "4wD3BWIxOv4", url: "https://www.youtube.com/watch?v=4wD3BWIxOv4", title: "【 Debut PV 】 A Stray Star has come! Re-opening Cat Cafe! ᓚᘏᗢ", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "CxfK3LTepkE", url: "https://www.youtube.com/watch?v=CxfK3LTepkE", title: "【MV】My Kisah - Pingu", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "IqRK-gQtNEE", url: "https://www.youtube.com/watch?v=IqRK-gQtNEE", title: "【 ASMR 】Aflion Blue Sky Linear Switch - Typing Sound Only", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "-7xMN3WoGzo", url: "https://www.youtube.com/watch?v=-7xMN3WoGzo", title: "【 PLOG 】Gacoan dan yap", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "OxfN4aCabD8", url: "https://www.youtube.com/watch?v=OxfN4aCabD8", title: "【 BATSU 】 Arcade Date Bareng Penonton", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "zmYm3PGgTKU", url: "https://www.youtube.com/watch?v=zmYm3PGgTKU", title: "Iklan member pingstar", thumbnail: "", live: false, viewers: null, age: null, duration: null },
  { videoId: "JlhMkDCi7EM", url: "https://www.youtube.com/watch?v=JlhMkDCi7EM", title: "【 DEBUT TEASER 】Bintang Nyasar? Buka Cat Cafe?", thumbnail: "", live: false, viewers: null, age: null, duration: null },
];

const SNAPSHOT_CLIPS: ContentItem[] = [
  { videoId: "uDudNwwJ91Q", url: "https://www.youtube.com/watch?v=uDudNwwJ91Q", title: "Pingu Akhirnya Jujur Kalau Suka Sama Bang Al 🥰 [Pingu Ch.]", thumbnail: "", live: false, viewers: null, age: null, duration: null, channel: "Exile Syahputra" },
  { videoId: "tDL_1MLvjmM", url: "https://www.youtube.com/watch?v=tDL_1MLvjmM", title: "Pingu Mau Lakban Mulut Bang Al Karna Bocorin Hubungan Mereka 😂 [Pingu Ch. - Naplive]", thumbnail: "", live: false, viewers: null, age: null, duration: null, channel: "Exile Syahputra" },
];

/**
 * Ages as measured at capture time, in seconds.
 *
 * Read off the channel's own labels on the streams tab at SNAPSHOT_AT, not
 * calculated, so they match what a visitor would see on YouTube that day. Note
 * the `mgg` and `bln` abbreviations: YouTube writes weeks and months that way in
 * Indonesian, and the parser in api/content.ts carries the same units.
 */
const SNAPSHOT_AGES: Record<string, number> = {
  UuDwJqqTky0: 75600,
  AlRKI3yDsmE: 259200,
  BnhK9JocBak: 345600,
  ZIBCgARyigU: 432000,
  qUWrSmIPFhI: 518400,
  HRPN3CSniY0: 604800,
  vbzL83kb2Uc: 691200,
  LS5p9ce7dC8: 777600,
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

/**
 * Re-render a duration as the age label the card shows.
 *
 * Boundaries match YouTube's own grids closely enough to read the same: they drop
 * to days around a day, to weeks around a week, to months around a month. A value
 * under a minute reads as "beberapa detik", which is what YouTube says for that
 * window rather than the number zero.
 */
export function formatAge(ms: number): string {
  if (ms < MINUTE) return "beberapa detik lalu";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} menit lalu`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} jam lalu`;
  if (ms < WEEK) return `${Math.floor(ms / DAY)} hari lalu`;
  if (ms < MONTH) return `${Math.floor(ms / WEEK)} minggu lalu`;
  return `${Math.floor(ms / MONTH)} bulan lalu`;
}

/**
 * The age to render for one item, from whichever source supplied it.
 *
 * The API path needs no work: its label was read moments ago. The snapshot path
 * carries the measured duration, so the label advances on its own instead of
 * ageing in place.
 */
export function ageLabel(item: ContentItem): string | null {
  if (item.age) return item.age;

  const captured = SNAPSHOT_AGES[item.videoId];
  if (captured === undefined) return null;

  const elapsed = Date.now() - new Date(SNAPSHOT_AT).getTime();
  // A clock behind the capture would produce a negative age, which is worse than
  // showing nothing.
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;

  return formatAge(captured * SECOND + elapsed);
}

const INITIAL: State = {
  streams: [],
  videos: [],
  clips: [],
  live: false,
  source: "loading",
  error: null,
};

/**
 * All three content lists.
 *
 * `/api/content` supplies the fresh lists and the one thing a bundled snapshot
 * cannot know: whether a stream is running right now. Until it answers the cards
 * come from the snapshot, so no section is ever empty. If the endpoint is missing
 * or errors, the snapshot stays and the visitor sees a correct, slightly older
 * page with no error.
 */
/**
 * How often to re-read the feed.
 *
 * Short enough that a stream starting is noticed while someone is looking at the
 * page, long enough not to hammer a serverless function. The endpoint's own edge
 * cache is what this sits behind.
 */
const POLL_MS = 60_000;

export function useContent(): State {
  const [state, setState] = useState<State>(INITIAL);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failed = false;

    /*
     * Re-reads on a timer rather than once.
     *
     * A stream starts and ends while the page is open. Fetched once on mount, the
     * page would keep calling a finished broadcast live, or miss one that began
     * after it loaded, until the visitor reloaded by hand. The same reasoning the
     * endpoint caches for: a stale answer is worse here than a slightly late one,
     * because "live" is a claim about right now.
     *
     * Polling stops while the tab is hidden and resumes when it comes back, so a
     * tab left open in the background costs nothing.
     */
    async function load() {
      try {
        const res = await fetch("/api/content", {
          signal: controller.signal,
          // The edge holds this for minutes; without a bypass a poll would read
          // the same cached copy it just read.
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`api returned ${res.status}`);

        const payload = (await res.json()) as ApiPayload;
        if (!Array.isArray(payload.streams) || payload.streams.length === 0) {
          throw new Error("api returned no streams");
        }

        failed = false;
        setState({
          streams: payload.streams,
          videos: Array.isArray(payload.videos) ? payload.videos : [],
          clips: Array.isArray(payload.clips) ? payload.clips : [],
          live: payload.streams.some((item) => item.live),
          source: "api",
          error: null,
        });
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        failed = true;
        setState({
          streams: SNAPSHOT_STREAMS,
          videos: SNAPSHOT_VIDEOS,
          clips: SNAPSHOT_CLIPS,
          live: false,
          source: "snapshot",
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Give up rather than retry a broken endpoint forever.
      if (!failed && !controller.signal.aborted) timer = setTimeout(load, POLL_MS);
    }

    void load();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        void load();
      } else if (timer) {
        clearTimeout(timer);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer) clearTimeout(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return state;
}