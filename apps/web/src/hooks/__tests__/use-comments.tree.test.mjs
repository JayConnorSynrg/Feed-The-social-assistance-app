/**
 * use-comments.tree.test.mjs
 *
 * Unit tests for the buildCommentTree pure function.
 * Tests the parent_id→nested tree transformation.
 * Uses node:test — no React harness needed (pure function).
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

// ---------------------------------------------------------------------------
// Inline the pure function (mirrors apps/web/src/hooks/use-comments.ts)
// Cannot import directly: use-comments.ts has 'use client' + TypeScript syntax +
// @/ path aliases — none of which are resolvable from a plain .mjs without a
// bundler/transpiler. Inline copy kept intentionally; kept in sync manually.
// ---------------------------------------------------------------------------

/**
 * @param {Array} flat
 * @returns {Array}
 */
function buildCommentTree(flat) {
  const map = new Map()
  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] })
  }

  const roots = []
  for (const c of map.values()) {
    if (c.parent_id === null || c.parent_id === undefined) {
      roots.push(c)
    } else {
      const parent = map.get(c.parent_id)
      if (parent) {
        parent.replies.push(c)
      } else {
        // Orphaned reply — surface as root
        roots.push(c)
      }
    }
  }

  const sortByDate = (a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

  roots.sort(sortByDate)
  for (const root of roots) {
    root.replies.sort(sortByDate)
  }

  return roots
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeComment(id, parent_id, created_at) {
  return {
    id,
    post_id: 'post-1',
    user_id: 'user-1',
    content: `Comment ${id}`,
    parent_id: parent_id ?? null,
    is_hidden: false,
    created_at: created_at ?? '2026-06-04T10:00:00.000Z',
    updated_at: '2026-06-04T10:00:00.000Z',
    user: null,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildCommentTree', () => {
  test('empty input returns empty array', () => {
    const result = buildCommentTree([])
    assert.deepEqual(result, [])
  })

  test('flat comments (no parent_id) all appear at root', () => {
    const flat = [
      makeComment('a', null, '2026-06-04T10:00:00.000Z'),
      makeComment('b', null, '2026-06-04T10:01:00.000Z'),
      makeComment('c', null, '2026-06-04T10:02:00.000Z'),
    ]
    const tree = buildCommentTree(flat)
    assert.equal(tree.length, 3, 'should have 3 root comments')
    assert.equal(tree[0].id, 'a', 'sorted by created_at ascending')
    assert.equal(tree[1].id, 'b')
    assert.equal(tree[2].id, 'c')
    for (const root of tree) {
      assert.deepEqual(root.replies, [], 'no replies on flat comments')
    }
  })

  test('reply is nested under its parent', () => {
    const flat = [
      makeComment('root', null, '2026-06-04T10:00:00.000Z'),
      makeComment('reply1', 'root', '2026-06-04T10:01:00.000Z'),
    ]
    const tree = buildCommentTree(flat)
    assert.equal(tree.length, 1, 'only one root')
    assert.equal(tree[0].id, 'root')
    assert.equal(tree[0].replies.length, 1, 'one reply nested')
    assert.equal(tree[0].replies[0].id, 'reply1')
  })

  test('multiple replies under same parent sorted by created_at', () => {
    const flat = [
      makeComment('root', null, '2026-06-04T09:00:00.000Z'),
      makeComment('r2', 'root', '2026-06-04T10:02:00.000Z'),
      makeComment('r1', 'root', '2026-06-04T10:01:00.000Z'),
    ]
    const tree = buildCommentTree(flat)
    assert.equal(tree[0].replies.length, 2)
    assert.equal(tree[0].replies[0].id, 'r1', 'earlier reply first')
    assert.equal(tree[0].replies[1].id, 'r2')
  })

  test('orphaned reply (parent hidden/missing) surfaces as root', () => {
    const flat = [
      makeComment('orphan', 'nonexistent-parent', '2026-06-04T10:00:00.000Z'),
    ]
    const tree = buildCommentTree(flat)
    assert.equal(tree.length, 1, 'orphan becomes root')
    assert.equal(tree[0].id, 'orphan')
  })
})
