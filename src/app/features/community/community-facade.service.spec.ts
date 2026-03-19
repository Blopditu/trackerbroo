import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CommunityFacadeService } from './community-facade.service';
import { AuthService } from '../../core/auth.service';
import { CommunityFeedService } from '../../core/community-feed.service';
import { SupabaseService } from '../../core/supabase.service';
import { CommunityPost } from '../../core/types';

describe('CommunityFacadeService', () => {
  const firstPage = {
    posts: [{
      id: 'post-1',
      user_id: 'user-2',
      post_type: 'gym_checkin' as const,
      day: '2026-03-19',
      note: 'Old post',
      summary: null,
      photo_url: null,
      created_at: '2026-03-19T09:00:00Z'
    }],
    commentsByPost: {},
    profiles: {},
    photoSrcMap: {},
    nextCursor: { id: 'post-1', createdAt: '2026-03-19T09:00:00Z' },
    hasMore: true,
    newestCursor: { id: 'post-1', createdAt: '2026-03-19T09:00:00Z' },
    fetchedAt: '2026-03-19T09:00:00Z'
  };

  const refreshedFirstPage = {
    ...firstPage,
    posts: [{
      id: 'post-2',
      user_id: 'user-3',
      post_type: 'gym_checkin' as const,
      day: '2026-03-19',
      note: 'New post',
      summary: null,
      photo_url: null,
      created_at: '2026-03-19T10:00:00Z'
    }],
    nextCursor: { id: 'post-2', createdAt: '2026-03-19T10:00:00Z' },
    newestCursor: { id: 'post-2', createdAt: '2026-03-19T10:00:00Z' },
    fetchedAt: '2026-03-19T10:00:00Z'
  };

  let facade: CommunityFacadeService;
  let authUser: ReturnType<typeof signal<{ id: string } | null>>;
  let cachedPage: typeof firstPage | null;
  let communityFeed: {
    ensureProteinMilestonePost: ReturnType<typeof vi.fn>;
    getCachedFirstPage: ReturnType<typeof vi.fn>;
    fetchFeedPage: ReturnType<typeof vi.fn>;
    createGymCheckinPost: ReturnType<typeof vi.fn>;
    checkForNewPosts: ReturnType<typeof vi.fn>;
    setCachedFirstPage: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    authUser = signal<{ id: string } | null>({ id: 'user-1' });
    cachedPage = null;

    communityFeed = {
      ensureProteinMilestonePost: vi.fn().mockResolvedValue(undefined),
      getCachedFirstPage: vi.fn(() => cachedPage),
      fetchFeedPage: vi.fn().mockResolvedValue(firstPage),
      createGymCheckinPost: vi.fn().mockResolvedValue(undefined),
      checkForNewPosts: vi.fn().mockResolvedValue(false),
      setCachedFirstPage: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        CommunityFacadeService,
        { provide: AuthService, useValue: { user: authUser } },
        { provide: CommunityFeedService, useValue: communityFeed as unknown as CommunityFeedService },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              from: (table: string) => {
                if (table === 'community_comments') {
                  return {
                    insert: () => ({
                      select: () => ({
                        single: async () => ({
                          data: {
                            id: 'comment-1',
                            post_id: 'post-1',
                            user_id: 'user-1',
                            comment_text: 'Nice',
                            created_at: '2026-03-19T10:05:00Z'
                          },
                          error: null
                        })
                      })
                    })
                  };
                }

                if (table === 'community_posts') {
                  return {
                    delete: () => ({
                      eq: () => ({
                        eq: async () => ({ error: null })
                      })
                    })
                  };
                }

                throw new Error(`Unexpected table ${table}`);
              }
            }
          }
        }
      ]
    });

    facade = TestBed.inject(CommunityFacadeService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hydrates once and reuses in-memory feed state on later activations', async () => {
    await facade.activate('2026-03-19');
    facade.deactivate(180);
    await facade.activate('2026-03-19');

    expect(communityFeed.fetchFeedPage).toHaveBeenCalledTimes(1);
    expect(facade.posts()).toEqual(firstPage.posts);
    expect(facade.scrollY()).toBe(180);
  });

  it('warms newer posts in the background and applies them on the next activation', async () => {
    cachedPage = firstPage;
    communityFeed.checkForNewPosts.mockResolvedValue(true);

    await facade.activate('2026-03-19');
    cachedPage = refreshedFirstPage;

    await vi.advanceTimersByTimeAsync(60_000);

    expect(facade.posts()).toEqual(firstPage.posts);

    facade.deactivate(0);
    await facade.activate('2026-03-19');

    expect(facade.posts()).toEqual(refreshedFirstPage.posts);
  });

  it('patches comment state locally without reloading the feed', async () => {
    await facade.activate('2026-03-19');
    facade.setCommentInput('post-1', 'Nice');

    await facade.submitComment('post-1');

    expect(facade.commentInputs()['post-1']).toBe('');
    expect(facade.commentsByPost()['post-1']).toEqual([
      expect.objectContaining({ comment_text: 'Nice' })
    ]);
    expect(communityFeed.fetchFeedPage).toHaveBeenCalledTimes(1);
  });
});
