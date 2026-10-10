// apps/web/src/lib/text-diff.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Word-level diff for the post / comment edit history and the edit-conflict comparison. Pure and
// dependency-free: the text is split into words and the whitespace between them, the shared start
// and end are set aside, and a longest-common-subsequence over the remaining tokens yields the
// words removed from the older text and the words added in the newer one. Adjacent pieces of the
// same kind are merged, so a caller renders one <del> / <ins> per changed run.

export type DiffPart = { kind: 'same' | 'added' | 'removed'; text: string }

/** Words and the whitespace runs between them, in order (joining them gives the input back). */
export function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t !== '')
}

function push(out: DiffPart[], kind: DiffPart['kind'], text: string) {
  if (!text) return
  const last = out[out.length - 1]
  if (last && last.kind === kind) last.text += text
  else out.push({ kind, text })
}

/**
 * The changes from `before` to `after`, word by word. Joining the 'same' + 'removed' parts gives
 * `before`; joining the 'same' + 'added' parts gives `after`.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before)
  const b = tokenize(after)
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const out: DiffPart[] = []
  push(out, 'same', a.slice(0, start).join(''))

  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  const n = midA.length
  const m = midB.length
  // lcs[i][j] = LCS length of midA[i..] and midB[j..], stored row-major.
  const width = m + 1
  const lcs = new Uint32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * width + j] =
        midA[i] === midB[j]
          ? lcs[(i + 1) * width + j + 1] + 1
          : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1])
    }
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      push(out, 'same', midA[i])
      i++
      j++
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      push(out, 'removed', midA[i])
      i++
    } else {
      push(out, 'added', midB[j])
      j++
    }
  }
  while (i < n) push(out, 'removed', midA[i++])
  while (j < m) push(out, 'added', midB[j++])

  push(out, 'same', a.slice(endA).join(''))
  return out
}

/** True when the diff has at least one added or removed part. */
export function hasChanges(parts: readonly DiffPart[]): boolean {
  return parts.some((p) => p.kind !== 'same')
}
