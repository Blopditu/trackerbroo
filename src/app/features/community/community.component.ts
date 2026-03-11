import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { CommunityComment, CommunityPost, LogEntry, Profile } from '../../core/types';
import { formatAppError } from '../../core/error-format';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';
import { LibraryDataService } from '../../core/library-data.service';
import { QueryCacheService } from '../../core/query-cache.service';

interface DayGroup {
  day: string;
  posts: CommunityPost[];
}

type ProfileDirectoryEntry = Pick<Profile, 'user_id' | 'display_name' | 'avatar_url'>;

@Component({
  selector: 'app-community',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    BottomSheetComponent
  ],
  template: `
    <main class="page community-page">
      @if (errorMessage()) {
        <p class="toast error" aria-live="polite">{{ errorMessage() }}</p>
      }

      @if (successMessage()) {
        <p class="toast success" aria-live="polite">{{ successMessage() }}</p>
      }

      <section class="panel hero">
        <p class="period">Community</p>
        <h1>Aktivitätsfeed</h1>
        <p class="motto">Gym-Check-ins und 100g-Protein-Milestones für alle.</p>
      </section>

      <section class="panel section">
        <div class="m3-section-head">
          <h2>Feed</h2>
          <span class="m3-section-meta">{{ posts().length }} Posts</span>
        </div>

        @if (loadingInitial()) {
          <p class="muted">Lädt...</p>
        } @else {
          @for (group of groupedPosts(); track group.day) {
            <div class="day-divider">{{ dayLabel(group.day) }}</div>

            @for (post of group.posts; track post.id) {
              <article class="post-card">
                <div class="post-head">
                  <strong>{{ displayName(post.user_id) }}</strong>
                  <div class="post-actions">
                    <span class="post-meta">{{ post.day }}</span>
                    @if (isOwnPost(post)) {
                      <button mat-flat-button type="button" class="action-btn ghost compact" (click)="openPostActions(post)">Mehr</button>
                    }
                  </div>
                </div>

                <p class="post-type">{{ postTypeLabel(post) }}</p>

                @if (post.note) {
                  <p class="post-note">{{ post.note }}</p>
                }

                @if (post.post_type === 'protein_milestone') {
                  <p class="post-summary">{{ proteinSummary(post) }}</p>
                }

                @if (foodSummary(post).length > 0) {
                  <p class="post-foods">{{ foodSummary(post) }}</p>
                }

                @if (getPhotoSrc(post)) {
                  <img
                    [src]="getPhotoSrc(post) || ''"
                    alt="Post-Foto"
                    class="photo"
                    loading="lazy"
                    decoding="async"
                  >
                }

                <div class="comment-list">
                  @for (comment of commentsByPost()[post.id] || []; track comment.id) {
                    <p class="comment-item">
                      <strong>{{ displayName(comment.user_id) }}:</strong>
                      <span>{{ comment.comment_text }}</span>
                    </p>
                  }
                </div>

                <div class="post-inline-actions">
                  <button mat-flat-button type="button" class="action-btn ghost compact" (click)="toggleCommentComposer(post.id)">
                    {{ expandedCommentPostId() === post.id ? 'Schließen' : 'Kommentieren' }}
                  </button>
                </div>

                @if (expandedCommentPostId() === post.id) {
                  <div class="compose-row">
                    <mat-form-field class="m3-field comment-field" appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Kommentar</mat-label>
                      <input
                        matInput
                        type="text"
                        [ngModel]="commentInputs()[post.id] || ''"
                        (ngModelChange)="setCommentInput(post.id, $event)"
                        placeholder="Kommentar"
                        [attr.aria-label]="'Kommentar für Post von ' + displayName(post.user_id)"
                      >
                    </mat-form-field>
                    <button mat-flat-button type="button" class="action-btn compact" (click)="submitComment(post.id)">Senden</button>
                  </div>
                }
              </article>
            }
          }

          @if (posts().length === 0) {
            <p class="muted">Noch keine Posts.</p>
          }

          <div #loadMoreAnchor class="load-anchor" aria-hidden="true"></div>

          @if (loadingMore()) {
            <p class="muted">Weitere Posts werden geladen...</p>
          }

          @if (hasMore()) {
            <button mat-flat-button type="button" class="action-btn ghost load-more" (click)="loadMore()" [disabled]="loadingMore()">
              Mehr laden
            </button>
          } @else if (posts().length > 0) {
            <p class="muted">Ende des Feeds.</p>
          }
        }
      </section>

      <button mat-fab class="app-fab community-fab" type="button" (click)="openGymSheet()" aria-label="Gym-Post erstellen">
        <lucide-icon [img]="icons.plus" class="fab-icon" aria-hidden="true"></lucide-icon>
      </button>
    </main>

    <app-bottom-sheet [open]="showGymSheet()" title="Gym posten" (closed)="closeGymSheet()">
      <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Notiz (optional)</mat-label>
        <textarea matInput id="gym-note" rows="2" [(ngModel)]="gymNote" placeholder="Was lief heute gut?"></textarea>
      </mat-form-field>

      <p class="file-label">Foto (optional)</p>
      <div class="file-row">
        <button mat-flat-button type="button" class="action-btn ghost compact" (click)="pickGymPhoto()">Foto auswählen</button>
        <span class="file-name">{{ gymPhotoName() || 'Kein Foto gewählt' }}</span>
      </div>
      <input #gymPhotoInput id="gym-photo" class="sr-only" type="file" accept="image/*" (change)="onGymPhotoSelected($event)">

      <button mat-flat-button type="button" class="action-btn" [disabled]="savingPost()" (click)="submitGymPost()">
        {{ savingPost() ? 'Wird gepostet...' : 'Gym-Check-in posten' }}
      </button>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="selectedPostForActions() !== null" title="Post-Aktionen" (closed)="closePostActions()">
      @if (selectedPostForActions()) {
        <article class="action-card">
          <p class="action-title">{{ postTypeLabel(selectedPostForActions()!) }}</p>
          @if (selectedPostForActions()!.note) {
            <p class="action-sub">{{ selectedPostForActions()!.note }}</p>
          }
        </article>
        <div class="action-list">
          <button mat-flat-button type="button" class="action-btn danger" (click)="deleteSelectedPost()">Löschen</button>
          <button mat-flat-button type="button" class="action-btn ghost" (click)="closePostActions()">Abbrechen</button>
        </div>
      }
    </app-bottom-sheet>
  `,
  styles: [`
    .community-page {
      background: var(--m3-sys-color-surface);
      color: var(--m3-sys-color-on-surface);
      gap: 16px;
      padding: 16px;
    }

    .hero,
    .section,
    .post-card {
      display: grid;
      gap: 12px;
    }

    .post-card {
      background: var(--m3-sys-color-surface-container);
      border: 1px solid var(--m3-sys-color-outline-variant);
      padding: 16px;
    }

    .hero h1,
    .section h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .period,
    .motto,
    .muted,
    .post-meta,
    .post-type,
    .post-summary,
    .post-foods {
      margin: 0;
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 13px;
      font-weight: 600;
    }

    .day-divider {
      margin-top: 8px;
      padding: 6px 10px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface);
      font-size: 12px;
      font-weight: 700;
      color: var(--m3-sys-color-on-surface-variant);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .post-head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
    }

    .post-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .post-note,
    .comment-item {
      margin: 0;
      color: var(--m3-sys-color-on-surface);
      font-size: 14px;
      font-weight: 500;
    }

    .comment-list {
      display: grid;
      gap: 8px;
    }

    .compose-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
    }

    .comment-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .post-inline-actions {
      display: flex;
      justify-content: flex-start;
    }

    .file-label {
      margin: 0;
      font-size: 13px;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 600;
    }

    .file-row {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .file-name {
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 13px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .action-card {
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface);
      padding: 10px;
      display: grid;
      gap: 4px;
    }

    .action-title {
      margin: 0;
      color: var(--m3-sys-color-on-surface);
      font-size: 15px;
      font-weight: 700;
    }

    .action-sub {
      margin: 0;
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 13px;
      font-weight: 600;
    }

    .action-list {
      display: grid;
      gap: 8px;
    }

    .load-more {
      width: 100%;
      text-align: center;
      margin-top: 8px;
    }

    .load-anchor {
      width: 100%;
      height: 1px;
    }

    .community-fab {
      z-index: 31;
    }

    .fab-icon {
      width: 24px;
      height: 24px;
    }

    input,
    textarea {
      width: 100%;
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface);
      color: var(--m3-sys-color-on-surface);
      padding: 12px;
      font-size: 16px;
    }

    .photo {
      width: 100%;
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface);
      min-height: 120px;
      object-fit: cover;
    }
  `]
})
export class CommunityComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly icons = {
    plus: Plus
  };

  private readonly pageSize = 15;

  readonly posts = signal<CommunityPost[]>([]);
  readonly commentsByPost = signal<Record<string, CommunityComment[]>>({});
  readonly profiles = signal<Record<string, ProfileDirectoryEntry>>({});
  readonly photoSrcMap = signal<Record<string, string>>({});
  readonly commentInputs = signal<Record<string, string>>({});
  readonly selectedPostForActions = signal<CommunityPost | null>(null);
  readonly expandedCommentPostId = signal<string | null>(null);
  readonly gymPhotoName = signal<string | null>(null);
  readonly gymPhotoInput = viewChild<ElementRef<HTMLInputElement>>('gymPhotoInput');

  readonly loadingInitial = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);
  readonly nextOffset = signal(0);

  readonly savingPost = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly showGymSheet = signal(false);

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

  gymNote = '';
  private gymPhoto: File | null = null;

  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly libraryDataService = inject(LibraryDataService);
  private readonly queryCache = inject(QueryCacheService);

  @ViewChild('loadMoreAnchor') loadMoreAnchor?: ElementRef<HTMLElement>;
  private loadObserver: IntersectionObserver | null = null;

  readonly today = computed(() => this.formatDate(new Date()));

  ngOnInit(): void {
    void this.loadInitial();
  }

  ngAfterViewInit(): void {
    this.setupInfiniteObserver();
  }

  ngOnDestroy(): void {
    this.loadObserver?.disconnect();
  }

  async loadInitial(): Promise<void> {
    this.errorMessage.set(null);

    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.loadingInitial.set(true);
    this.posts.set([]);
    this.commentsByPost.set({});
    this.profiles.set({});
    this.photoSrcMap.set({});
    this.selectedPostForActions.set(null);
    this.expandedCommentPostId.set(null);
    this.nextOffset.set(0);
    this.hasMore.set(true);

    try {
      await this.ensureProteinMilestonePost(user.id, this.today());
      await this.fetchNextPage();
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Community-Daten konnten nicht geladen werden'));
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
      await this.fetchNextPage();
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Weitere Posts konnten nicht geladen werden'));
    } finally {
      this.loadingMore.set(false);
    }
  }

  async submitGymPost(): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.savingPost.set(true);

    try {
      let photoUrl: string | null = null;
      if (this.gymPhoto) {
        photoUrl = await this.uploadImage(this.gymPhoto, 'gym-checkins', user.id);
      }

      const { error } = await this.supabaseService.client
        .from('community_posts')
        .upsert(
          {
            user_id: user.id,
            post_type: 'gym_checkin',
            day: this.today(),
            note: this.gymNote.trim() || null,
            summary: null,
            photo_url: photoUrl
          },
          { onConflict: 'user_id,day,post_type' }
        );

      if (error) {
        throw error;
      }

      this.gymNote = '';
      this.gymPhoto = null;
      this.gymPhotoName.set(null);
      this.showGymSheet.set(false);
      this.successMessage.set('Gym-Check-in gepostet.');
      await this.loadInitial();
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Gym-Check-in konnte nicht gepostet werden'));
    } finally {
      this.savingPost.set(false);
    }
  }

  async submitComment(postId: string): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const text = (this.commentInputs()[postId] || '').trim();
    if (!text) {
      this.errorMessage.set('Kommentar darf nicht leer sein.');
      return;
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

    if (error) {
      this.errorMessage.set(formatAppError(error, 'Kommentar konnte nicht gespeichert werden'));
      return;
    }

    this.setCommentInput(postId, '');
    this.expandedCommentPostId.set(null);

    if (!data) {
      return;
    }

    this.commentsByPost.update(current => {
      const existing = current[postId] || [];
      return {
        ...current,
        [postId]: [...existing, data as CommunityComment]
      };
    });
  }

  async deletePost(postId: string): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

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
      this.errorMessage.set(formatAppError(error, 'Post konnte nicht gelöscht werden'));
      return;
    }

    this.successMessage.set('Post gelöscht.');
    await this.loadInitial();
  }

  openGymSheet(): void {
    this.showGymSheet.set(true);
  }

  closeGymSheet(): void {
    this.showGymSheet.set(false);
    this.gymNote = '';
    this.gymPhoto = null;
    this.gymPhotoName.set(null);
    const photoInput = this.gymPhotoInput()?.nativeElement;
    if (photoInput) {
      photoInput.value = '';
    }
  }

  onGymPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.gymPhoto = input.files?.[0] || null;
    this.gymPhotoName.set(this.gymPhoto?.name || null);
  }

  pickGymPhoto(): void {
    this.gymPhotoInput()?.nativeElement.click();
  }

  setCommentInput(postId: string, value: string): void {
    this.commentInputs.update(current => ({ ...current, [postId]: value }));
  }

  openPostActions(post: CommunityPost): void {
    this.selectedPostForActions.set(post);
  }

  closePostActions(): void {
    this.selectedPostForActions.set(null);
  }

  toggleCommentComposer(postId: string): void {
    this.expandedCommentPostId.update(current => (current === postId ? null : postId));
  }

  async deleteSelectedPost(): Promise<void> {
    const post = this.selectedPostForActions();
    if (!post) {
      return;
    }
    await this.deletePost(post.id);
    this.closePostActions();
  }

  isOwnPost(post: CommunityPost): boolean {
    const currentUserId = this.authService.user()?.id;
    return Boolean(currentUserId && post.user_id === currentUserId);
  }

  displayName(userId: string): string {
    return this.profiles()[userId]?.display_name || userId.slice(0, 8);
  }

  dayLabel(day: string): string {
    const today = this.today();
    if (day === today) {
      return 'Heute';
    }

    const yesterday = new Date(`${today}T00:00:00`);
    yesterday.setDate(yesterday.getDate() - 1);
    if (day === this.formatDate(yesterday)) {
      return 'Gestern';
    }

    return new Date(`${day}T00:00:00`).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  postTypeLabel(post: CommunityPost): string {
    if (post.post_type === 'gym_checkin') {
      return 'Gym-Check-in';
    }
    if (post.post_type === 'protein_milestone') {
      return '100g Protein erreicht';
    }
    return 'Update';
  }

  proteinSummary(post: CommunityPost): string {
    const summary = post.summary as { protein?: number; kcal?: number; carbs?: number; fat?: number } | null;
    const totalProtein = Number(summary?.protein || 0);
    const totalKcal = Number(summary?.kcal || 0);
    const totalCarbs = Number(summary?.carbs || 0);
    const totalFat = Number(summary?.fat || 0);
    if (!totalProtein && !totalKcal && !totalCarbs && !totalFat) {
      return '';
    }
    return `Protein: ${totalProtein.toFixed(1)}g · KH: ${totalCarbs.toFixed(1)}g · Fett: ${totalFat.toFixed(1)}g · kcal: ${totalKcal.toFixed(0)}`;
  }

  foodSummary(post: CommunityPost): string {
    const foods = (post.summary as { foods?: string[] } | null)?.foods;
    if (!foods || foods.length === 0) {
      return '';
    }
    return `Essen: ${foods.join(', ')}`;
  }

  getPhotoSrc(post: CommunityPost): string | null {
    return this.photoSrcMap()[post.id] || null;
  }

  private getProteinMilestoneCacheKey(userId: string, day: string): string {
    return `protein-posted:${userId}:${day}`;
  }

  private async fetchNextPage(): Promise<void> {
    const from = this.nextOffset();
    const to = from + this.pageSize - 1;

    const { data: postsData, error: postsError } = await this.supabaseService.client
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (postsError) {
      throw postsError;
    }

    const newPosts = (postsData || []) as CommunityPost[];

    this.posts.update(current => [...current, ...newPosts]);
    this.nextOffset.set(from + newPosts.length);

    if (newPosts.length < this.pageSize) {
      this.hasMore.set(false);
    }

    if (newPosts.length === 0) {
      return;
    }

    await Promise.all([this.mergeComments(newPosts), this.mergeProfiles(newPosts), this.resolvePostPhotoUrls(newPosts)]);
  }

  private async mergeComments(newPosts: CommunityPost[]): Promise<void> {
    const postIds = newPosts.map(post => post.id);
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

    this.commentsByPost.update(current => ({ ...current, ...grouped }));
  }

  private async mergeProfiles(newPosts: CommunityPost[]): Promise<void> {
    const commentAuthors = Object.values(this.commentsByPost())
      .flat()
      .map(comment => comment.user_id);

    const userIds = Array.from(new Set([...newPosts.map(post => post.user_id), ...commentAuthors]));
    const knownUserIds = new Set(Object.keys(this.profiles()));
    const missingUserIds = userIds.filter(userId => !knownUserIds.has(userId));

    if (missingUserIds.length === 0) {
      return;
    }

    const { data: profilesData } = await this.supabaseService.client
      .from('profiles')
      .select('user_id,display_name,avatar_url')
      .in('user_id', missingUserIds);

    if (!profilesData) {
      return;
    }

    const merged: Record<string, ProfileDirectoryEntry> = {};
    for (const row of profilesData) {
      const profile = row as ProfileDirectoryEntry;
      merged[profile.user_id] = profile;
    }

    this.profiles.update(current => ({ ...current, ...merged }));
  }

  private async ensureProteinMilestonePost(userId: string, day: string): Promise<void> {
    const markerKey = this.getProteinMilestoneCacheKey(userId, day);
    if (this.queryCache.getFresh<boolean>(markerKey)) {
      return;
    }

    const { data: summaryData } = await this.supabaseService.client
      .from('daily_summaries')
      .select('*')
      .eq('owner_id', userId)
      .is('group_id', null)
      .eq('day', day)
      .maybeSingle();

    const summary = summaryData as { protein?: number; kcal?: number; carbs?: number; fat?: number } | null;
    if (!summary || Number(summary.protein || 0) < 100) {
      return;
    }

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
      .map(entry => {
        const name = nameMap.get(entry.ref_id) || 'Unbekannt';
        const protein = Number(entry.protein || 0);
        return `${name} (${protein.toFixed(1)}g)`;
      });

    await this.supabaseService.client.from('community_posts').upsert(
      {
        user_id: userId,
        post_type: 'protein_milestone',
        day,
        note: '100g Protein erreicht.',
        summary: {
          protein: Number(summary.protein || 0),
          carbs: Number(summary.carbs || 0),
          fat: Number(summary.fat || 0),
          kcal: Number(summary.kcal || 0),
          foods
        },
        photo_url: null
      },
      { onConflict: 'user_id,day,post_type' }
    );

    this.queryCache.set(markerKey, true, 1000 * 60 * 60 * 6);
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

  private async resolvePostPhotoUrls(posts: CommunityPost[]): Promise<void> {
    const resolvedEntries = await Promise.all(
      posts.map(async post => {
        const resolvedUrl = await this.resolvePhotoUrl(post.photo_url, 'gym-checkins');
        return [post.id, resolvedUrl] as const;
      })
    );

    const toMerge: Record<string, string> = {};
    for (const [id, url] of resolvedEntries) {
      if (url) {
        toMerge[id] = url;
      }
    }

    this.photoSrcMap.update(current => ({ ...current, ...toMerge }));
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

  private setupInfiniteObserver(): void {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window) || !this.loadMoreAnchor) {
      return;
    }

    this.loadObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void this.loadMore();
            break;
          }
        }
      },
      { root: null, rootMargin: '600px 0px 600px 0px' }
    );

    this.loadObserver.observe(this.loadMoreAnchor.nativeElement);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
