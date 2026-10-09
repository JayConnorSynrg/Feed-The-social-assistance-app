// apps/web/src/components/feed/post-card-frame.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC

/**
 * The post card frame. A hidden post (shown only to its author) is dimmed — its content, NOT the
 * action row (data-card-actions: "Edit in admin" + Report), which keeps full contrast (lime-800 at
 * 70% opacity fell to 3.4:1).
 */
export function postCardFrameClass(hidden: boolean): string {
  return `p-4 rounded-xl bg-[#faf9f6] border transition-all ${
    hidden ? 'border-orange-200 [&>*:not([data-card-actions])]:opacity-70' : 'border-stone-200 hover:border-primary/30'
  }`
}
