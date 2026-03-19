import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import {
  CommunityFeedCursor,
  CommunityFeedPage,
  CommunityFeedService,
  CommunityProfileDirectoryEntry
} from '../../core/community-feed.service';
import { CommunityComment, CommunityPost } from '../../core/types';

interface DayGroup {
  day: string;
  posts: CommunityPost[];
}

@Injectable({
  providedIn: 'root'
})
export class CommunityFacadeService {
  readonly pageSize = 10;
  readonly posts = signal<CommunityPost[]>([]);
  readonly commentsByPost = signal<Record<string, CommunityComment[]>>({});
  readonly profiles = signal<Record<string, CommunityProfileDirectoryEntry>>({});
  readonly photoSrcMap = signal<Record<string, string>>({});
  readonly commentInputs = signal<Record<string, string>>({});
  readonly loadingInitial = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);
  readonly nextCursor = signal<CommunityFeedCursor | null>(null);
  readonly scrollY = signal(0);
  readonly groupedPosts = computed<DayGroup[]>(() => {
    const groups = new Map<string, CommunityPost[]>();
    for (const post of this.posts()) {
      if (!groups.has(post.day)) {
        groups.set(post.day, []);
      }
      groups.get(post.day)?.push(post);
    }

    return Array.from(groups.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([day, dayPosts]) => ({ day, posts: dayPosts }));
  });

  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly communityFeed = inject(CommunityFeedService);
  private readonly pendingFreshHead = signal(false);
  private active = false;
  private freshnessInterval: ReturnType<typeof setInterval> | null = null;
  private lastUserId: string | null | undefined = undefined;

  constructor() {
    effect(() => {
      const userId = this.authService.user()?.id ?? null;
      if (this.lastUserId === undefined) {
        this.lastUserId = userId;
        return;
      }

      if (userId === this.lastUserId) {
        return;
      }

      this.lastUserId = userId;
      this.stopFreshnessChecks();
      this.reset();
    });
  }

  async activate(today: string): Promise<void> {
    this.active = true;

    const user = this.authService.user();
    if (!user) {
      return;
    }

    if (this.pendingFreshHead()) {
      const cachedPage = this.communityFeed.getCachedFirstPage(user.id);
      if (cachedPage) {
        this.applyPage(cachedPage, 'replace');
      }
      this.pendingFreshHead.set(false);
    }

    if (this.posts().length === 0) {
      await this.loadInitial(today);
    }

    this.startFreshnessChecks(user.id);
  }

  deactivate(scrollY: number): void {
    this.scrollY.set(Math.max(0, Math.round(scrollY)));
    this.active = false;
    this.stopFreshnessChecks();
  }

  async loadInitial(today: string, forceRefresh = false): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.loadingInitial.set(true);
    try {
      await this.communityFeed.ensureProteinMilestonePost(user.id, today);
      const cachedPage = !forceRefresh ? this.communityFeed.getCachedFirstPage(user.id) : null;
      const page = cachedPage
        || await this.communityFeed.fetchFeedPage(null, this.pageSize, {
          userId: user.id,
          forceRefresh,
          allowCachedFirstPage: true
        });
      this.applyPage(page, 'replace');
    } finally {
      this.loadingInitial.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (!this.hasMore() || this.loadingInitial() || this.loadingMore()) {
      return;
    }

    this.loadingMore.set(true);
    try {
      const page = await this.communityFeed.fetchFeedPage(this.nextCursor(), this.pageSize, {
        allowCachedFirstPage: false
      });
      this.applyPage(page, 'append');
    } finally {
      this.loadingMore.set(false);
    }
  }

  setCommentInput(postId: string, value: string): void {
    this.commentInputs.update(current => ({ ...current, [postId]: value }));
  }

  async submitComment(postId: string): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const text = (this.commentInputs()[postId] || '').trim();
    if (!text) {
      throw new Error('Kommentar darf nicht leer sein.');
    }

    const { data, error } = await this.supabaseService.client
      .from('community_comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        comment_text: text
      })
      .select('*')
      .single();

    if (error || !data) {
      throw error || new Error('Kommentar konnte nicht gespeichert werden');
    }

    this.setCommentInput(postId, '');
    this.commentsByPost.update(current => {
      const existing = current[postId] || [];
      return {
        ...current,
        [postId]: [...existing, data as CommunityComment]
      };
    });
  }

  async createGymPost(today: string, note: string, photo: File | null): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    await this.communityFeed.createGymCheckinPost(user.id, today, note, photo);
    await this.refreshFirstPage(user.id);
  }

  async deletePost(postId: string): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const { error } = await this.supabaseService.client
      .from('community_posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    this.posts.update(current => current.filter(post => post.id !== postId));
    this.commentsByPost.update(current => {
      const { [postId]: removed, ...rest } = current;
      void removed;
      return rest;
    });
    this.photoSrcMap.update(current => {
      const { [postId]: removed, ...rest } = current;
      void removed;
      return rest;
    });

    await this.refreshFirstPage(user.id);
  }

  private async refreshFirstPage(userId: string): Promise<void> {
    const page = await this.communityFeed.fetchFeedPage(null, this.pageSize, {
      userId,
      forceRefresh: true,
      allowCachedFirstPage: false
    });
    this.communityFeed.setCachedFirstPage(userId, page);
    this.applyPage(page, 'replace');
  }

  private applyPage(page: CommunityFeedPage, mode: 'replace' | 'append'): void {
    if (mode === 'replace') {
      this.posts.set(page.posts);
      this.commentsByPost.set(page.commentsByPost);
      this.profiles.set(page.profiles);
      this.photoSrcMap.set(page.photoSrcMap);
      this.nextCursor.set(page.nextCursor);
      this.hasMore.set(page.hasMore);
      return;
    }

    const existingIds = new Set(this.posts().map(post => post.id));
    const nextPosts = [...this.posts()];
    for (const post of page.posts) {
      if (!existingIds.has(post.id)) {
        existingIds.add(post.id);
        nextPosts.push(post);
      }
    }

    this.posts.set(nextPosts);
    this.commentsByPost.update(current => ({ ...current, ...page.commentsByPost }));
    this.profiles.update(current => ({ ...current, ...page.profiles }));
    this.photoSrcMap.update(current => ({ ...current, ...page.photoSrcMap }));
    this.nextCursor.set(page.nextCursor);
    this.hasMore.set(page.hasMore);
  }

  private currentHead(): CommunityFeedCursor | null {
    const firstPost = this.posts()[0] || null;
    if (!firstPost) {
      return null;
    }

    return {
      id: firstPost.id,
      createdAt: firstPost.created_at
    };
  }

  private startFreshnessChecks(userId: string): void {
    this.stopFreshnessChecks();
    this.freshnessInterval = setInterval(() => {
      void this.runFreshnessCheck(userId);
    }, 60_000);
  }

  private stopFreshnessChecks(): void {
    if (!this.freshnessInterval) {
      return;
    }

    clearInterval(this.freshnessInterval);
    this.freshnessInterval = null;
  }

  private async runFreshnessCheck(userId: string): Promise<void> {
    if (!this.active || typeof document === 'undefined' || document.visibilityState !== 'visible') {
      return;
    }

    const hasNewPosts = await this.communityFeed.checkForNewPosts(userId, this.currentHead(), this.pageSize);
    if (hasNewPosts) {
      this.pendingFreshHead.set(true);
    }
  }

  reset(): void {
    this.posts.set([]);
    this.commentsByPost.set({});
    this.profiles.set({});
    this.photoSrcMap.set({});
    this.commentInputs.set({});
    this.loadingInitial.set(false);
    this.loadingMore.set(false);
    this.hasMore.set(true);
    this.nextCursor.set(null);
    this.scrollY.set(0);
    this.pendingFreshHead.set(false);
    this.active = false;
  }
}
