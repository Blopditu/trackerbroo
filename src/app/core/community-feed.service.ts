import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CommunityComment, CommunityPost, DailySummary, LogEntry, Profile } from './types';
import { LibraryDataService } from './library-data.service';
import { QueryCacheService } from './query-cache.service';

export type CommunityProfileDirectoryEntry = Pick<Profile, 'user_id' | 'display_name' | 'avatar_url'>;

export interface CommunityFeedPage {
  posts: CommunityPost[];
  commentsByPost: Record<string, CommunityComment[]>;
  profiles: Record<string, CommunityProfileDirectoryEntry>;
  photoSrcMap: Record<string, string>;
  nextOffset: number;
  hasMore: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CommunityFeedService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly libraryDataService = inject(LibraryDataService);
  private readonly queryCache = inject(QueryCacheService);

  async fetchFeedPage(offset: number, pageSize: number): Promise<CommunityFeedPage> {
    const from = offset;
    const to = from + pageSize - 1;

    const { data: postsData, error: postsError } = await this.supabaseService.client
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (postsError) {
      throw postsError;
    }

    const posts = (postsData || []) as CommunityPost[];
    const commentsByPost = await this.loadComments(posts);
    const profiles = await this.loadProfiles(posts, commentsByPost);
    const photoSrcMap = await this.resolvePostPhotoUrls(posts);

    return {
      posts,
      commentsByPost,
      profiles,
      photoSrcMap,
      nextOffset: from + posts.length,
      hasMore: posts.length === pageSize
    };
  }

  async ensureProteinMilestonePost(
    userId: string,
    day: string,
    initialSummary?: Pick<DailySummary, 'protein' | 'kcal' | 'carbs' | 'fat'> | null
  ): Promise<void> {
    const markerKey = this.getProteinMilestoneCacheKey(userId, day);
    if (this.queryCache.getFresh<boolean>(markerKey)) {
      return;
    }

    let summaryData = initialSummary;
    if (!summaryData) {
      const { data } = await this.supabaseService.client
        .from('daily_summaries')
        .select('protein,kcal,carbs,fat')
        .eq('owner_id', userId)
        .is('group_id', null)
        .eq('day', day)
        .maybeSingle();
      summaryData = data as Pick<DailySummary, 'protein' | 'kcal' | 'carbs' | 'fat'> | null;
    }

    const protein = Number(summaryData?.protein || 0);
    if (protein < 100) {
      return;
    }

    const wasExisting = await this.hasExistingPost(userId, day, 'protein_milestone');

    const { data: entriesData } = await this.supabaseService.client
      .from('log_entries')
      .select('*')
      .eq('owner_id', userId)
      .is('group_id', null)
      .eq('day', day)
      .order('protein', { ascending: false })
      .limit(20);

    const entries = (entriesData || []) as LogEntry[];
    const library = await this.libraryDataService.loadLibrary(userId, { allowStaleOnError: true });
    const nameMap = new Map<string, string>();

    for (const ingredient of library.ingredients) {
      nameMap.set(ingredient.id, ingredient.name);
    }
    for (const meal of library.meals) {
      nameMap.set(meal.id, meal.name);
    }

    const foods = entries
      .slice(0, 4)
      .map(entry => `${nameMap.get(entry.ref_id) || 'Unbekannt'} (${Number(entry.protein || 0).toFixed(1)}g)`);

    await this.supabaseService.client.from('community_posts').upsert(
      {
        user_id: userId,
        post_type: 'protein_milestone',
        day,
        note: 'Tagesziel Protein erreicht.',
        summary: {
          protein,
          carbs: Number(summaryData?.carbs || 0),
          fat: Number(summaryData?.fat || 0),
          kcal: Number(summaryData?.kcal || 0),
          foods
        },
        photo_url: null
      },
      { onConflict: 'user_id,day,post_type' }
    );

    this.queryCache.set(markerKey, true, 1000 * 60 * 60 * 6);

    if (!wasExisting) {
      void this.notifyCommunityPost(userId, day, 'protein_milestone');
    }
  }

  async createGymCheckinPost(userId: string, day: string, note: string, photo: File | null): Promise<void> {
    const wasExisting = await this.hasExistingPost(userId, day, 'gym_checkin');
    let photoUrl: string | null = null;
    if (photo) {
      photoUrl = await this.uploadImage(photo, 'gym-checkins', userId);
    }

    const { error } = await this.supabaseService.client
      .from('community_posts')
      .upsert(
        {
          user_id: userId,
          post_type: 'gym_checkin',
          day,
          note: note.trim() || null,
          summary: null,
          photo_url: photoUrl
        },
        { onConflict: 'user_id,day,post_type' }
      );

    if (error) {
      throw error;
    }

    if (!wasExisting) {
      void this.notifyCommunityPost(userId, day, 'gym_checkin');
    }
  }

  async createStepsMilestonePost(userId: string, day: string, steps: number, target: number): Promise<void> {
    const wasExisting = await this.hasExistingPost(userId, day, 'steps_milestone');
    const { error } = await this.supabaseService.client
      .from('community_posts')
      .upsert(
        {
          user_id: userId,
          post_type: 'steps_milestone',
          day,
          note: 'Schrittziel erreicht.',
          summary: {
            steps,
            target
          },
          photo_url: null
        },
        { onConflict: 'user_id,day,post_type' }
      );

    if (error) {
      throw error;
    }

    this.queryCache.set(this.getStepsMilestoneCacheKey(userId, day), true, 1000 * 60 * 60 * 6);

    if (!wasExisting) {
      void this.notifyCommunityPost(userId, day, 'steps_milestone');
    }
  }

  invalidateFeedCache(userId: string, day: string): void {
    this.queryCache.invalidate(this.getProteinMilestoneCacheKey(userId, day));
    this.queryCache.invalidate(this.getStepsMilestoneCacheKey(userId, day));
  }

  private async loadComments(posts: CommunityPost[]): Promise<Record<string, CommunityComment[]>> {
    const postIds = posts.map(post => post.id);
    if (postIds.length === 0) {
      return {};
    }

    const { data: commentsData, error } = await this.supabaseService.client
      .from('community_comments')
      .select('*')
      .in('post_id', postIds)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const grouped: Record<string, CommunityComment[]> = {};
    for (const comment of (commentsData || []) as CommunityComment[]) {
      if (!grouped[comment.post_id]) {
        grouped[comment.post_id] = [];
      }
      grouped[comment.post_id].push(comment);
    }

    return grouped;
  }

  private async loadProfiles(
    posts: CommunityPost[],
    commentsByPost: Record<string, CommunityComment[]>
  ): Promise<Record<string, CommunityProfileDirectoryEntry>> {
    const commentAuthors = Object.values(commentsByPost)
      .flat()
      .map(comment => comment.user_id);
    const userIds = Array.from(new Set([...posts.map(post => post.user_id), ...commentAuthors]));

    if (userIds.length === 0) {
      return {};
    }

    const { data: profilesData } = await this.supabaseService.client
      .from('profiles')
      .select('user_id,display_name,avatar_url')
      .in('user_id', userIds);

    if (!profilesData) {
      return {};
    }

    const merged: Record<string, CommunityProfileDirectoryEntry> = {};
    for (const row of profilesData) {
      const profile = row as CommunityProfileDirectoryEntry;
      merged[profile.user_id] = profile;
    }

    return merged;
  }

  private async resolvePostPhotoUrls(posts: CommunityPost[]): Promise<Record<string, string>> {
    if (posts.length === 0) {
      return {};
    }

    const resolvedEntries = await Promise.all(
      posts.map(async post => [post.id, await this.resolvePhotoUrl(post.photo_url, 'gym-checkins')] as const)
    );

    const toMerge: Record<string, string> = {};
    for (const [id, url] of resolvedEntries) {
      if (url) {
        toMerge[id] = url;
      }
    }

    return toMerge;
  }

  private async uploadImage(file: File, bucketName: string, userId: string): Promise<string> {
    const extension = file.name.split('.').pop() || 'jpg';
    const filePath = `${userId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await this.supabaseService.client.storage
      .from(bucketName)
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    return filePath;
  }

  private async resolvePhotoUrl(photoUrlOrPath: string | null, bucketName: string): Promise<string | null> {
    if (!photoUrlOrPath) {
      return null;
    }

    if (/^https?:\/\//i.test(photoUrlOrPath)) {
      if (photoUrlOrPath.includes(`/storage/v1/object/public/${bucketName}/`)) {
        return photoUrlOrPath;
      }

      const extractedPath = this.extractStoragePath(photoUrlOrPath, bucketName);
      if (!extractedPath) {
        return photoUrlOrPath;
      }

      const { data, error } = await this.supabaseService.client.storage
        .from(bucketName)
        .createSignedUrl(extractedPath, 60 * 60);

      if (error || !data?.signedUrl) {
        return photoUrlOrPath;
      }

      return data.signedUrl;
    }

    const { data, error } = await this.supabaseService.client.storage
      .from(bucketName)
      .createSignedUrl(photoUrlOrPath, 60 * 60);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }

    const { data: publicData } = this.supabaseService.client.storage
      .from(bucketName)
      .getPublicUrl(photoUrlOrPath);

    return publicData.publicUrl || null;
  }

  private extractStoragePath(url: string, bucketName: string): string | null {
    const markers = [
      `/storage/v1/object/sign/${bucketName}/`,
      `/storage/v1/object/authenticated/${bucketName}/`,
      `/storage/v1/object/public/${bucketName}/`
    ];

    for (const marker of markers) {
      const markerIndex = url.indexOf(marker);
      if (markerIndex === -1) {
        continue;
      }
      const path = url.slice(markerIndex + marker.length).split('?')[0];
      return path || null;
    }

    return null;
  }

  private async hasExistingPost(userId: string, day: string, postType: CommunityPost['post_type']): Promise<boolean> {
    const { data } = await this.supabaseService.client
      .from('community_posts')
      .select('id')
      .eq('user_id', userId)
      .eq('day', day)
      .eq('post_type', postType)
      .limit(1)
      .maybeSingle();

    return Boolean(data?.id);
  }

  private async notifyCommunityPost(userId: string, day: string, postType: CommunityPost['post_type']): Promise<void> {
    try {
      await this.supabaseService.client.functions.invoke('send-push-notifications', {
        body: {
          kind: 'community_post',
          actorUserId: userId,
          day,
          postType
        }
      });
    } catch (error) {
      console.warn('Push notification could not be sent', error);
    }
  }

  private getProteinMilestoneCacheKey(userId: string, day: string): string {
    return `protein-posted:${userId}:${day}`;
  }

  private getStepsMilestoneCacheKey(userId: string, day: string): string {
    return `steps-posted:${userId}:${day}`;
  }
}
