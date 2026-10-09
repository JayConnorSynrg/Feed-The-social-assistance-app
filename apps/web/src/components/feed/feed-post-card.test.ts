// feed-post-card.test.ts — what a member, the author, a guest and a moderator see on a feed post card,
// and what the edit / history / conflict surfaces show, rendered to static markup (node environment,
// react-dom/server — the same harness as event-card.test.ts).
import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as fs from 'node:fs'
import * as path from 'node:path'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ isAnonymous: false, user: null, loading: false, profile: null, isAuthenticated: true }) }))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logEvent: vi.fn(),
  withMetric: (_op: string, _a: unknown, fn: () => unknown) => fn(),
}))

import { FeedPostCard, type FeedPostCardProps } from './feed-post-card'
import { rowToPost, type FeedPostRow, type Post } from './post-model'
import { PostFormFields } from './post-form-fields'
import { EditConflictView } from './post-edit-conflict'
import { HistoryList } from './post-history-dialog'
import { buildHistory, postRevisionItem } from './post-history'
import { EMPTY_DRAFT } from './post-edit-model'
import { buildPostMenuSections } from './post-menu-content'
import { postMenuItems } from './post-actions'

function row(o: Partial<FeedPostRow> = {}): FeedPostRow {
  return {
    id: 'p1',
    content: 'Free bread & soup <today>\nat 5pm',
    created_at: '2026-10-01T12:00:00.000Z',
    is_pinned: false,
    is_hidden: false,
    image_url: null,
    max_seekers: null,
    slots_remaining: null,
    post_type: 'feed',
    petition_id: null,
    resource_id: null,
    metadata: null,
    like_count: 3,
    comment_count: 2,
    version: 1,
    edited_at: null,
    edit_count: 0,
    image_alt: null,
    hidden_reason: null,
    user: { id: 'author', first_name: 'Ada', avatar_url: null, is_staff: false, admin_tier: null, harmony_score: null, harmony_reviews_count: 0, badge_summary: null },
    resource: null,
    ...o,
  }
}

const noop = () => {}
function card(post: Post, o: Partial<FeedPostCardProps> = {}): string {
  const props: FeedPostCardProps = {
    post,
    locale: 'en',
    formatAge: () => '5m ago',
    viewer: { id: 'member', isGuest: false, tier: null },
    currentUserId: 'member',
    optInStatus: undefined,
    onLike: noop,
    onComment: noop,
    onShare: noop,
    onEmbed: noop,
    onOptIn: noop,
    onWithdraw: noop,
    onAction: noop,
    ...o,
  }
  return renderToStaticMarkup(h(FeedPostCard, props))
}

describe('the post card', () => {
  it('is an <article> named by its heading; the author text is raw text, React-escaped, with dir="auto"', () => {
    const html = card(rowToPost(row(), { isLiked: false }))
    expect(html).toMatch(/^<article aria-labelledby="([^"]+)"/)
    const id = /aria-labelledby="([^"]+)"/.exec(html)![1]
    expect(html).toContain(`<h3 id="${id}" class="sr-only">Post by Ada</h3>`)
    expect(html).toContain('dir="auto" class="mb-3 whitespace-pre-wrap')
    expect(html).toContain('Free bread &amp; soup &lt;today&gt;\nat 5pm')
  })

  it('the like button carries its state (aria-pressed) and a name that includes the visible count', () => {
    expect(card(rowToPost(row(), { isLiked: true }))).toMatch(/<button[^>]*aria-pressed="true"[^>]*data-testid="like-btn-p1"[^>]*>.*<span class="sr-only">Like<\/span><span class="font-medium">3<\/span>/)
    expect(card(rowToPost(row(), { isLiked: false }))).toContain('aria-pressed="false"')
  })

  it('an edited post shows "Edited", a button whose name starts with Edited and names the time', () => {
    const html = card(rowToPost(row({ version: 3, edited_at: '2026-10-09T21:53:18Z', edit_count: 2 }), { isLiked: false }))
    expect(html).toMatch(/data-testid="post-edited-p1" aria-label="Edited [^"]+\. View edit history"/)
    expect(html).toContain('>Edited</time></button>')
    expect(card(rowToPost(row(), { isLiked: false }))).not.toContain('post-edited-p1')
  })

  it('reads in the member’s language', () => {
    const html = card(rowToPost(row({ edited_at: '2026-10-09T21:53:18Z' }), { isLiked: false }), { locale: 'es' })
    expect(html).toContain('Publicación de Ada')
    expect(html).toContain('Miembro de la comunidad')
    expect(html).toContain('>Editado</time>')
    expect(html).toContain('>Denunciar<')
    expect(html).toContain('>Novedad<')
  })

  it('a member who is not the author sees Report; the author and a guest do not', () => {
    const post = rowToPost(row(), { isLiked: false })
    expect(card(post)).toContain('data-testid="report-btn-p1"')
    expect(card(post, { currentUserId: 'author', viewer: { id: 'author', isGuest: false, tier: null } })).not.toContain('report-btn-p1')
    expect(card(post, { currentUserId: 'guest', currentUserIsGuest: true, viewer: { id: 'guest', isGuest: true, tier: null } })).not.toContain('report-btn-p1')
  })

  it("the author's held post keeps its banner; a removed one says a moderator removed it; anyone else sees nothing", () => {
    const held = rowToPost(row({ is_hidden: true, hidden_reason: 'hold_for_review' }), { isLiked: false })
    const asAuthor = { currentUserId: 'author', viewer: { id: 'author', isGuest: false, tier: null } }
    expect(card(held, asAuthor)).toContain('Hidden pending review')
    expect(card(rowToPost(row({ is_hidden: true, hidden_reason: 'admin_removal' }), { isLiked: false }), asAuthor)).toContain('A moderator removed this post')
    expect(card(held)).toBe('')
  })

  it('a photo is described by the author’s own alt text when given', () => {
    const html = card(rowToPost(row({ image_url: 'https://x/p.webp', image_alt: 'A crate of apples' }), { isLiked: false }))
    expect(html).toContain('alt="A crate of apples"')
  })

  it('touched controls meet AA: no white text on lime-600 or amber-500', () => {
    const html = card(rowToPost(row({ max_seekers: 5, slots_remaining: 2 }), { isLiked: false }))
    expect(html).toContain('bg-lime-700')
    expect(html).not.toMatch(/bg-lime-600[^"]*text-white|bg-amber-500/)
  })

  it('a legacy member event (no zone) shows its times as entered, labelled local time, and drops an end before its start', () => {
    const html = card(
      rowToPost(row({ post_type: 'event_post', content: 'Potluck', metadata: { starts_at: '2026-10-10T18:00', ends_at: '2026-10-10T09:00', is_online: false } }), { isLiked: false }),
    )
    expect(html).toContain('data-testid="event-starts-p1">Oct 10, 6:00 PM (local time)<')
    expect(html).not.toContain('9:00 AM')
  })
})

describe('the ⋯ menu content (Release 1 CardMenuSection shape)', () => {
  it('author: Edit / Copy link, then Delete in its own destructive section; labels translated', () => {
    const items = postMenuItems({ id: 'author', isGuest: false, tier: null }, { id: 'p1', authorId: 'author', postType: 'feed', isHidden: false, hiddenReason: null, editedAt: null })
    const sections = buildPostMenuSections(items, { locale: 'es', onSelect: noop, adminLink: null })
    expect(sections.map((s) => [s.id, s.items.map((i) => (i.kind === 'action' ? [i.label, i.destructive ?? false, i.testId] : i.id))])).toEqual([
      ['main', [['Editar', false, 'post-menu-edit-p1'], ['Copiar enlace', false, 'post-menu-copy_link-p1']]],
      ['destructive', [['Eliminar', true, 'post-menu-delete-p1']]],
    ])
  })

  it('moderator: Edit in admin is a link item carrying the given element; Remove is destructive', () => {
    const items = postMenuItems({ id: 'mod', isGuest: false, tier: 'community_moderator' }, { id: 'p1', authorId: 'author', postType: 'feed', isHidden: false, hiddenReason: null, editedAt: null })
    const link = h('a', { href: '/moderation' }, 'Edit in admin')
    const mod = buildPostMenuSections(items, { locale: 'en', onSelect: noop, adminLink: link }).find((s) => s.id === 'moderation')!
    expect(mod.items.map((i) => (i.kind === 'action' ? `${i.label}${i.destructive ? '!' : ''}` : i.element === link ? 'LINK' : '?'))).toEqual(['Hold for review', 'Remove!', 'LINK'])
  })

  it('selecting an item runs its handler with its id', () => {
    const picked: string[] = []
    const items = postMenuItems({ id: 'm', isGuest: false, tier: null }, { id: 'p1', authorId: 'a', postType: 'feed', isHidden: false, hiddenReason: null, editedAt: null })
    for (const s of buildPostMenuSections(items, { locale: 'en', onSelect: (id) => picked.push(id), adminLink: null })) {
      for (const i of s.items) if (i.kind === 'action') i.onSelect()
    }
    expect(picked).toEqual(['copy_link', 'report'])
  })
})

describe('the shared post fields (create wizard + edit dialog)', () => {
  const render = (props: Partial<Parameters<typeof PostFormFields>[0]>) =>
    renderToStaticMarkup(h(PostFormFields, { postType: 'poll', draft: { ...EMPTY_DRAFT, content: 'Which day?', options: ['Sat', 'Sun'] }, onChange: noop, mode: 'edit', locale: 'en', idPrefix: 't', ...props }))

  it('after the first vote the question and options stay visible, read-only, and say why', () => {
    const html = render({ locks: { content: 'poll_voted', options: 'poll_voted', ends_at: 'poll_extend_only' } })
    expect(html).toMatch(/<input[^>]*id="t-content"[^>]*readonly=""[^>]*aria-describedby="t-content-lock"/i)
    expect(html).toContain('id="t-content-lock"')
    expect(html).toContain('Locked after the first vote')
    expect(html).not.toContain('+ Add option')
    expect(html).toContain('the deadline can only be extended')
  })

  it('an open, unvoted poll offers adding options and closing now', () => {
    const html = render({})
    expect(html).toContain('+ Add option')
    expect(html).toContain('Close the poll now')
    expect(html.toLowerCase()).not.toContain('readonly')
  })

  it('a member event asks for the venue time zone (servers-refused zones are not offered)', () => {
    const html = render({ postType: 'event_post', draft: { ...EMPTY_DRAFT, content: 'Potluck', startsAt: '2026-10-10T18:00', timeZone: 'America/Chicago' } })
    expect(html).toContain('Venue time zone')
    expect(html).toContain('value="America/Chicago" selected=""')
    expect(html).not.toContain('America/Asuncion')
  })

  it('an invalid field is marked and its message is linked', () => {
    const html = render({ postType: 'event_post', draft: { ...EMPTY_DRAFT, content: 'P', startsAt: '2026-10-10T18:00', endsAt: '2026-10-10T09:00', timeZone: 'America/Chicago' }, errors: { ends_at: { code: 'end_before_start' } } })
    expect(html).toMatch(/id="t-ends_at"[^>]*aria-invalid="true"[^>]*aria-describedby="t-ends_at-err"/)
    expect(html).toContain('The end must be after the start.')
  })

  it('category chips are toggle buttons in a labelled group, in the member’s language', () => {
    const html = render({ postType: 'seeker_request', draft: { ...EMPTY_DRAFT, content: 'x', categories: ['Housing'] }, locale: 'es' })
    expect(html).toContain('role="group" aria-labelledby="t-categories-legend"')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Vivienda</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Alimentos</)
  })

  it('after a Combine, the current text is shown under a field we both changed', () => {
    const html = render({ postType: 'feed', draft: { ...EMPTY_DRAFT, content: 'mine' }, currentText: { content: 'theirs' } })
    expect(html).toContain('Current version: theirs')
    expect(html).toMatch(/aria-describedby="t-content-current"/)
  })
})

describe('the edit-conflict comparison', () => {
  it('shows each differing field side by side, the changes marked by +/− and screen-reader text, and three choices', () => {
    const base = { ...EMPTY_DRAFT, content: 'Pantry open Sat' }
    const html = renderToStaticMarkup(
      h(EditConflictView, {
        postType: 'feed',
        locale: 'en',
        base,
        mine: { ...base, content: 'Pantry open Sat 9am' },
        theirs: { ...base, content: 'Pantry closed Sat' },
        theirsWhen: 'Oct 9, 2026, 9:53 PM',
        choice: 'keep_mine',
        onChoice: noop,
        idPrefix: 'c',
      }),
    )
    expect(html).toContain('This post changed while you were editing')
    expect(html).toContain('Your edit')
    expect(html).toContain('Current version')
    expect(html).toContain('<ins class=')
    expect(html).toContain('<span class="sr-only">added: </span> 9am')
    expect(html).toContain('<span class="sr-only">removed: </span>open')
    expect(html.match(/type="radio"/g)).toHaveLength(3)
  })
})

describe('the public edit history', () => {
  const entries = buildHistory(
    { version: 3, content: 'Free bread at 6', imageUrl: null, createdAt: '2026-10-01T10:00:00Z', editedAt: '2026-10-02T10:00:00Z' },
    [
      postRevisionItem({ id: 7, version: 1, edited_at: '2026-10-02T10:00:00Z', reason: null, fields_changed: ['content'], snapshot: { content: 'Free bread at 5' }, redacted_at: null, redactor_role: null }),
    ],
  )

  it('newest first, attributed by role (never a name), with a +/− diff', () => {
    const html = renderToStaticMarkup(h(HistoryList, { entries, locale: 'en', postType: 'feed', redactAs: null, tz: 'UTC' }))
    expect(html.indexOf('Current version')).toBeLessThan(html.indexOf('Original'))
    expect(html).toContain('Edited by the author')
    expect(html).toContain('Posted by the author')
    expect(html).toContain('<span class="sr-only">added: </span>6')
    expect(html).not.toContain('Remove private details')
  })

  it('the author (or a platform admin) can remove private details from earlier versions only', () => {
    const html = renderToStaticMarkup(h(HistoryList, { entries, locale: 'en', postType: 'feed', redactAs: 'author', onRedact: noop, tz: 'UTC' }))
    expect(html).toContain('data-testid="history-redact-1"')
    expect(html).not.toContain('data-testid="history-redact-3"')
  })

  it('a redacted version shows only who removed details', () => {
    const redacted = buildHistory(
      { version: 2, content: 'now', imageUrl: null, createdAt: '2026-10-01T10:00:00Z', editedAt: null },
      [postRevisionItem({ id: 9, version: 1, edited_at: '2026-10-02T10:00:00Z', reason: null, fields_changed: null, snapshot: null, redacted_at: '2026-10-03T00:00:00Z', redactor_role: 'platform_admin' })],
    )
    const html = renderToStaticMarkup(h(HistoryList, { entries: redacted, locale: 'en', postType: 'feed', redactAs: 'author', onRedact: noop, tz: 'UTC' }))
    expect(html).toContain('A FEED admin removed private details from this version.')
    expect(html).not.toContain('history-redact-1')
  })
})

// Release 1 marks every still-English piece of the (translated) feed with lang="en" dir="ltr" so
// assistive tech switches voice; a piece translated through a 14-locale dictionary must not carry it.
describe('language marking: English-only pieces say so; translated pieces do not', () => {
  const es = (post: Post, o: Partial<FeedPostCardProps> = {}) => card(post, { locale: 'es', ...o })

  it('the translated card itself carries no lang="en"; its English-only opt-in row and petition embed do', () => {
    const plain = es(rowToPost(row({ edited_at: '2026-10-09T21:53:18Z' }), { isLiked: false }))
    expect(plain).not.toContain('lang="en"')
    const capped = es(rowToPost(row({ max_seekers: 5, slots_remaining: 2 }), { isLiked: false }))
    expect(capped).toMatch(/<div lang="en" dir="ltr" data-testid="capacity-row-p1"/)
    const petition = es(rowToPost(row({ post_type: 'petition', petition_id: 'pt' }), { isLiked: false }), {
      petitionEmbed: { title: 'T', summary: 'S', signatureCount: 1, targetSignatures: 10, hasSigned: false, isSigning: false },
    })
    expect(petition).toMatch(/data-testid="petition-embed-p1" lang="en" dir="ltr"/)
  })

  it('the shared fields, the conflict comparison and the history list are translated: no lang="en"', () => {
    const fields = renderToStaticMarkup(h(PostFormFields, { postType: 'event_post', draft: { ...EMPTY_DRAFT, content: 'x', startsAt: '2026-10-10T18:00', timeZone: 'America/Chicago' }, onChange: noop, mode: 'edit', locale: 'es', idPrefix: 'l' }))
    const base = { ...EMPTY_DRAFT, content: 'a' }
    const conflict = renderToStaticMarkup(h(EditConflictView, { postType: 'feed', locale: 'es', base, mine: { ...base, content: 'b' }, theirs: { ...base, content: 'c' }, theirsWhen: null, choice: 'combine', onChoice: noop, idPrefix: 'l' }))
    const history = renderToStaticMarkup(h(HistoryList, { entries: buildHistory({ version: 1, content: 'a', imageUrl: null, createdAt: '2026-10-01T00:00:00Z', editedAt: null }, []), locale: 'es', postType: 'feed', redactAs: null, tz: 'UTC' }))
    for (const html of [fields, conflict, history]) expect(html).not.toContain('lang="en"')
    expect(fields).toContain('Zona horaria del lugar')
    expect(conflict).toContain('Tu edición')
    expect(history).toContain('Versión actual (nunca editada)')
  })

  it('the English-only photo picker is wrapped with lang="en" wherever a translated form uses it', () => {
    const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8')
    for (const rel of ['../panels/feed-panel.tsx', '../panels/post-type-wizard.tsx', './post-edit-dialog.tsx']) {
      const src = read(rel)
      const uses = src.match(/<PostImagePickerField/g)?.length ?? 0
      const wrapped = src.match(/<div lang="en" dir="ltr" data-english-only="photo-picker">\s*<PostImagePickerField/g)?.length ?? 0
      expect([rel, wrapped]).toEqual([rel, uses])
    }
  })
})
