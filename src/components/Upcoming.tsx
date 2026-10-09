import { CalendarBlank, Clock } from "@phosphor-icons/react";

import { ActionLink } from "@/components/Action";
import { Reveal } from "@/lib/reveal";
import { Thumb } from "@/components/Uploads";
import type { ContentItem } from "@/lib/useContent";

/**
 * The next stream.
 *
 * Kept visually apart from the broadcast cards on purpose. A live card says "now"
 * and a finished one says "then"; this says "not yet", and rendering it as a
 * third card in the same grid would blur exactly the distinction it exists to
 * make. So it is a framed panel with a calendar, not a thumbnail tile.
 *
 * No countdown. The /streams grid carries a scheduled item but not its start
 * time in anything this endpoint reads, so a ticking clock would have to be built
 * from a number that is not there. The honest thing is to link to the stream,
 * where YouTube shows the real time, and say which channel it is on.
 *
 * `demoChannel` is what stops this from quietly lying. When the site has nothing
 * scheduled of its own, the card shows a stream from another channel, and it
 * names that channel rather than borrowing the schedule as if it were the site's
 * own. A visitor asked "when is the next stream" and shown a stranger's schedule
 * with no label has been given the wrong answer in a way that looks right.
 */
export function UpcomingCard({ item }: { item: ContentItem | null }) {
  if (!item) return null;

  const isDemo = Boolean(item.demoChannel);

  return (
    <Reveal amount={0.25}>
      <article
        aria-labelledby="upcoming-heading"
        className="mt-10 overflow-hidden rounded-card border border-gold/40 bg-surface-deep/40"
      >
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="w-full shrink-0 sm:w-56">
            <div className="relative overflow-hidden rounded-card">
              <Thumb item={item} />
              {/*
                Dimming rather than hiding. The thumbnail is the reason to click,
                so it stays; the wash plus the badge is what stops it reading as a
                stream that is already running.
              */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-ground/45"
              />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-btn bg-gold px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-ground">
                <CalendarBlank size={13} weight="fill" aria-hidden="true" />
                Mendatang
              </span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h3
              id="upcoming-heading"
              className="text-lg font-semibold leading-snug text-fg sm:text-xl"
            >
              {item.title}
            </h3>

            <p className="mt-2 flex items-center gap-2 text-sm text-fg-muted">
              <Clock size={15} aria-hidden="true" className="text-gold" />
              {isDemo ? (
                <>
                  Dijadwalkan di channel{" "}
                  <span className="font-semibold text-fg">{item.demoChannel}</span>,{" "}
                  bukan channel ini.
                </>
              ) : (
                <>Stream berikutnya sudah dijadwalkan.</>
              )}
            </p>

            <p className="mt-2 text-sm leading-relaxed text-fg-subtle">
              {isDemo
                ? "Card ini menampilkan contoh, karena channel ini belum punya jadwal. Buka stream-nya untuk melihat waktu sebenarnya."
                : "Waktu mulainya ada di halaman stream-nya."}
            </p>

            <div className="mt-5">
              <ActionLink href={item.url} external variant="quiet">
                Buka di YouTube
              </ActionLink>
            </div>
          </div>
        </div>
      </article>
    </Reveal>
  );
}