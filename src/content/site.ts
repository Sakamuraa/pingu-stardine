/**
 * Identity strings, sourced from the real channel.
 *
 * Provenance, so nothing here has to be trusted on faith:
 *   - name, bio ................. YouTube channel description + X profile bio
 *   - avatar .................... yt3.googleusercontent.com (channel avatar)
 *   - join date ................. channel /about page, "Joined Feb 1, 2017"
 *   - character credits ......... the creator's own X bio
 *   - hashtags .................. the X profile, in her own category order
 *
 * The content lists are NOT here. They come from /api/content at request time
 * and keep only a bundled snapshot in src/lib/useContent.ts, so there is one
 * place to look for broadcast data instead of two that can drift apart.
 */

export const site = {
  name: "Pingu Stardine",
  /** Name as it appears on the channel, verbatim. */
  channelTitle: "Pingu Ch.",
  /**
   * Description as published by the creator.
   *
   * Verbatim from the channel's og:description, keeping the English-then-
   * Indonesian order she introduces herself in rather than tidying it.
   */
  bio: "A stray star from nowhere, fallen to Earth, now living as a cat café owner. Selamat datang di Starpaw Cafe, tempat nongkrongnya para stray cats. Halo semuanya! Tak kenal maka tak elus, salam kenal namaku Pingu :3",
  /**
   * Production origin. The site is served from its own subdomain, so the origin
   * and the site URL are the same thing. Kept in sync with index.html,
   * robots.txt, and sitemap.xml.
   *
   * Placeholder: no domain is registered for this site yet.
   */
  url: "https://pingu.vtube-info.xyz",
  locale: "id_ID",
  avatar: "/media/avatar-youtube.webp",
  /**
   * Alt text for the channel avatar.
   *
   * Deliberately does not describe the picture. The artwork is Pingu's own
   * design and any description here would be invented rather than read off it,
   * which serves a screen reader worse than naming what the image is for. Worth
   * replacing with a real description of the artwork.
   */
  avatarAlt: "Avatar kanal YouTube Pingu Stardine",
  /** Smaller crop used for the nav mark, where the square version is too heavy. */
  avatarSmall: "/media/avatar-x.webp",
  joined: "Bergabung pada Februari 2017",
  /**
   * Character work credits, taken from the creator's own X bio, which names
   * them directly: ママ (mama) @Lienae4 and パパ (papa) @re_reinly.
   */
  credits: [
    { role: "Model Live 2D", name: "@Lienae4" },
    { role: "Rig", name: "@re_reinly" },
  ],
} as const;

/**
 * Only channels confirmed to be hers.
 *
 * The support link is Trakteer, and it is verifiable rather than inferred: the
 * channel's own broadcast cards carry the line "⛤ Trakteer (donate, voice note,
 * …)", and trakteer.id/pinguvtuber resolves to a creator page titled
 * "Pingu Stardine (@pinguvtuber)" while every other candidate spelling 404s. It
 * follows the YouTube handle, the same way the previous site's did.
 *
 * Note for whoever adds the next channel: her X profile header does render a
 * Liberapay link, but that link sits in the Nitter instance's own site-wide
 * navigation and appears on every profile that instance serves. It is the
 * instance operator's, not hers. Do not read it off the profile again.
 */
export const channels = {
  youtube: {
    label: "YouTube",
    handle: "@pinguvtuber",
    url: "https://www.youtube.com/@pinguvtuber",
    note: "Stream dan klip",
  },
  x: {
    label: "X",
    handle: "@pingustardine",
    url: "https://x.com/pingustardine",
    note: "Update harian",
  },
  trakteer: {
    label: "Trakteer",
    handle: "trakteer.id/pinguvtuber",
    url: "https://trakteer.id/pinguvtuber",
    note: "Support lewat gift",
  },
} as const;

/**
 * Route table.
 *
 * Owned here rather than in App.tsx so the nav and the router cannot disagree
 * about which paths exist. App imports the type; nothing else needs the list.
 */
export const ROUTES = [
  "/",
  "/tentang",
  "/konten",
  "/konten/streams",
  "/konten/video",
  "/konten/clips",
  "/tweets",
  "/fanart",
  "/channel",
] as const;

export type Route = (typeof ROUTES)[number];

/**
 * The creator's own hashtags, in the order she groups them on her X profile.
 *
 * Read off the category list in her own posts rather than guessed from how fans
 * use them: she labels these herself as Announcement/Schedule, Fan Art, NSFW Art
 * and Meme/Clip.
 */
export const hashtags = [
  { tag: "#Pingfo", use: "Announcement" },
  { tag: "#PingGambar", use: "Fan Art" },
  { tag: "#PingSUS", use: "NSFW Art" },
  { tag: "#Pingakak", use: "Meme" },
] as const;

/**
 * Series names exactly as they appear between the brackets in the feed titles,
 * counted from the channel's own streams tab. The `kind` column is a plain
 * reading of what the title is about, not a claim from the creator.
 *
 * Game-heavy, because that is what this channel actually streams. Bracketed
 * one-off announcements — Countdown, the pre-order posts — are left out: they are
 * messages, not a series anyone comes back to.
 */
export const series = [
  { name: "CHAT", kind: "Ngobrol" },
  { name: "Genshin Impact", kind: "Game" },
  { name: "Persona 5 Royal", kind: "Game" },
  { name: "The Walking Dead", kind: "Game" },
  { name: "BOMBANANA!", kind: "Game" },
  { name: "Petit Planet", kind: "Game" },
  { name: "Zenless Zone Zero", kind: "Game" },
  { name: "VALORANT", kind: "Game" },
  { name: "Kingdom Hearts", kind: "Game" },
] as const;

/**
 * Colophon. A credit line naming who built the page. Kept as a footnote, not a
 * showcase section.
 */
export const colophon = {
  /** Credit line. Replaces a former tool list, which described the stack rather than the person. */
  credit: "Developed by Sakamura",
} as const;

/**
 * Nav links.
 *
 * Every href is a full route, never a bare "#anchor". That is the fix for the
 * footer bug: on /konten, "#tentang" and "#channel" resolved against a page that
 * has neither section, so both looked clickable and did nothing. A path always
 * resolves, and the nav and the router now read the same table.
 *
 * `satisfies` ties every href to the Route union, so a typo becomes a type error
 * rather than a link that quietly goes nowhere.
 */
export const navigation = [
  { label: "Tentang", href: "/tentang" },
  { label: "Konten", href: "/konten" },
  { label: "Tweets", href: "/tweets" },
  { label: "Fan Art", href: "/fanart" },
  { label: "Channel", href: "/channel" },
] as const satisfies ReadonlyArray<{ label: string; href: Route }>;