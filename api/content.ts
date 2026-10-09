/**
 * GET /api/content
 *
 * Serves three lists from the channel plus the search index, read fresh on every
 * cold request:
 *
 *   streams  the /streams tab, newest broadcast first
 *   videos   the /videos tab, newest upload first, broadcasts excluded
 *   clips    videos from other channels whose title or description names her
 *
 * Why these three sources and not the obvious ones:
 *
 * 1. The absolute broadcast start is `liveBroadcastDetails.startTimestamp` on
 *    the watch page, and it is the only honest source for it. The RSS
 *    `published` field is not: that is when the archive went up, which runs 2 to
 *    13 hours after the broadcast began and can land on a different calendar
 *    day. Measured on four videos: 2.3h, 4.2h, 7.1h and 13.5h late.
 *
 * 2. The watch page cannot be read from a serverless IP. YouTube answers with
 *    HTTP 200 and 1.27 MB of page, but `liveBroadcastDetails` is absent and the
 *    document trips bot detection. Verified across three hosts and six
 *    strategies, all failing the same way:
 *
 *      | target                          | result                              |
 *      |---------------------------------|-------------------------------------|
 *      | watch page, Vercel              | 200, no liveBroadcastDetails        |
 *      | watch page, Cloudflare Worker   | 200, no liveBroadcastDetails        |
 *      | InnerTube WEB                   | LOGIN_REQUIRED, "confirm not a bot" |
 *      | InnerTube TVHTML5               | LOGIN_REQUIRED, same                |
 *      | InnerTube ANDROID / IOS         | HTTP 400                            |
 *      | tab /streams, Vercel            | 200, parses fine                    |
 *
 *    So no card claims a start time. Ages come from YouTube's own labels, which
 *    the /streams and search pages both carry.
 *
 * 3. The three tabs read three different surfaces because none of them carries
 *    the others' content. The /streams tab lists broadcasts and nothing else,
 *    the /videos tab lists uploads and nothing else, and neither mentions a
 *    clipper. Only the search results page mixes all three, which is what makes
 *    it the right place to look for clips.
 *
 * Ten searches are read for the clips rather than one, because a single query is
 * not a measure of how many clips exist. YouTube ranks by relevance to the
 * phrasing it was given, so one query mostly returns whichever slice of the web
 * matches those words: "pingu vtuber" alone came back with 19 results of which 2
 * were clips, the rest being her own channel and a handful of unrelated videos.
 *
 * Six queries was still not enough, which is the harder finding: measured over
 * three passes, a single pass with six queries surfaced 8, 9 and 7 of the
 * nineteen clips any pass could find, and never all of them. So a cold response
 * could be missing the newest clip on the page. Ten queries brings a pass to
 * 15, 13 and 14 of nineteen. See SEARCH_QUERIES.
 *
 * The clips filter is deliberately narrow: another channel's video counts only
 * when her name is in the title or the description snippet. A search for a common
 * given name returns plenty of unrelated videos, so this leans on the word
 * boundary — measured, not assumed: a bare substring test pulled a Fisher-Price
 * toy video titled "Family Time with Pingu" into the clip wall, because Pingu is
 * also a children's cartoon and a Penguin-of-Africa brand.
 *
 * It is still a best effort rather than an exact match. A toy video carrying
 * only the brand name in its title would still slip through, which is why the
 * page presents the clip wall as best effort instead of claiming completeness.
 * Her own uploads are excluded, since those are already in the other two tabs.
 */

/*
 * The extension is required, not optional.
 *
 * package.json sets "type": "module", so the api/ files are native ESM on Vercel,
 * and native ESM does not do the extensionless resolution that TypeScript,
 * bundlers and most local runners do. Written as "./clip-seed" this import was
 * unresolvable at runtime: the module threw while loading, before the handler was
 * ever called, and the endpoint answered 500 with an empty body in ~450ms having
 * attempted no fetch. No fetch means no LastGood snapshot and no retry could
 * rescue it either, and /konten/clips fell through to its two-entry snapshot.
 *
 * Nothing local caught it. `tsc -b` accepts the bare specifier --
 * moduleResolution "bundler" resolves it, and allowImportingTsExtensions makes
 * the .ts form legal at the same time. eslint has no rule for it without the
 * import plugin. And a local runner that appends .ts to relative specifiers
 * resolves it happily, which is exactly what the first harness for this bug did.
 * scripts/check-api-imports.mjs exists for the same reason; run `npm run check:api`.
 */
import SEED_CLIPS from "./clip-seed.ts";

interface UploadsRequest {
  method?: string;
  url?: string;
}

interface UploadsResponse {
  status(code: number): UploadsResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

const HANDLE = "@pinguvtuber";

/**
 * Her channel title, and the prefix that identifies her own uploads.
 *
 * The full title with the period, not "Pingu". "Pingu" also matches "Pingu -
 * Official Channel", the children's cartoon, which is a different channel
 * entirely: measured, 12 of its videos came back from these searches and every
 * one was being dropped as her own upload without ever being read.
 */
const CHANNEL_TITLE_PREFIX = "Pingu Ch.";

/** Newest first. Without sort=dd these tabs are ordered by popularity. */
const STREAMS_TAB = `https://www.youtube.com/${HANDLE}/streams?view=0&sort=dd&flow=grid&hl=id&gl=ID`;
const VIDEOS_TAB = `https://www.youtube.com/${HANDLE}/videos?view=0&sort=dd&flow=grid&hl=id&gl=ID`;

/**
 * Six searches instead of one, because one is not enough.
 *
 * YouTube search is relevance-ranked off a single query, so it surfaces whichever
 * slice of the web it thinks matches that phrasing -- and which slice that is
 * changes between requests. Measured over three passes against the nineteen
 * clips that any pass could find:
 *
 *   query set       pass 1   pass 2   pass 3   union
 *   6 queries         8/19     9/19     7/19     11/19
 *   10 queries       15/19    13/19    14/19     19/19
 *
 * Six queries never saw eight of the nineteen, in any pass, which is why the
 * newest clip on the page could be missing from a cold response. The extra four
 * reach the clip channels by name rather than by the word: "pingu ch. clip" and
 * "pingu ch. naplive" pull captions that use her title with the period, and
 * "pingu bang al" is the recurring co-star in most of these clips.
 *
 * "pingu vtuber" alone returns the cartoon constantly, which is what a single
 * query was mostly surfacing. "pingu ch" finds the clip channels, "pinguvtuber"
 * finds the ones that tagged her handle, and the rest widen it. They overlap
 * heavily, so the union is deduplicated by video id.
 */
const SEARCH_QUERIES = [
  "pingu vtuber",
  "pingu ch",
  "pinguvtuber",
  "pingu clip",
  "pingu naplive",
  "pingu vtuber clip",
  "pingu ch. clip",
  "pingu clip naplive",
  "pingu bang al",
  "pingu ch. naplive",
];

function searchPage(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    query,
  )}&hl=id&gl=ID`;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const STREAM_LIMIT = 8;
const VIDEO_LIMIT = 12;
const CLIP_LIMIT = 12;
const TIMEOUT_MS = 15000;

/**
 * Ceiling on one handler call, and the per-request timeout is whatever is left.
 *
 * Vercel kills a function that outlives its budget, and the failure reads as
 * FUNCTION_INVOCATION_FAILED with no body -- which is what happened once the clip
 * route went to ten searches: ten parallel requests, each 15 s with a retry after
 * it, is 30 seconds of possible wall time against a ten-second budget. Ten tabs
 * empty on every cold request and no way to see why.
 *
 * So the deadline is explicit and shared. Every fetch inside one call takes a
 * slice of what remains, the retry only happens if there is time left for it, and
 * the call always returns an answer inside the budget -- fewer clips if that is
 * what the time allowed, which is the same trade api/content.ts already makes
 * when one tab fails.
 */
const HANDLER_DEADLINE_MS = 8500;

/** Milliseconds left before the deadline, or 0 once it has passed. */
function remaining(deadline: number): number {
  return Math.max(0, deadline - Date.now());
}

const LIVE_BADGE = /LIVE_NOW|BADGE_STYLE_LIVE|"LIVE"/;

/**
 * Viewer count on a running stream, e.g. "15 sedangonton".
 *
 * Both "menonton" and "watching" appear in the Indonesian locale: the grid uses
 * "sedang Watching" while the localized string is "sedang menonton", and both
 * show up for the same channel. The optional "sedang" keeps one pattern
 * covering both. A view-count row like "1,1 rb" has no keyword and cannot match.
 */
const VIEWERS = /([\d.,]+)\s*(?:rb|ribu)?\s+(?:sedang\s+)?(?:menonton|watching)/i;

/** A running broadcast, on any tab: "Streaming 2 jam lalu" in the age row. */
const STREAMING_LABEL = /streaming/i;

/**
 * The relative age, as the grids write it.
 *
 * Indonesian abbreviates inconsistently: the same grid mixes "1 jam lalu" with
 * "1 h lalu" two cards apart, and uses "bln", "thn" and "mgg" elsewhere. All are
 * matched, and the unit is normalised on the way out so a card never reads
 * "1 h lalu" next to "2 jam lalu".
 */
const AGE =
  /(?:streaming\s*)?(?:berakhir\s*)?(?:·\s*)?(beberapa\s+detik|\d+\s*(?:detik|dtk|menit|mnt|jam|h|hari|hr|d|minggu|mgg|pekan|wk|bulan|bln|tahun|thn)?)\s*(?:yang\s+lalu|lalu)/i;

/**
 * Unit normalisation, for the channel grids.
 *
 * "h" is hari here, not jam. The grids write jam out in full ("1 jam lalu", "18
 * jam lalu") and abbreviate hari to a bare "h", which reads like an English hour
 * abbreviation and is the single easiest thing to get backwards. Caught by
 * checking labels against each video's measured endTimestamp: "5 h lalu" was five
 * days old, not five hours.
 *
 * Single-letter "m" is left out on purpose: it could be menit or bulan, and
 * guessing between those two is not a trade worth making, so an unmapped unit
 * falls through to the raw label rather than becoming a wrong number.
 */
const AGE_UNITS: Record<string, string> = {
  detik: "detik",
  dtk: "detik",
  menit: "menit",
  mnt: "menit",
  jam: "jam",
  h: "hari",
  hari: "hari",
  hr: "hari",
  d: "hari",
  minggu: "minggu",
  mgg: "minggu",
  pekan: "minggu",
  wk: "minggu",
  bulan: "bulan",
  bln: "bulan",
  tahun: "tahun",
  thn: "tahun",
};

/**
 * Normalise one age label, e.g. "1 h lalu" into "1 hari lalu".
 *
 * "h" is hari on every surface. Checked against the video's own publishDate: the
 * newest clip carried "3 h lalu" and its publishDate is 85 hours earlier, which is
 * 3.5 days, so the label rounds the day and means three days. Reading that "h" as
 * hours would put a three-day-old clip in the same bucket as one from last month.
 * The grids spell out jam ("1 jam lalu") and abbreviate hari to a bare "h".
 *
 * Returns null when the unit is not one this file is willing to map, so the card
 * shows nothing rather than something that could be read as a different amount of
 * time than YouTube meant.
 */
function parseAge(text: string): string | null {
  const match = text.match(AGE);
  if (!match) return null;

  const raw = match[1].replace(/\s+/g, " ").trim();
  if (/beberapa/i.test(raw)) return "beberapa detik lalu";

  const parts = raw.match(/^(\d+)\s*(.*)$/);
  if (!parts) return null;

  const unit = AGE_UNITS[(parts[2] || "jam").toLowerCase()];
  if (!unit) return null;

  return `${parts[1]} ${unit} lalu`;
}

/**
 * Strip an age label down to a number of seconds, or null if it has no digits.
 *
 * `tahun` is in the table and was missing, which meant every clip older than a
 * year came back null and sorted to the end of the wall: the deployment served
 * "2 tahun lalu" above "1 tahun lalu" because the older one had no sortable age
 * at all. 365 days, not 365.25 -- the labels themselves are coarse ("1 tahun
 * lalu" covers anywhere from 12 to 24 months), so a more precise figure would be
 * precision the source does not have.
 */
function ageToSeconds(label: string | null): number | null {
  if (!label) return null;

  const parts = label.match(/^(\d+)\s+(\w+)\s+lalu$/);
  if (!parts) return null;

  const value = Number(parts[1]);
  const seconds: Record<string, number> = {
    detik: 1,
    menit: 60,
    jam: 3600,
    hari: 86400,
    minggu: 604800,
    bulan: 2592000,
    tahun: 31536000,
  };

  const unit = seconds[parts[2]];
  if (!unit || !Number.isFinite(value)) return null;

  return value * unit;
}

/** The 🔴 prefix is the channel's own live marker; the UI renders its own badge. */
function stripLiveMarker(title: string): string {
  return title.replace(/^🔴\s*/, "").trim();
}

/**
 * One GET, with a single retry if there is time for it.
 *
 * The retry is here because these pages fail one at a time, not all at once, and
 * a lone empty tab is the failure mode that hurts most: the deployment came up
 * serving streams=8, clips=7, videos=0 for half an hour because one request to
 * the smallest page failed at cold start and the result was cached. The same URL,
 * retried, returns the grid -- ten lockups, every time, across six consecutive
 * requests from this machine.
 *
 * The retry is now conditional on the caller's deadline. An unbounded retry is
 * what pushed the function past its budget and took all three tabs down at once.
 *
 * 250 ms is deliberate. YouTube rate-limits by request rate, and the requests
 * already go out together, so a fast second attempt is not meaningfully worse
 * than the first.
 */
const RETRY_DELAY_MS = 250;

async function fetchOnce(url: string, timeoutMs: number): Promise<string | null> {
  if (timeoutMs <= 0) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        "accept-language": "id-ID,id;q=0.9",
        cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+100",
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, deadline = Date.now() + TIMEOUT_MS): Promise<string | null> {
  const first = await fetchOnce(url, Math.min(TIMEOUT_MS, remaining(deadline)));
  if (first !== null) return first;

  const left = remaining(deadline);
  // A retry only counts if there is room for the delay and a real attempt after
  // it. Starting one that cannot finish is how a slow page becomes no page.
  if (left <= RETRY_DELAY_MS + 500) return null;

  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  return fetchOnce(url, Math.min(TIMEOUT_MS, remaining(deadline)));
}

function plainText(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  if (typeof record.content === "string") return record.content;
  if (typeof record.simpleText === "string") return record.simpleText;
  if (Array.isArray(record.runs)) {
    return (record.runs as Array<{ text?: string }>)
      .map((run) => run.text ?? "")
      .join("");
  }
  return null;
}

/** plainText, but empty string instead of null, for concatenating safely. */
function text(node: unknown): string {
  return plainText(node) ?? "";
}

/**
 * Parse a YouTube viewer count.
 *
 * The page is served with gl=ID, so counts arrive in Indonesian format: "." for
 * thousands and "," for decimals. "1,2 rb" means 1.2 thousand, which naive
 * parsing turns into NaN and then silently into null.
 */
function parseViewerCount(text: string): number | null {
  const raw = text.match(VIEWERS)?.[1];
  if (!raw) return null;

  const value = Number(raw.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(value)) return null;

  return /rb|ribu/i.test(text) ? Math.round(value * 1000) : value;
}

interface ContentItem {
  videoId: string;
  url: string;
  title: string;
  thumbnail: string;
  live: boolean;
  viewers: number | null;
  age: string | null;
  /** Runtime length of a finished video, e.g. "2.03.50". Null on a broadcast. */
  duration: string | null;
  /** Channel that published it, on the clips tab only. */
  channel?: string;
}

interface LockupEntry {
  videoId: string;
  title: string;
  live: boolean;
  viewers: number | null;
  age: string | null;
  ageSeconds: number | null;
  thumbnail: string;
}

/**
 * Narrow view of the YouTube lockup node. Only the fields this file reads are
 * described; everything else in the payload is intentionally untyped rather
 * than modelled with `any`.
 */
interface LockupNode {
  contentId?: unknown;
  metadata?: {
    lockupMetadataViewModel?: {
      title?: unknown;
      metadata?: {
        contentMetadataViewModel?: {
          metadataRows?: Array<{ metadataParts?: Array<{ text?: unknown }> }>;
        };
      };
    };
  };
  contentImage?: {
    thumbnailViewModel?: {
      image?: { sources?: Array<{ url?: string }> };
      overlays?: unknown;
    };
  };
}

/** Walk a parsed ytInitialData for every lockup node, in document order. */
function collectLockups(html: string): LockupNode[] {
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!match) return [];

  const found: LockupNode[] = [];

  (function walk(node: unknown, depth = 0): void {
    if (!node || depth > 40) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (typeof node !== "object") return;

    const lockup = (node as Record<string, unknown>).lockupViewModel as LockupNode | undefined;
    if (lockup) found.push(lockup);

    for (const value of Object.values(node as Record<string, unknown>)) walk(value, depth + 1);
  })(JSON.parse(match[1]));

  return found;
}

/**
 * Turn lockup nodes into entries.
 *
 * Live state is read from the node's own badge and viewer row, not from which tab
 * it came off, because a scheduled premiere sitting in the /videos grid also
 * carries a live-style badge.
 */
function parseLockups(html: string): LockupEntry[] {
  const seen = new Set<string>();
  const entries: LockupEntry[] = [];

  for (const lockup of collectLockups(html)) {
    const videoId = typeof lockup.contentId === "string" ? lockup.contentId : "";
    const metaModel = lockup.metadata?.lockupMetadataViewModel;
    const title = plainText(metaModel?.title);

    if (!videoId || !title || seen.has(videoId)) continue;
    seen.add(videoId);

    const thumbnail = lockup.contentImage?.thumbnailViewModel;
    const overlays = thumbnail?.overlays;

    const rowParts: string[] = [];
    for (const row of metaModel?.metadata?.contentMetadataViewModel?.metadataRows ?? []) {
      for (const part of row.metadataParts ?? []) {
        const value = plainText(part?.text);
        if (value) rowParts.push(value);
      }
    }

    const viewerLine = rowParts.find((line) => VIEWERS.test(line));
    // The age sits in the same row as the view count, so it is read here rather
    // than in a second pass over the node.
    const ageLine = rowParts.find((line) => line !== viewerLine && parseAge(line));
    const age = ageLine ? parseAge(ageLine) : null;
    const sources = thumbnail?.image?.sources ?? [];

    entries.push({
      videoId,
      title: stripLiveMarker(title),
      // Two free signals, both from this same response. The thumbnail badge is
      // the primary one; the viewer line is the fallback, because a running
      // stream always has viewers and the badge can briefly be absent in the
      // first moments after a stream goes live.
      live: LIVE_BADGE.test(JSON.stringify(overlays ?? "")) || Boolean(viewerLine),
      viewers: viewerLine ? parseViewerCount(viewerLine) : null,
      age,
      ageSeconds: ageToSeconds(age),
      thumbnail: sources[sources.length - 1]?.url ?? "",
    });
  }

  return entries;
}

function toItem(entry: LockupEntry, live: boolean): ContentItem {
  return {
    videoId: entry.videoId,
    url: `https://www.youtube.com/watch?v=${entry.videoId}`,
    title: entry.title,
    thumbnail: entry.thumbnail,
    live,
    viewers: live ? entry.viewers : null,
    age: entry.age,
    duration: null,
  };
}

/** Newest broadcasts, live state included. */
async function readStreams(deadline: number): Promise<ContentItem[]> {
  const html = await fetchText(STREAMS_TAB, deadline);
  if (!html) return [];

  return parseLockups(html).slice(0, STREAM_LIMIT).map((entry) => toItem(entry, entry.live));
}

/**
 * Newest uploads, with broadcasts removed.
 *
 * The /videos tab does not repeat broadcasts, so nothing needs filtering on this
 * surface. The row text is still checked, because a scheduled premiere sitting in
 * that grid also reads "Streaming", and a premiere is not something this section
 * should list as a finished video.
 */
async function readVideos(deadline: number): Promise<ContentItem[]> {
  const html = await fetchText(VIDEOS_TAB, deadline);
  if (!html) return [];

  const entries = parseLockups(html).filter((entry) => !STREAMING_LABEL.test(entry.age ?? ""));

  return entries.slice(0, VIDEO_LIMIT).map((entry) => toItem(entry, false));
}

interface SearchEntry {
  videoId: string;
  title: string;
  channel: string;
  channelUrl: string;
  duration: string | null;
  age: string | null;
  ageSeconds: number | null;
  thumbnail: string;
  mentions: boolean;
  isOwn: boolean;
  isLive: boolean;
}

/** Narrow view of a search result videoRenderer. */
interface VideoRenderer {
  videoId?: unknown;
  title?: unknown;
  ownerText?: unknown;
  navigationEndpoint?: unknown;
  descriptionSnippet?: unknown;
  lengthText?: unknown;
  publishedTimeText?: unknown;
  thumbnail?: {
    thumbnails?: Array<{ url?: string }>;
  };
}

function collectSearchResults(html: string): VideoRenderer[] {
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!match) return [];

  const found: VideoRenderer[] = [];
  const seen = new Set<string>();

  (function walk(node: unknown, depth = 0): void {
    if (!node || depth > 40) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (typeof node !== "object") return;

    const renderer = (node as Record<string, unknown>).videoRenderer as VideoRenderer | undefined;
    if (renderer && typeof renderer.videoId === "string" && !seen.has(renderer.videoId)) {
      seen.add(renderer.videoId);
      found.push(renderer);
    }

    for (const value of Object.values(node as Record<string, unknown>)) walk(value, depth + 1);
  })(JSON.parse(match[1]));

  return found;
}

function parseSearchResults(html: string): SearchEntry[] {
  const out: SearchEntry[] = [];

  for (const renderer of collectSearchResults(html)) {
    const title = text(renderer.title);
    // collectSearchResults narrows videoId already, but the field is declared
    // unknown so it has to be re-asserted here for the payload type.
    if (!title || typeof renderer.videoId !== "string") continue;

    const channel = text(renderer.ownerText);
    const description = text(renderer.descriptionSnippet);
    const published = text(renderer.publishedTimeText);
    const age = parseAge(published);
    const thumbnails = renderer.thumbnail?.thumbnails ?? [];
    const channelUrl =
      (renderer.navigationEndpoint as { browseEndpoint?: { browseId?: string } } | undefined)
        ?.browseEndpoint?.browseId ?? "";

    out.push({
      videoId: renderer.videoId,
      title: stripLiveMarker(title),
      channel,
      channelUrl: channelUrl ? `https://www.youtube.com/channel/${channelUrl}` : "",
      duration: text(renderer.lengthText) || null,
      age,
      ageSeconds: ageToSeconds(age),
      thumbnail: thumbnails[thumbnails.length - 1]?.url ?? "",
      // A clip has to name her, and "pingu" alone is not naming her: it is also a
      // children's cartoon and a Penguin-of-Africa brand. The identifying word is
      // "Pingu Ch." — her channel title — or one of her handles; \s* so a caption
      // written "PinguCh." still counts. Requiring it keeps the wall to people
      // clipping the character rather than to whatever else shares the word.
      mentions: /(pingu\s*ch\.|pinguvtuber|pingustardine|starpaw)/i.test(
        `${title} ${description}`,
      ),
      // A collaboration publishes under both names, e.g. "Pingu Ch. dan
      // SomeoneElse", so this matches a prefix rather than the whole string.
      isOwn: channel.startsWith(CHANNEL_TITLE_PREFIX),
      isLive: STREAMING_LABEL.test(published),
    });
  }

  return out;
}

/**
 * Clips from other channels that name her.
 *
 * Excludes her own uploads, which the other two tabs already carry, and anything
 * still live, which is a broadcast rather than a clip.
 *
 * Search returns results by relevance, not by date, so they are sorted here.
 * The age label is the only ordering signal available on this surface, and it is
 * coarse: "4 bulan lalu" carries no day, so clips within the same month are
 * grouped at the same age and their relative order is whatever search happened to
 * return. That is a real limit of the data rather than a rounding choice, and it
 * is why the sort falls back to the original order on a tie instead of inventing
 * a sequence.
 *
 * The pool is also bounded by what search surfaced, roughly 85 results across the
 * six queries, so this is the newest clips *among those found* and not an
 * exhaustive archive.
 */

/**
 * Clips already found, kept in the module scope by video id.
 *
 * Search does not return the same page twice. Four identical passes over the six
 * queries surfaced 79, 92, 80 and 88 distinct videos, and the ten qualifying
 * clips appeared in them unevenly:
 *
 *   seen in 4 of 4 passes   5 clips
 *   seen in 3 of 4 passes   3 clips
 *   seen in 1 of 4 passes   2 clips
 *
 * So a wall built from one pass is a sample, and a clip in it can vanish between
 * two requests from the same visitor. That is exactly what happened: the
 * deployment served seven clips while the same code locally served twelve, and the
 * missing one was the newest, three days old.
 *
 * A clip that has been seen once is kept. Search stops surfacing something once it
 * has been indexed for a while, so this is the only way the wall can be a wall
 * rather than a roll of the dice. Entries are dropped on a long TTL, because the
 * set is a union rather than a current answer and holding a dead id forever would
 * be its own kind of lie.
 */
const seenClips = new Map<string, { item: ContentItem; at: number }>();
const SEEN_CLIP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/*
 * Seed the kept set from the committed list, so a cold instance is not at search's
 * mercy.
 *
 * A union in module scope fixes a warm instance and does nothing for a cold one,
 * and cold is what the deployment does most of the time. The clip that prompted
 * this is the clearest evidence: it surfaces under exactly one of the ten
 * queries, from this network, and under none of them from the deployment's. Same
 * code, both reachable, opposite answers.
 *
 * Seed entries are marked so they can be recognised later: a search hit replaces
 * its metadata, but nothing removes a seed that this pass failed to find.
 */
function seedSeenClips(): void {
  for (const seed of SEED_CLIPS) {
    if (seenClips.has(seed.videoId)) continue;
    seenClips.set(seed.videoId, {
      item: {
        videoId: seed.videoId,
        url: `https://www.youtube.com/watch?v=${seed.videoId}`,
        title: seed.title,
        // The thumbnail URL carries a signature that expires, so the wall falls
        // back to the stable path and the card's own fallback chain covers it.
        thumbnail: "",
        live: false,
        viewers: null,
        // Normalised here, not stored normalised: the seed holds YouTube's own
        // label exactly as captured, and "3 h lalu" has to become
        // "3 hari lalu" before ageToSeconds can place it. Left raw it would
        // fail, sort to the end of the wall, and get sliced off -- which is
        // exactly what happened.
        age: seed.age ? parseAge(seed.age) : null,
        duration: seed.duration,
        channel: seed.channel,
      },
      at: Date.now(),
    });
  }
}

seedSeenClips();

async function readClips(deadline: number): Promise<ContentItem[]> {
  // Fetches the ten searches together rather than in sequence: they are unrelated
  // requests to unrelated pages, so serialising them would multiply the latency
  // of the slowest tab by ten. A partial failure is normal here, not exceptional.
  //
  // Ten is the most this can afford. Each of these is a separate YouTube page
  // fetch and the whole call has to land inside the function budget, so the count
  // is a budget decision and not only a coverage one.
  const pages = await Promise.all(
    SEARCH_QUERIES.map((query) => fetchText(searchPage(query), deadline)),
  );

  // Deduplicated by video id, keeping each video's first sighting. Ten searches
  // overlap heavily — the same clip came back from four of them — so without
  // this the wall would be mostly repeats of whatever ranked highest.
  const byId = new Map<string, { entry: SearchEntry; position: number }>();

  pages.forEach((html, queryIndex) => {
    if (!html) return;

    parseSearchResults(html).forEach((entry, position) => {
      if (byId.has(entry.videoId)) return;
      byId.set(entry.videoId, { entry, position: queryIndex * 1000 + position });
    });
  });

  const now = Date.now();

  // This pass's qualifying clips go into the kept set, replacing whatever was
  // there so a refreshed age or thumbnail wins over a stale one.
  const fresh: Array<{ item: ContentItem; position: number }> = [];

  for (const { entry, position } of byId.values()) {
    if (!entry.mentions || entry.isOwn || entry.isLive) continue;

    const item: ContentItem = {
      videoId: entry.videoId,
      url: `https://www.youtube.com/watch?v=${entry.videoId}`,
      title: entry.title,
      thumbnail: entry.thumbnail,
      live: false,
      viewers: null,
      age: entry.age,
      duration: entry.duration,
      channel: entry.channel,
    };

    seenClips.set(entry.videoId, { item, at: now });
    fresh.push({ item, position });
  }

  // The wall is the union: everything seen recently, plus this pass's own
  // position for clips already known so the tiebreak below is still meaningful.
  const positionOf = new Map(fresh.map(({ item, position }) => [item.videoId, position]));
  const union = new Map<string, { item: ContentItem; position: number }>();

  for (const [videoId, kept] of seenClips) {
    if (now - kept.at > SEEN_CLIP_TTL_MS) {
      seenClips.delete(videoId);
      continue;
    }
    union.set(videoId, { item: kept.item, position: positionOf.get(videoId) ?? Number.MAX_SAFE_INTEGER });
  }

  // Newest first. Array.prototype.sort is stable in every engine this targets, so
  // the position tiebreak below is a documented one, not an accident.
  const wall = [...union.values()].sort((a, b) => {
    const left = a.item.age ? ageToSeconds(a.item.age) : null;
    const right = b.item.age ? ageToSeconds(b.item.age) : null;
    if (left === right) return a.position - b.position;
    // An unreadable age cannot be placed, so it goes last rather than first.
    if (left === null) return 1;
    if (right === null) return -1;
    return left - right;
  });

  return wall.slice(0, CLIP_LIMIT).map(({ item }) => item);
}

/**
 * Last successful payload, held in the module scope.
 *
 * Vercel keeps a warm lambda around for a while after a request, so this turns
 * most repeat hits into zero upstream calls. It is deliberately a best-effort
 * second line behind the edge cache: a cold instance simply starts empty.
 *
 * It exists because YouTube rate-limits hard. Measured from one IP during
 * development: the streams tab started returning 503 after a few dozen fetches,
 * which is exactly the failure a stale copy can paper over.
 *
 * It is also the reason a tab that comes back empty is not allowed to overwrite
 * a tab that was full. When a cold instance fails one of the three requests, a
 * payload with a hole in it used to be written here and then served for the next
 * half hour, which is how the deployment showed videos=0 with everything else
 * working. A tab that regresses to empty now keeps the last known list and the
 * response says so through `sources`.
 */
let lastGood: {
  payload: {
    streams: ContentItem[];
    videos: ContentItem[];
    clips: ContentItem[];
    [key: string]: unknown;
  };
  at: number;
  liveCount: number;
  /** False when a tab was missing and its list was carried over. */
  complete: boolean;
} | null = null;

/**
 * How long a warm instance may answer without touching YouTube.
 *
 * A payload with a carried-over tab gets the same short window a live request
 * does, not the long quiet one. Without that the memory cache hands back the
 * incomplete copy for half an hour regardless of what the edge says, which is
 * the original failure with an extra layer on top: the second request inside the
 * memory window would keep reporting videos=0 even though the edge window had
 * already expired and the next real fetch would have succeeded.
 */
const MEMORY_TTL_PARTIAL_MS = 60 * 1000;
const MEMORY_TTL_LIVE_MS = 10 * 60 * 1000;
const MEMORY_TTL_QUIET_MS = 30 * 60 * 1000;

async function readContent(req: UploadsRequest, res: UploadsResponse): Promise<void> {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  // Warm instance, fresh enough: answer without touching YouTube at all. While a
  // stream is running that window is ten minutes, because that is the state a
  // visitor is watching change. Once it ends, half an hour is safe. A payload
  // missing a tab gets a minute instead, so the gap is short-lived rather than
  // carried for the rest of the window.
  if (lastGood) {
    const ttl = !lastGood.complete
      ? MEMORY_TTL_PARTIAL_MS
      : lastGood.liveCount > 0
        ? MEMORY_TTL_LIVE_MS
        : MEMORY_TTL_QUIET_MS;

    if (Date.now() - lastGood.at < ttl) {
      res.setHeader(
        "Cache-Control",
        !lastGood.complete
          ? "public, s-maxage=60, stale-while-revalidate=300"
          : lastGood.liveCount > 0
            ? "public, s-maxage=300, stale-while-revalidate=600"
            : "public, s-maxage=3600, stale-while-revalidate=86400",
      );
      res.setHeader("X-Data-Source", lastGood.complete ? "memory" : "memory-partial");
      res.status(200).json(lastGood.payload);
      return;
    }
  }

  // One deadline for the whole call. Started before the first fetch so the tabs
  // share the budget rather than each assuming all of it.
  const deadline = Date.now() + HANDLER_DEADLINE_MS;

  // Three independent surfaces, fetched together rather than in sequence: they
  // are unrelated requests to unrelated pages, so serialising them would triple
  // the latency for no benefit. A partial failure is kept, not thrown away,
  // because two working tabs beat an error page.
  const [freshStreams, freshVideos, freshClips] = await Promise.all([
    readStreams(deadline),
    readVideos(deadline),
    readClips(deadline),
  ]);

  if (freshStreams.length === 0 && freshVideos.length === 0 && freshClips.length === 0) {
    // Everything failed. A stale copy is still true data and beats an error
    // page, as long as the caller is told it is stale.
    if (lastGood) {
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=600");
      res.setHeader("X-Data-Source", "stale");
      res.status(200).json({ ...lastGood.payload, stale: true });
      return;
    }
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=300");
    res.status(503).json({ error: "could not read any source" });
    return;
  }

  /*
   * A tab that came back empty does not get to replace a tab that was full.
   *
   * This is the failure that actually happened: a cold instance lost one request,
   * wrote a payload with videos=[] into lastGood, and served that for the next
   * thirty minutes plus an hour at the edge while streams and clips looked fine.
   * One flaky request turned a working page into an empty one.
   *
   * The previous list is kept instead, and the response reports the tab as not
   * read this round so the client can say the data is carried over rather than
   * claiming it was just fetched. A tab that is genuinely empty -- a channel with
   * no uploads yet -- has no previous list to keep, so it still reports empty,
   * which is the honest answer.
   */
  function carry(list: ContentItem[], key: "streams" | "videos" | "clips"): ContentItem[] {
    if (list.length > 0) return list;
    return lastGood?.payload[key] ?? list;
  }

  const streams = carry(freshStreams, "streams");
  const videos = carry(freshVideos, "videos");
  const clips = carry(freshClips, "clips");

  const liveCount = streams.filter((item) => item.live).length;

  const payload = {
    fetchedAt: new Date().toISOString(),
    liveCount,
    stale: false,
    // Which tabs this request actually read. A tab false here means the list is
    // the previous one, not an empty channel.
    sources: {
      streams: freshStreams.length > 0,
      videos: freshVideos.length > 0,
      clips: freshClips.length > 0,
    },
    streams,
    videos,
    clips,
  };

  /*
   * A hole in the data shortens the cache. The long quiet window is an
   * optimisation for an archive that does not change, and it is only safe while
   * all three tabs were actually read; otherwise the next request should be free
   * to pick up what this one missed.
   */
  const complete = freshStreams.length > 0 && freshVideos.length > 0 && freshClips.length > 0;

  lastGood = { payload, at: Date.now(), liveCount, complete };

  res.setHeader(
    "Cache-Control",
    !complete
      ? "public, s-maxage=60, stale-while-revalidate=300"
      : liveCount > 0
        ? "public, s-maxage=300, stale-while-revalidate=600"
        : "public, s-maxage=3600, stale-while-revalidate=86400",
  );
  res.setHeader("X-Data-Source", complete ? "live" : "partial");
  res.status(200).json(payload);
}

/**
 * The entry point, wrapped.
 *
 * The wrapper exists because a 500 with an empty body tells you nothing. That is
 * what this endpoint was answering in production -- 500, zero-length body, ~450ms
 * -- while /api/tweets and /api/fanart returned 200 from the same folder and the
 * same function runtime. An unhandled rejection inside a serverless function is
 * reported to the platform, and the platform is free to send an empty body; the
 * stack goes to logs nobody reads. Meanwhile the page falls back to its snapshot,
 * so the site looks alive and the broken endpoint hides behind it.
 *
 * Catching here means a failure is a JSON body with a message in it, so the next
 * person to see a 500 can read what happened instead of re-deriving it. The other
 * three endpoints do the same thing; this one did not, which is exactly why it was
 * the only one that took an afternoon to diagnose.
 */
export default async function handler(req: UploadsRequest, res: UploadsResponse) {
  try {
    await readContent(req, res);
  } catch (error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    // Deliberately not the stack: it can carry absolute paths, and a public
    // endpoint is the wrong place for it. The message plus the name is enough to
    // identify the failure, and the stack is still in the platform logs.
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Failed", "1");
    res.status(500).json({ error: "content endpoint failed", detail });
  }
}

export {
  parseAge,
  ageToSeconds,
  parseLockups,
  parseSearchResults,
  stripLiveMarker,
  fetchText,
};