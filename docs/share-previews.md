# Share previews

What a link to FEED looks like when it is pasted into a chat, a social network or a search result,
and the one rule that keeps it private and correct in every language.

## The rule

**A preview image carries no user text. Text travels in `og:title` and `og:description`.**

- The image at `/api/og/{post,resource,business,organization}/<id>` is one of ten fixed cards, chosen
  only by what kind of thing the link points to. It shows the FEED logo and wordmark, an icon and a
  fixed label for the kind. It never shows a title, a body, an author's name or initial, an
  organization's name, a place, or anything else read from the database.
- The title and description of the shared item are sent as plain UTF-8 text in the page's
  `og:title` / `og:description` (and the Twitter-card equivalents). The platform showing the preview
  draws that text with its own fonts, so Arabic, Amharic, Chinese, Korean and the other eleven
  languages read correctly, right-to-left where needed.
- `/s/post/<id>` and `/s/embed/<id>` also send `og:locale`, taken from the post's own language
  (`posts.lang`), so the platform knows which language the text is in.

## Why

Drawing a member's text into an image needs a font for every script the text uses. The renderer
FEED used before (`next/og`) fetched any font it lacked from Google Fonts, and every emoji from a
public CDN, at the moment a crawler asked for the image — sending the characters of the post and of
the author's name to those services on every preview. Arabic text was not drawn at all, Amharic came
out as empty boxes, and Chinese was drawn with Japanese letterforms.

With fixed cards there is nothing to look up: no renderer, font request or emoji request runs when a
preview is made, so no post text or author name leaves FEED's own infrastructure, and there is no
script the picture can get wrong.

## The ten cards

| Kind | Used for | Label on the card | Description of the picture |
|---|---|---|---|
| `feed` | a general post (and any post type added later, until it gets its own card) | Community post | FEED — Community post |
| `resource_post` | a post sharing a resource | Shared resource | FEED — Shared resource |
| `petition` | a petition post | Petition | FEED — Petition |
| `seeker_request` | a request for help | Request for help | FEED — Request for help |
| `source_offer` | an offer of help | Offer of help | FEED — Offer of help |
| `event_post` | an event post | Community event | FEED — Community event |
| `poll` | a poll | Poll | FEED — Poll |
| `resource` | `/s/resource/<id>` | Community resource | FEED — Community resource |
| `business` | `/s/business/<id>` | Local business | FEED — Local business |
| `organization` | `/s/organization/<id>` | Local organization | FEED — Local organization |

The labels live in one map, `apps/web/src/lib/og-card-labels.mjs`. The generator draws the label on
the card, and the share pages describe the picture with it: `ogCardAlt(kind)`
(`src/lib/og-card-kinds.ts`) gives "FEED — <label>", sent as both `og:image:alt` and
`twitter:image:alt`. The description says what the picture shows and nothing about the item, whose
title and text are in `og:title` / `og:description`.

**Layout.** 1200 × 630. Platforms that show a compact preview crop the picture to its centre square,
so everything is drawn inside that square (x 285 to 915): the measured content spans x 331 to 866.
The kind label is the largest text on the card — 80 px, centred on x = 600, starting 178 px from the
top, directly under the 104 px kind icon, wrapping to a second line when it is long. Below it sit the
logo with the FEED wordmark (88 px) and the address. Contrast: label 14.5:1, wordmark 7.0:1, address
7.3:1 against the background; the white icon is at least 4.9:1 on every kind colour.

The cards are PNG files in `apps/web/src/lib/og-cards/`, with a `manifest.json` that records, per
kind, the label the picture was drawn with and the picture's SHA-256. They are drawn once, by
`apps/web/scripts/generate-og-cards.mjs`, from the label map, constants in that script and
`apps/web/public/feed-logo.svg`, and committed. The script refuses any network request while it
draws, so a design that would need a remote font fails at the desk, not in production.

To change a label or the design, or add a kind:

1. Edit the label in `src/lib/og-card-labels.mjs`, or the design in `scripts/generate-og-cards.mjs`.
   For a new kind, add it to `OG_CARD_KINDS` in `src/lib/og-card-kinds.ts`, to the label map, and to
   the generator's icon and colour table; a new post type is a type error in `og-card-kinds.ts` until
   it has a card.
2. From `apps/web`: `node scripts/generate-og-cards.mjs`
3. Commit the changed PNG files and `manifest.json` with the source change.
   `src/lib/og-card-kinds.test.ts` fails while a picture, the manifest and the label map disagree
   (for example a label changed but the cards not regenerated); `src/app/api/og/og-routes.test.ts`
   checks the routes serve those bytes.

## What each request answers

| The link points to | Status | Body |
|---|---|---|
| a visible post, an approved resource, an approved and active business, an active organization | 200 | the card for its kind, `image/png` |
| a hidden or deleted post; a pending or rejected resource; a business or organization that is not public | 404 | `Post not found` / `Resource not found` / `Business not found` / `Organization not found` |
| an id that does not exist | 404 | the same text |
| any request that fails with an exception (the card file cannot be read, the database client throws) | 500 | `Preview image unavailable`, sent with `Cache-Control: no-store` |

A database error that the API returns as an answer rather than an exception (a malformed id, a
refused read) is treated like "no such item": 404, as before this release, and logged `not_found`.

Each handler makes one read of FEED's own database, and asks for the `id` column only — plus
`post_type` for a post, which picks the card. Nothing else about the item (its text, name, place or
contact details) is read to make a preview image. The business and organization routes use
`isPublicBusiness` / `isPublicOrganization`, which run the same query as the public pages' readers
(one shared filter chain per kind in `lib/business-data.ts` and `lib/org-data.ts`), so "public" means
the same thing for the page and for its picture.

## Caching

A served card is sent with `Cache-Control: public, max-age=31536000, s-maxage=31536000, immutable`.
The picture at a given URL depends only on the item's kind, and the kind never changes after the item
is created, so browsers, link crawlers and the CDN can keep it for a year without asking again. An
edit to a post never changes its picture, so there is no stale image to refresh after an edit.

Two consequences to know:

- A post hidden after its card was cached can keep answering with the generic card from a cache until
  that copy expires or the next deployment purges the CDN. The card says nothing about the post but
  its kind; the share page itself answers 404 at once.
- A redesigned card reaches new shares after the deployment that carries it (which purges the CDN).
  Previews that a platform has already stored keep the old card for as long as that platform keeps
  them.

404 answers are not given a cache header.

## Logging

One `og.image.complete` row per handled request (`surface`, `kind`, `outcome` `ok` or `not_found`,
duration), or one `og.image.error` row (`outcome` `error`, the failure's code) when the request fails.
No id and no text, including in the error row: it stores a fixed message, not the raw failure. See
[`observability.md`](observability.md#share-preview-images).

## Member text on the share pages

The share pages' own chrome is English and the page is `lang="en"`. Text with no `lang` attribute
inherits that, so everything a member wrote says what it is:

- **The post's text** (`/s/post` body, `/s/embed` body) carries `lang` from `posts.lang` — the
  author's app language when they posted, the best signal there is, not a detected language — and
  `lang=""` (unknown) when the post has none. It also carries `dir="auto"`, so right-to-left text is
  laid out right-to-left.
- **A petition's title and summary and a linked resource's name** have no recorded language and are
  not the post's text: `lang=""` and `dir="auto"`, never the post's language. (When a petition is
  not approved the widget shows the post's own text instead, with the post's language.)
- **The author's name** carries `dir="auto"` only.
- **A post's photo** on `/s/post` is described by the author's own description (`posts.image_alt`)
  when there is one; its wrapper then carries the post's language (or `lang=""`). Otherwise the
  description is the page's own "Post image" and no language is set.

Neither page shows a hidden post (404), and neither the widget nor oEmbed shows the title or summary
of a petition that is not approved.

`/s/post` and `/s/embed` each read their post once per request: the metadata and the page share one
cached reader (and `/s/embed` one cached petition reader), which send one identical query.

## oEmbed

`/api/oembed?url=…` answers for a FEED share link on either of FEED's addresses
(`https://sourcetofeed.com/…` and `https://www.sourcetofeed.com/…`) and refuses every other origin.
Its `thumbnail_url` is the same preview-image URL, so it follows the same rule.

- **Path:** exactly `/s/post/<uuid>` or `/s/embed/<uuid>` (one optional trailing slash). An id
  written in uppercase is the same post and is looked up in lowercase.
- **Response URLs:** built from the app's canonical origin and the id of the post row the database
  returned; nothing from the submitted URL is copied into the response.
- **`maxwidth` / `maxheight`:** a whole number of pixels, 1 or more; the response never exceeds it.
  Zero, a negative number or a non-number is treated as not sent (480 × 270).
- **Local development:** outside production, `http(s)://localhost` and `127.0.0.1` links are accepted
  too. In production they are refused like any other foreign origin.

## Structured data

`/s/business/<id>` and `/s/organization/<id>` include JSON-LD for search engines. Member-written
text in it is serialized with `serializeJsonLd` (`apps/web/src/lib/json-ld.ts`), which keeps `<`,
`>`, `&` and the two Unicode line separators from ending the script element. Use that helper for
any JSON placed inline in a page.
