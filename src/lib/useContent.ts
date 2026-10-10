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
  /**
   * Absolute publish instant behind `age`.
   *
   * The API path sends this so the label can be re-derived from it rather than
   * read verbatim. The string alone is a snapshot of one moment -- an edge cache
   * happily serves the same payload for an hour, and a card that prints the
   * cached string keeps claiming "6 jam lalu" long after the stream is nine hours
   * old. Measuring from an instant cannot go stale that way.
   */
  publishedAt?: string | null;
  /** Runtime of a finished video, e.g. "2.03.50". Null on a broadcast. */
  duration: string | null;
  /** Publishing channel, on the clips tab only. */
  channel?: string;
  /** Scheduled but not started. Separate from live: one is now, one is later. */
  upcoming?: boolean;
};

type ApiPayload = {
  fetchedAt: string;
  liveCount: number;
  sources: Record<"streams" | "videos" | "clips", boolean>;
  streams: ContentItem[];
  videos: ContentItem[];
  clips: ContentItem[];
  /** Scheduled broadcast, or null. See SNAPSHOT_UPCOMING. */
  upcoming?: ContentItem | null;
};

type State = {
  streams: ContentItem[];
  videos: ContentItem[];
  clips: ContentItem[];
  /** Scheduled but not started, when there is one. */
  upcoming: ContentItem | null;
  /** True when at least one broadcast is confirmed live. */
  live: boolean;
  /** "api" once a response lands, "snapshot" while on the bundled copy. */
  source: "api" | "snapshot" | "loading";
  error: string | null;
};

/** When the snapshot's ages were measured, so the client can keep them honest. */
const SNAPSHOT_AT = "2026-10-09T04:25:46.580Z";

/**
 * Bundled copies of the three lists, captured 2026-10-09
 * by calling the handler in-process and keeping exactly what it returned.
 *
 * The fallback for a static host with no serverless runtime, and for the window
 * before the fetch resolves. Ages are YouTube's own labels from that moment,
 * stored as seconds so `formatAge` can advance them: a snapshot that keeps saying
 * "1 jam lalu" tomorrow would be lying, and this is the only part of the page
 * that can go stale with no server to refresh it.
 *
 * The clip list had two entries while the endpoint returns twelve. That is not
 * visible while the endpoint works, and it becomes the entire page the moment it
 * does not -- /konten/clips renders whatever is in here, and here was two. It is
 * regenerated from the handler rather than typed, because typing titles is how it
 * drifted in the first place.
 */
const SNAPSHOT_STREAMS: ContentItem[] = [
  { videoId: "UuDwJqqTky0", url: "https://www.youtube.com/watch?v=UuDwJqqTky0", title: "【 Genshin Impact 】 Lanjut archon quest", thumbnail: "https://i.ytimg.com/vi/UuDwJqqTky0/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCiSIrs8YeAtfSP2gDXcGox40WvMw", live: false, viewers: null, age: null, duration: null },
  { videoId: "AlRKI3yDsmE", url: "https://www.youtube.com/watch?v=AlRKI3yDsmE", title: "【 Countdown 】 Sebelum tutup", thumbnail: "https://i.ytimg.com/vi/AlRKI3yDsmE/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBF5r-0b7_HyxPTsyqnOaO5jO2Azw", live: false, viewers: null, age: null, duration: null },
  { videoId: "BnhK9JocBak", url: "https://www.youtube.com/watch?v=BnhK9JocBak", title: "【 CHAT 】 Kalo beneran apocalypse siapa yang survive?", thumbnail: "https://i.ytimg.com/vi/BnhK9JocBak/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDcy3kq_XmcsRZerSi0TEQqz3y3Jg", live: false, viewers: null, age: null, duration: null },
  { videoId: "ZIBCgARyigU", url: "https://www.youtube.com/watch?v=ZIBCgARyigU", title: "【 Persona 5 Royal 】 Nyari palace 3? #12", thumbnail: "https://i.ytimg.com/vi/ZIBCgARyigU/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB7Hf3KMZpUB-GxgkTAEhRx6iy6ng", live: false, viewers: null, age: null, duration: null },
  { videoId: "qUWrSmIPFhI", url: "https://www.youtube.com/watch?v=qUWrSmIPFhI", title: "【 CHAT 】 Ada yang masih bangun", thumbnail: "https://i.ytimg.com/vi/qUWrSmIPFhI/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLA7BSsukGogW9mJvfBjhSQXpO5Xvg", live: false, viewers: null, age: null, duration: null },
  { videoId: "HRPN3CSniY0", url: "https://www.youtube.com/watch?v=HRPN3CSniY0", title: "【 The Walking Dead 】Kayaknya bad ending #3", thumbnail: "https://i.ytimg.com/vi/HRPN3CSniY0/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCqkHk918WbuePFlReuqgYKMfFGOw", live: false, viewers: null, age: null, duration: null },
  { videoId: "vbzL83kb2Uc", url: "https://www.youtube.com/watch?v=vbzL83kb2Uc", title: "【 The Walking Dead 】Kemana arahnya ya #2", thumbnail: "https://i.ytimg.com/vi/vbzL83kb2Uc/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLB2vtzTubAx5Th4sIS4_6Afl6AU-A", live: false, viewers: null, age: null, duration: null },
  { videoId: "LS5p9ce7dC8", url: "https://www.youtube.com/watch?v=LS5p9ce7dC8", title: "【 Genshin Impact 】 Archon quest omg ronova", thumbnail: "https://i.ytimg.com/vi/LS5p9ce7dC8/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAw1OBw-gn_jnleXn7zbq08xbajCg", live: false, viewers: null, age: null, duration: null },
];

const SNAPSHOT_VIDEOS: ContentItem[] = [
  { videoId: "GITnRumUm5I", url: "https://www.youtube.com/watch?v=GITnRumUm5I", title: "Iklan baru Pingstar", thumbnail: "https://i.ytimg.com/vi/GITnRumUm5I/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCIsBWcPnQB0aOYEa0o0J9ovWVqsg&usqp=CBQ", live: false, viewers: null, age: null, duration: null },
  { videoId: "oEhdTE0e2Ho", url: "https://www.youtube.com/watch?v=oEhdTE0e2Ho", title: "Sukidakara - Pingu &  ⁨@NagatsuAkiza (Cover)", thumbnail: "https://i.ytimg.com/vi/oEhdTE0e2Ho/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDARTShRk01WWibM1lbKUoC7g8gxw&usqp=CBQ", live: false, viewers: null, age: null, duration: null },
  { videoId: "4wD3BWIxOv4", url: "https://www.youtube.com/watch?v=4wD3BWIxOv4", title: "【 Debut PV 】 A Stray Star has come! Re-opening Cat Cafe! ᓚᘏᗢ", thumbnail: "https://i.ytimg.com/vi/4wD3BWIxOv4/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCWcOIA7pKnUl7gzO5Yf1Lmk57GaA&usqp=CBQ", live: false, viewers: null, age: null, duration: null },
  { videoId: "CxfK3LTepkE", url: "https://www.youtube.com/watch?v=CxfK3LTepkE", title: "【MV】My Kisah - Pingu", thumbnail: "https://i.ytimg.com/vi/CxfK3LTepkE/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAQtt45MpdCK7m28XJu-SByVc_DVQ&usqp=CBQ", live: false, viewers: null, age: null, duration: null },
  { videoId: "IqRK-gQtNEE", url: "https://www.youtube.com/watch?v=IqRK-gQtNEE", title: "【 ASMR 】Aflion Blue Sky Linear Switch - Typing Sound Only", thumbnail: "https://i.ytimg.com/vi/IqRK-gQtNEE/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCqU1xGUgqbyfJ-TVzAuqsYAkuswA&usqp=CBQ", live: false, viewers: null, age: null, duration: null },
  { videoId: "-7xMN3WoGzo", url: "https://www.youtube.com/watch?v=-7xMN3WoGzo", title: "【 PLOG 】Gacoan dan yap", thumbnail: "https://i.ytimg.com/vi/-7xMN3WoGzo/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDW7fHqHng2z_PKEV3GFhyXSguXXw&usqp=CBQ", live: false, viewers: null, age: null, duration: null },
  { videoId: "OxfN4aCabD8", url: "https://www.youtube.com/watch?v=OxfN4aCabD8", title: "【 BATSU 】 Arcade Date Bareng Penonton", thumbnail: "https://i.ytimg.com/vi/OxfN4aCabD8/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAveG47yaZ8s2LbBr18m0o_ucC5bw&usqp=CBQ", live: false, viewers: null, age: null, duration: null },
  { videoId: "zmYm3PGgTKU", url: "https://www.youtube.com/watch?v=zmYm3PGgTKU", title: "Iklan member pingstar", thumbnail: "https://i.ytimg.com/vi/zmYm3PGgTKU/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAypXFBRPjSN3208r75rCVBO__Kjw&usqp=CBQ", live: false, viewers: null, age: null, duration: null },
  { videoId: "JlhMkDCi7EM", url: "https://www.youtube.com/watch?v=JlhMkDCi7EM", title: "【 DEBUT TEASER 】Bintang Nyasar? Buka Cat Cafe?", thumbnail: "https://i.ytimg.com/vi/JlhMkDCi7EM/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDYMqIR3pZSqcIWaTAjLb8I65MSNw&usqp=CBQ", live: false, viewers: null, age: null, duration: null },
];

/**
 * Clips, from the ten search queries, plus the committed seed in api/clip-seed.ts.
 *
 * These are other people's channels, mostly Exile Syahputra's, and many name the
 * recurring co-star. That is what a clip wall is: an index of where she was
 * clipped, linking back to the original, not a gallery of her own uploads.
 */
const SNAPSHOT_CLIPS: ContentItem[] = [
  { videoId: "Qjr-RL28kik", url: "https://www.youtube.com/watch?v=Qjr-RL28kik", title: "Jadi Pingu Dan Bang al Itu Udah Serumah Dan Sekamar? 😱 [Pingu Ch.]", thumbnail: "https://i.ytimg.com/vi/Qjr-RL28kik/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLBJiYCdwrkNOVoxkLH8RIooqHvRDg", live: false, viewers: null, age: null, duration: "1.49", channel: "Exile Syahputra" },
  { videoId: "4BzqltBdxXo", url: "https://www.youtube.com/watch?v=4BzqltBdxXo", title: "Bang AL mampir ke stream skin baru @pinguvtuber", thumbnail: "https://i.ytimg.com/vi/4BzqltBdxXo/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLCZb7YJyuXcy-1Zi5RYNS8tBQRTDg", live: false, viewers: null, age: null, duration: "3.30", channel: "Vendouw 07 Ch." },
  { videoId: "NR6DyrvTnyc", url: "https://www.youtube.com/watch?v=NR6DyrvTnyc", title: "VTUBER PALING TSUNDERE! ADA LAWAN?? || @pinguvtuber 【VTUBER CORNER】", thumbnail: "https://i.ytimg.com/vi/NR6DyrvTnyc/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAsAoTAH_DdkexZefggzQOfH8rXmw", live: false, viewers: null, age: null, duration: "34.16", channel: "Vtuber Graphic" },
  { videoId: "5EB5g36Jkzs", url: "https://www.youtube.com/watch?v=5EB5g36Jkzs", title: "Aduh Bang Al Kenapa Bocor Gitu Kasian Pingu Isi Hatinya Ikut Bocor 😂 [Pingu Ch.]", thumbnail: "https://i.ytimg.com/vi/5EB5g36Jkzs/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAyzTJNbxhrfs9ICjmsrn-2ZZ3fcQ", live: false, viewers: null, age: null, duration: "1.23", channel: "Exile Syahputra" },
  { videoId: "NSJ_4zlpuLw", url: "https://www.youtube.com/watch?v=NSJ_4zlpuLw", title: "Kenapa Sih Kalau Soal Bang Al Pingu Harus Tsundere Gitu Guys? 🤔 [Pingu Ch.]", thumbnail: "", live: false, viewers: null, age: null, duration: "1.28", channel: "Exile Syahputra" },
  { videoId: "uDudNwwJ91Q", url: "https://www.youtube.com/watch?v=uDudNwwJ91Q", title: "Pingu Akhirnya Jujur Kalau Suka Sama Bang Al 🥰 [Pingu Ch.]", thumbnail: "https://i.ytimg.com/vi/uDudNwwJ91Q/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLC2bUVFyEVB6cIJlnFXUOutZ8wg6Q", live: false, viewers: null, age: null, duration: "1.16", channel: "Exile Syahputra" },
  { videoId: "wfSokIrqMUg", url: "https://www.youtube.com/watch?v=wfSokIrqMUg", title: "Pingu Dan Bang Al Pegangan Tangan Ketika Ngedate? 😮 [Pingu Ch.]", thumbnail: "https://i.ytimg.com/vi/wfSokIrqMUg/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBqLzl_8DDgjaxq3LBhjg6gQg4KgB&rs=AOn4CLCnN3X4vf8dwMKoS_UC4lEySl7pwQ&usqp=CBU", live: false, viewers: null, age: null, duration: "1.14", channel: "Exile Syahputra" },
  { videoId: "Dv8uYPlYQk0", url: "https://www.youtube.com/watch?v=Dv8uYPlYQk0", title: "Pingu Menjadi Obat Dan Prioritas Ketika Bang Al Sedang Sakit 🥰 [Pingu Ch.]", thumbnail: "https://i.ytimg.com/vi/Dv8uYPlYQk0/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLDEj6IBk2wkNk_H5SWLlvbyT-mE5A", live: false, viewers: null, age: null, duration: "1.27", channel: "Exile Syahputra" },
  { videoId: "8YDi5kFKVfA", url: "https://www.youtube.com/watch?v=8YDi5kFKVfA", title: "Pingu Dan Bang Al Romantis Banget Dari Pegangan Tangan Sampai Tidur Bareng! 😳 [Naplive - Pingu Ch.]", thumbnail: "", live: false, viewers: null, age: null, duration: "2.21", channel: "Exile Syahputra" },
  { videoId: "vh5CFxVarL4", url: "https://www.youtube.com/watch?v=vh5CFxVarL4", title: "Istri Bang Al Ini Akhirnya Buka Suara Untuk Klarifikasi! [Pingu Ch.]", thumbnail: "https://i.ytimg.com/vi/vh5CFxVarL4/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBqLzl_8DDgizy7PKBhjg6gQg4KgB&rs=AOn4CLCW_k0iQURjXCXdmGA0V3sLSeUtCw&usqp=CBU", live: false, viewers: null, age: null, duration: "2.02", channel: "Exile Syahputra" },
  { videoId: "tDL_1MLvjmM", url: "https://www.youtube.com/watch?v=tDL_1MLvjmM", title: "Pingu Mau Lakban Mulut Bang Al Karna Bocorin Hubungan Mereka 😂 [Pingu Ch. - Naplive]", thumbnail: "https://i.ytimg.com/vi/tDL_1MLvjmM/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLAWV2bTk6EyUy-Xn4fXwLsjboAcow", live: false, viewers: null, age: null, duration: "1.35", channel: "Exile Syahputra" },
  { videoId: "QuEg7DYT9JI", url: "https://www.youtube.com/watch?v=QuEg7DYT9JI", title: "Pingu salting ketika tau Bang Al reaction lagunya dan nyanyi bareng 👉👈 [ Pingu Ch. Clip ]", thumbnail: "https://i.ytimg.com/vi/QuEg7DYT9JI/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBqLzl_8DDgi3l_jIBhjg6gQg4KgB&rs=AOn4CLDROp5TvyjS3kWAjITUwSUnA8au1g&usqp=CBU", live: false, viewers: null, age: null, duration: "5.37", channel: "DweenClip" },
];

/**
 * Ages as measured at capture time, in seconds, snapped to whole days.
 *
 * Read off the channel's own labels rather than calculated from anything else, so
 * they match what a visitor would see on YouTube that day. Note the `mgg` and
 * `bln` abbreviations in the source labels: YouTube writes weeks and months that
 * way in Indonesian, and the parser in api/content.ts carries the same units.
 */
const SNAPSHOT_AGES: Record<string, number> = {
  "UuDwJqqTky0": 86400,
  "AlRKI3yDsmE": 345600,
  "BnhK9JocBak": 432000,
  "ZIBCgARyigU": 518400,
  "qUWrSmIPFhI": 604800,
  "HRPN3CSniY0": 691200,
  "vbzL83kb2Uc": 777600,
  "LS5p9ce7dC8": 864000,
  "GITnRumUm5I": 2592000,
  "oEhdTE0e2Ho": 5184000,
  "4wD3BWIxOv4": 5184000,
  "CxfK3LTepkE": 25920000,
  "Qjr-RL28kik": 259200,
  "4BzqltBdxXo": 2592000,
  "NR6DyrvTnyc": 10368000,
  "5EB5g36Jkzs": 10368000,
  "NSJ_4zlpuLw": 12960000,
  "uDudNwwJ91Q": 20736000,
  "wfSokIrqMUg": 20736000,
  "Dv8uYPlYQk0": 20736000,
  "8YDi5kFKVfA": 20736000,
  "vh5CFxVarL4": 23328000,
  "tDL_1MLvjmM": 25920000,
  "QuEg7DYT9JI": 25920000,
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
/**
 * A year, at 365 days rather than 365.25.
 *
 * The same figure api/content.ts uses for `tahun`, so a label the API is able to
 * produce is one this can render. The labels are coarse either way -- "1 tahun
 * lalu" on YouTube covers anything from 12 to 24 months -- so the extra precision
 * would be precision the source does not have.
 */
const YEAR = 365 * DAY;

/**
 * Re-render a duration as the age label the card shows.
 *
 * Boundaries match YouTube's own grids closely enough to read the same: they drop
 * to days around a day, to weeks around a week, to months around a month, and to
 * years around a year. A value under a minute reads as "beberapa detik", which is
 * what YouTube says for that window rather than the number zero.
 *
 * The year tier exists because two of the endpoints can return "tahun" and this
 * could not say it: an eleven-year-old clip came out as "133 bulan lalu", which is
 * a true number and a meaningless one. Every bundled snapshot also holds entries
 * older than a year, so the same label appeared on those without any API involved.
 */
export function formatAge(ms: number): string {
  if (ms < MINUTE) return "beberapa detik lalu";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} menit lalu`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} jam lalu`;
  if (ms < WEEK) return `${Math.floor(ms / DAY)} hari lalu`;
  if (ms < MONTH) return `${Math.floor(ms / WEEK)} minggu lalu`;
  if (ms < YEAR) return `${Math.floor(ms / MONTH)} bulan lalu`;
  return `${Math.floor(ms / YEAR)} tahun lalu`;
}

/**
 * The age to render for one item, from whichever source supplied it.
 *
 * The API path is measured, not quoted. `publishedAt` is a wall-clock instant, so
 * the label is re-derived from it every render and stays correct however long the
 * payload sat in a cache. The `age` string is kept only as a fallback for a
 * response that predates the field.
 *
 * The snapshot path carries the measured duration instead, so its label advances
 * the same way -- a copy that keeps saying "1 jam lalu" a week later would be
 * lying, and caching is the only part of this page that can go stale with no
 * server to refresh it.
 */
export function ageLabel(item: ContentItem): string | null {
  if (item.publishedAt) {
    const elapsed = Date.now() - new Date(item.publishedAt).getTime();
    if (Number.isFinite(elapsed) && elapsed >= 0) return formatAge(elapsed);
  }

  if (item.age) return item.age;

  const captured = SNAPSHOT_AGES[item.videoId];
  if (captured === undefined) return null;

  const elapsed = Date.now() - new Date(SNAPSHOT_AT).getTime();
  // A clock behind the capture would produce a negative age, which is worse than
  // showing nothing.
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;

  return formatAge(captured * SECOND + elapsed);
}

/** The API's list when it has one, otherwise the previous one, otherwise none. */
function pick(fresh: unknown, fallback: ContentItem[]): ContentItem[] {
  return Array.isArray(fresh) && fresh.length > 0 ? fresh : fallback;
}

const INITIAL: State = {
  streams: [],
  videos: [],
  clips: [],
  // Null until the endpoint answers, and deliberately not a bundled copy. Every
  // other list falls back to the snapshot because a slightly old upload is still
  // true; a scheduled stream is a claim about a future that can be cancelled, so
  // the card waits for the endpoint rather than ageing in place.
  upcoming: null,
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
        setState((prev) => ({
          streams: payload.streams,
          /*
           * A tab that comes back empty keeps whatever the last good response had.
           *
           * The endpoint already carries a previous list forward rather than
           * serving a hole, but a tab can still read empty on the very first
           * response after a deploy. Falling back to the snapshot there means the
           * page shows a slightly older list instead of an empty grid, which is
           * the difference between "this is what she uploaded in October" and
           * "there is nothing here", and only the first one is true.
           */
          videos: pick(payload.videos, prev.videos.length ? prev.videos : SNAPSHOT_VIDEOS),
          clips: pick(payload.clips, prev.clips.length ? prev.clips : SNAPSHOT_CLIPS),

          // The endpoint decides whether anything is scheduled, so its answer
          // replaces the bundled copy outright rather than falling back -- a
          // stale "upcoming" card is a claim about the future, and the one thing
          // in this payload that must never outlive its truth.
          upcoming: payload.upcoming ?? null,
          live: payload.streams.some((item) => item.live),
          source: "api",
          error: null,
        }));
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        failed = true;
        setState({
streams: SNAPSHOT_STREAMS,
        videos: SNAPSHOT_VIDEOS,
        clips: SNAPSHOT_CLIPS,
        // No snapshot copy on this path. Every other list falls back because a
        // slightly old upload is still true; a scheduled stream is a claim about
        // a future that may have been cancelled, so the fallback drops the card
        // rather than keep it.
        upcoming: null,
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