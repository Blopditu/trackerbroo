import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CommunityFeedService } from './community-feed.service';
import { QueryCacheService } from './query-cache.service';
import { SupabaseService } from './supabase.service';
import { LibraryDataService } from './library-data.service';
import { CommunityPost } from './types';

class QueryCacheStub {
  private readonly store = new Map<string, unknown>();

  readonly getOrLoad = vi.fn(async <T>(options: {
    key: string;
    loader: () => Promise<T>;
    forceRefresh?: boolean;
  }) => {
    if (!options.forceRefresh && this.store.has(options.key)) {
      return { value: this.store.get(options.key) as T, source: 'cache' as const };
    }

    const value = await options.loader();
    this.store.set(options.key, value);
    return { value, source: 'network' as const };
  });

  readonly set = vi.fn((key: string, value: unknown) => {
    this.store.set(key, value);
  });

  readonly invalidate = vi.fn((key: string) => {
    this.store.delete(key);
  });

  readonly getFresh = vi.fn((key: string) => this.store.get(key) ?? null);
  readonly getStale = vi.fn((key: string) => this.store.get(key) ?? null);
}

function createSupabaseClientMock(posts: CommunityPost[], newestPost = posts[0]) {
  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === 'community_posts') {
          return {
            select: vi.fn((selector: string) => {
              if (selector === 'id,created_at') {
                return {
                  order: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn(async () => ({
                          data: newestPost ? { id: newestPost.id, created_at: newestPost.created_at } : null,
                          error: null
                        }))
                      }))
                    }))
                  }))
                };
              }

              const result = { data: posts, error: null };
              const queryResult = {
                or: vi.fn(async () => result),
                then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve)
              };

              return {
                order: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => queryResult)
                  })),
                })),
              };
            })
          };
        }

        if (table === 'community_comments') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                order: vi.fn(async () => ({ data: [], error: null }))
              }))
            }))
          };
        }

        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({ data: [], error: null }))
            }))
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } }))
        }))
      }
    }
  };
}

describe('CommunityFeedService', () => {
  const posts: CommunityPost[] = [{
    id: 'post-2',
    user_id: 'user-2',
    post_type: 'gym_checkin',
    day: '2026-03-19',
    note: 'Lifted',
    summary: null,
    photo_url: null,
    created_at: '2026-03-19T10:00:00Z'
  }];

  let service: CommunityFeedService;
  let queryCache: QueryCacheStub;

  beforeEach(() => {
    queryCache = new QueryCacheStub();
    const supabase = createSupabaseClientMock(posts);

    TestBed.configureTestingModule({
      providers: [
        CommunityFeedService,
        { provide: QueryCacheService, useValue: queryCache as unknown as QueryCacheService },
        { provide: SupabaseService, useValue: { client: supabase.client } },
        { provide: LibraryDataService, useValue: {} }
      ]
    });

    service = TestBed.inject(CommunityFeedService);
  });

  it('caches the first community page for the standard feed window', async () => {
    const first = await service.fetchFeedPage(null, 10, { userId: 'user-1' });
    const second = await service.fetchFeedPage(null, 10, { userId: 'user-1' });

    expect(first.posts).toEqual(posts);
    expect(second.posts).toEqual(posts);
    expect(queryCache.getOrLoad).toHaveBeenCalledWith(expect.objectContaining({
      key: 'community:feed:first-page:user-1'
    }));
    expect(queryCache.getFresh('community:feed:first-page:user-1')).toEqual(expect.objectContaining({ posts }));
  });

  it('warms the first-page cache when newer posts exist', async () => {
    const warmed = await service.checkForNewPosts(
      'user-1',
      { id: 'post-1', createdAt: '2026-03-18T10:00:00Z' },
      10
    );

    expect(warmed).toBe(true);
    expect(queryCache.set).toHaveBeenCalledWith(
      'community:feed:first-page:user-1',
      expect.objectContaining({ posts }),
      expect.any(Number)
    );
  });
});
