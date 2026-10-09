// apps/web/src/lib/petition-hash.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The petition draft's body_version_hash: a pure function of the body EXACTLY as stored (the same
// formula the wizard has always used). A signature binds to the petition by copying the stored
// petitions.body_version_hash into petition_signatures.petition_version_hash
// (app/api/petitions/sign/route.ts); nothing re-derives the hash from the body or re-escapes it, so a
// petition drafted when bodies were stored HTML-escaped (before post editing) and one drafted with the
// raw text both verify against their own stored hash.

/** body_version_hash for a petition body as stored. */
export function petitionBodyHash(storedBody: string): string {
  return btoa(unescape(encodeURIComponent(storedBody))).slice(0, 32)
}
