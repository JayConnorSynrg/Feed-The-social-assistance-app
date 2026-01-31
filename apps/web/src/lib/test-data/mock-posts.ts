// apps/web/src/lib/test-data/mock-posts.ts
// Mock social feed data for end-to-end testing

export interface MockPost {
  id: string
  user_id: string
  content: string
  image_url: string | null
  is_pinned: boolean
  is_hidden: boolean
  created_at: string
  likes_count: number
  comments_count: number
}

export interface MockComment {
  id: string
  post_id: string
  user_id: string
  content: string
  parent_id: string | null
  created_at: string
}

// Posts from various mock users
export const MOCK_POSTS: MockPost[] = [
  {
    id: 'post-001',
    user_id: 'test-user-001', // Maria
    content: 'Just found out about FEED and I\'m so grateful! Finally got help applying for SNAP benefits. The autofill feature saved me so much time. Thank you to this amazing community! #MutualAid #FeedApp',
    image_url: null,
    is_pinned: true,
    is_hidden: false,
    created_at: '2026-01-29T14:30:00.000Z',
    likes_count: 24,
    comments_count: 5,
  },
  {
    id: 'post-002',
    user_id: 'test-user-003', // Sarah
    content: 'Reminder for seniors in Miami: The Senior Center on 1st Street has free benefits counseling every Tuesday! They helped me understand my Medicare options. Call (305) 416-1200 to schedule.',
    image_url: null,
    is_pinned: false,
    is_hidden: false,
    created_at: '2026-01-28T10:15:00.000Z',
    likes_count: 18,
    comments_count: 3,
  },
  {
    id: 'post-003',
    user_id: 'test-user-002', // James
    content: 'Update on my job search journey: Thanks to the Chicago Job Center, I got help with my resume and had two interviews this week! Never give up. Resources are out there.',
    image_url: null,
    is_pinned: false,
    is_hidden: false,
    created_at: '2026-01-27T16:45:00.000Z',
    likes_count: 42,
    comments_count: 8,
  },
  {
    id: 'post-004',
    user_id: 'test-user-004', // David
    content: 'Fellow students: NYU has a food pantry at Washington Square! No questions asked. Also, the emergency grants program is accepting applications. Don\'t struggle alone.',
    image_url: null,
    is_pinned: false,
    is_hidden: false,
    created_at: '2026-01-26T09:00:00.000Z',
    likes_count: 31,
    comments_count: 6,
  },
  {
    id: 'post-005',
    user_id: 'test-user-001', // Maria
    content: 'Food distribution tomorrow at LA Regional Food Bank! They\'re giving out fresh produce and dairy. Bring your own bags. No ID required. Spread the word! 📍1734 E 41st Street',
    image_url: null,
    is_pinned: false,
    is_hidden: false,
    created_at: '2026-01-25T20:00:00.000Z',
    likes_count: 56,
    comments_count: 12,
  },
  {
    id: 'post-006',
    user_id: 'test-user-003', // Sarah
    content: 'PSA: If you\'re turning 65, start your Medicare enrollment 3 months BEFORE your birthday! I learned this the hard way. The AI chat feature here actually helped me understand all my options.',
    image_url: null,
    is_pinned: false,
    is_hidden: false,
    created_at: '2026-01-24T11:30:00.000Z',
    likes_count: 29,
    comments_count: 4,
  },
  {
    id: 'post-007',
    user_id: 'test-user-002', // James
    content: 'Just submitted my SNAP application through FEED. The process was so much easier than I expected. Special thanks to whoever created those step-by-step guides. You\'re making a real difference.',
    image_url: null,
    is_pinned: false,
    is_hidden: false,
    created_at: '2026-01-23T15:20:00.000Z',
    likes_count: 38,
    comments_count: 7,
  },
  {
    id: 'post-008',
    user_id: 'test-user-005', // Admin
    content: '📢 Community Update: We\'ve added 15 new verified resources to the map this week! Check out the new mental health services in your area. Remember, you can also submit resources you know about to help others.',
    image_url: null,
    is_pinned: true,
    is_hidden: false,
    created_at: '2026-01-22T12:00:00.000Z',
    likes_count: 67,
    comments_count: 15,
  },
]

export const MOCK_COMMENTS: MockComment[] = [
  // Comments on Maria's first post
  {
    id: 'comment-001',
    post_id: 'post-001',
    user_id: 'test-user-003',
    content: 'So happy for you! The autofill feature is a game-changer.',
    parent_id: null,
    created_at: '2026-01-29T14:45:00.000Z',
  },
  {
    id: 'comment-002',
    post_id: 'post-001',
    user_id: 'test-user-002',
    content: 'Welcome to the community! Feel free to ask questions anytime.',
    parent_id: null,
    created_at: '2026-01-29T15:00:00.000Z',
  },
  {
    id: 'comment-003',
    post_id: 'post-001',
    user_id: 'test-user-004',
    content: 'How long did it take for your application to be processed?',
    parent_id: null,
    created_at: '2026-01-29T15:30:00.000Z',
  },
  {
    id: 'comment-004',
    post_id: 'post-001',
    user_id: 'test-user-001',
    content: '@David - I\'m still waiting but they said 30 days typically. I\'ll update when I hear back!',
    parent_id: 'comment-003',
    created_at: '2026-01-29T16:00:00.000Z',
  },

  // Comments on James's job post
  {
    id: 'comment-005',
    post_id: 'post-003',
    user_id: 'test-user-001',
    content: 'That\'s amazing progress! Good luck with the interviews!',
    parent_id: null,
    created_at: '2026-01-27T17:00:00.000Z',
  },
  {
    id: 'comment-006',
    post_id: 'post-003',
    user_id: 'test-user-003',
    content: 'The job centers are such a valuable resource. Wishing you the best!',
    parent_id: null,
    created_at: '2026-01-27T17:30:00.000Z',
  },

  // Comments on food distribution post
  {
    id: 'comment-007',
    post_id: 'post-005',
    user_id: 'test-user-002',
    content: 'What time does it start?',
    parent_id: null,
    created_at: '2026-01-25T20:15:00.000Z',
  },
  {
    id: 'comment-008',
    post_id: 'post-005',
    user_id: 'test-user-001',
    content: '8 AM! Get there early, lines can be long.',
    parent_id: 'comment-007',
    created_at: '2026-01-25T20:20:00.000Z',
  },
]

// Helper functions
export function getPostsByUser(userId: string): MockPost[] {
  return MOCK_POSTS.filter((p) => p.user_id === userId && !p.is_hidden)
}

export function getFeedPosts(limit: number = 20): MockPost[] {
  return MOCK_POSTS.filter((p) => !p.is_hidden)
    .sort((a, b) => {
      // Pinned posts first, then by date
      if (a.is_pinned && !b.is_pinned) return -1
      if (!a.is_pinned && b.is_pinned) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, limit)
}

export function getCommentsForPost(postId: string): MockComment[] {
  return MOCK_COMMENTS.filter((c) => c.post_id === postId).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}
