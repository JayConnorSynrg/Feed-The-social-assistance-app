// apps/web/src/lib/og-card-labels.mjs
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The one kind → label map for share-preview cards. Two readers:
//   - scripts/generate-og-cards.mjs draws the label on the card (plain Node, hence .mjs);
//   - lib/og-card-kinds.ts describes the picture with it ("FEED — <label>") for og:image:alt and
//     twitter:image:alt on the share pages.
// One source, so the words on the picture and the words that describe it cannot differ. After
// changing a label, regenerate the cards (node scripts/generate-og-cards.mjs): the manifest beside
// the PNGs records the label each picture was drawn with, and og-card-kinds.test.ts fails while a
// picture and this map disagree.

export const OG_CARD_LABELS = /** @type {const} */ ({
  feed: 'Community post',
  resource_post: 'Shared resource',
  petition: 'Petition',
  seeker_request: 'Request for help',
  source_offer: 'Offer of help',
  event_post: 'Community event',
  poll: 'Poll',
  resource: 'Community resource',
  business: 'Local business',
  organization: 'Local organization',
})
