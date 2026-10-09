/**
 * Clips already known, so a cold instance has a wall before search answers.
 *
 * Search is the only source for these and it is not a stable one. Measured
 * over four passes of ten queries from two networks, the same ten queries
 * surfaced 149 distinct videos and 20 qualifying clips, and no
 * single pass saw all of them. The newest clip is the most fragile of all:
 * it appears under exactly one query, on some networks and not others, so a
 * cold response from the deployment could omit the first thing on the page.
 *
 * A union held in module scope fixes a warm instance and does nothing for a cold
 * one, so the known set is committed here instead. Everything in this file was
 * read off a real search result and its age label is YouTube's own, captured
 * rather than calculated. Search still runs and can only add to this list.
 *
 * Regenerate with the probe that measured it; do not hand-edit, because the ages
 * here are a snapshot and a hand-edited one would be a guess.
 */
export type SeedClip = {
  videoId: string;
  title: string;
  channel: string;
  /** YouTube's own label when captured, e.g. "3 hari lalu". */
  age: string | null;
  duration: string | null;
};

const SEED_CLIPS: SeedClip[] = [
  { videoId: "tDL_1MLvjmM", title: "Pingu Mau Lakban Mulut Bang Al Karna Bocorin Hubungan Mereka 😂 [Pingu Ch. - Naplive]", channel: "Exile Syahputra", age: "10 bln lalu", duration: "1.35" },
  { videoId: "Qjr-RL28kik", title: "Jadi Pingu Dan Bang al Itu Udah Serumah Dan Sekamar? 😱 [Pingu Ch.]", channel: "Exile Syahputra", age: "3 h lalu", duration: "1.49" },
  { videoId: "QqTSAvkGDfQ", title: "Bang Al pamit tidur ke Pingu dan rebutan ngurus bayi [ Pingu Ch. Clip ]", channel: "DweenClip", age: "1 thn lalu", duration: "3.32" },
  { videoId: "_SsXKhE2kKo", title: "Pingu Dan Bang Al Liburan Keluarga Bersama Anaknya 🥰 [Naplive - Pingu Ch. - Zeyayaya]", channel: "Exile Syahputra", age: "11 bln lalu", duration: "1.55" },
  { videoId: "uDudNwwJ91Q", title: "Pingu Akhirnya Jujur Kalau Suka Sama Bang Al 🥰 [Pingu Ch.]", channel: "Exile Syahputra", age: "8 bln lalu", duration: "1.16" },
  { videoId: "CavqWDgr764", title: "Pingu Cemburu Bang Al Ada Cewe Baru? 😢 [Pingu Ch. - Naplive]", channel: "Exile Syahputra", age: "11 bln lalu", duration: "1.24" },
  { videoId: "4BzqltBdxXo", title: "Bang AL mampir ke stream skin baru @pinguvtuber ", channel: "Vendouw 07 Ch.", age: "1 bln lalu", duration: "3.30" },
  { videoId: "oOAT24VEwEE", title: "Batsu kecup basah @pinguvtuber", channel: "Rama Takagi", age: "1 thn lalu", duration: "1.38" },
  { videoId: "41Z2kQLnyqs", title: "@pinguvtuber pake wallpaper @naplive7", channel: "Dredd", age: "1 thn lalu", duration: "0.16" },
  { videoId: "QuEg7DYT9JI", title: "Pingu salting ketika tau Bang Al reaction lagunya dan nyanyi bareng 👉👈 [ Pingu Ch. Clip ]", channel: "DweenClip", age: "10 bln lalu", duration: "5.37" },
  { videoId: "HakvaUXF6XY", title: "Pingu kedatangan *suami* di malam tahun baru @pinguvtuber", channel: "SylvNoir Ch.", age: "1 thn lalu", duration: "1.56" },
  { videoId: "wfSokIrqMUg", title: "Pingu Dan Bang Al Pegangan Tangan Ketika Ngedate? 😮 [Pingu Ch.]", channel: "Exile Syahputra", age: "8 bln lalu", duration: "1.14" },
  { videoId: "vh5CFxVarL4", title: "Istri Bang Al Ini Akhirnya Buka Suara Untuk Klarifikasi! [Pingu Ch.]", channel: "Exile Syahputra", age: "9 bln lalu", duration: "2.02" },
  { videoId: "5EB5g36Jkzs", title: "Aduh Bang Al Kenapa Bocor Gitu Kasian Pingu Isi Hatinya Ikut Bocor 😂 [Pingu Ch.]", channel: "Exile Syahputra", age: "4 bln lalu", duration: "1.23" },
  { videoId: "Dv8uYPlYQk0", title: "Pingu Menjadi Obat Dan Prioritas Ketika Bang Al Sedang Sakit 🥰 [Pingu Ch.]", channel: "Exile Syahputra", age: "8 bln lalu", duration: "1.27" },
  { videoId: "NSJ_4zlpuLw", title: "Kenapa Sih Kalau Soal Bang Al Pingu Harus Tsundere Gitu Guys? 🤔 [Pingu Ch.]", channel: "Exile Syahputra", age: "5 bln lalu", duration: "1.28" },
  { videoId: "iQwTokm8L4E", title: "Pingu Bahagia Banget Ketika Liat Bang Al Denger Lagunya 🥰 [Pingu Ch. - Naplive]", channel: "Exile Syahputra", age: "10 bln lalu", duration: "2.05" },
  { videoId: "NR6DyrvTnyc", title: "VTUBER PALING TSUNDERE! ADA LAWAN?? || @pinguvtuber 【VTUBER CORNER】", channel: "Vtuber Graphic", age: "4 bln lalu", duration: "34.16" },
  { videoId: "y8AX6kJbVj8", title: "Pingu Diinterogasi Tentang Pernikahannya Dengan Bang Al [Pingu Ch. - Naplive]", channel: "Exile Syahputra", age: "10 bln lalu", duration: "2.24" },
  { videoId: "8YDi5kFKVfA", title: "Pingu Dan Bang Al Romantis Banget Dari Pegangan Tangan Sampai Tidur Bareng! 😳 [Naplive - Pingu Ch.]", channel: "Exile Syahputra", age: "8 bln lalu", duration: "2.21" },
];

export default SEED_CLIPS;
