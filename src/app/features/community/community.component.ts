import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Ellipsis, LucideAngularModule, Plus } from 'lucide-angular';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth.service';
import { CommunityPost, Profile } from '../../core/types';
import { formatAppError } from '../../core/error-format';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';
import { CommunityFacadeService } from './community-facade.service';

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
        <p class="toast error" role="status" aria-live="polite" aria-atomic="true">{{ errorMessage() }}</p>
      }

      @if (successMessage()) {
        <p class="toast success" role="status" aria-live="polite" aria-atomic="true">{{ successMessage() }}</p>
      }

      <section class="panel community-hero">
        <div>
          <p class="period">Feed zuerst</p>
          <p class="motto">Kurze Check-ins, direkte Reaktionen.</p>
        </div>
        <div class="hero-cta-row">
          <button mat-flat-button type="button" class="action-btn hero-cta" (click)="openGymSheet()">
            Gym-Check-in teilen
          </button>
          <span class="feed-pill">{{ posts().length }} Einträge</span>
        </div>
      </section>

      <section class="panel section">
        <div class="m3-section-head">
          <h2>Letzte Aktivität</h2>
          <span class="m3-section-meta">Feed zuerst</span>
        </div>

        @if (loadingInitial()) {
          <p class="muted">Die Community wird geladen …</p>
        } @else {
          @for (group of groupedPosts(); track group.day; let groupIndex = $index) {
            <div class="day-divider" [style.--stagger]="groupIndex">{{ dayLabel(group.day) }}</div>

            @for (post of group.posts; track post.id; let index = $index) {
              <article class="post-card" [style.--stagger]="index">
                <div class="post-head">
                  <strong>{{ displayName(post.user_id) }}</strong>
                  <div class="post-actions">
                    <span class="post-meta">{{ post.day }}</span>
                    @if (isOwnPost(post)) {
                      <button
                        mat-icon-button
                        type="button"
                        class="post-manage-btn"
                        (click)="openPostActions(post)"
                        aria-label="Beitrag verwalten"
                      >
                        <lucide-icon [img]="icons.more" aria-hidden="true"></lucide-icon>
                      </button>
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

                @if (post.post_type === 'steps_milestone') {
                  <p class="post-summary">{{ stepsSummary(post) }}</p>
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
            <p class="muted">Noch keine Updates. Starte den ersten Gym-Check-in oder teile heute ein erreichtes Ziel.</p>
          }

          <div #loadMoreAnchor class="load-anchor" aria-hidden="true"></div>

          @if (loadingMore()) {
            <p class="muted">Weitere Einträge werden geladen …</p>
          }

          @if (hasMore()) {
            <button mat-flat-button type="button" class="action-btn ghost load-more" (click)="loadMore()" [disabled]="loadingMore()">
              Weitere Einträge laden
            </button>
          } @else if (posts().length > 0) {
            <p class="muted">Du bist am Anfang eurer letzten Updates angekommen.</p>
          }
        }
      </section>

      <button mat-fab class="app-fab community-fab" type="button" (click)="openGymSheet()" aria-label="Gym-Check-in teilen">
        <lucide-icon [img]="icons.plus" class="fab-icon" aria-hidden="true"></lucide-icon>
      </button>
    </main>

    <app-bottom-sheet [open]="showGymSheet()" title="Gym-Check-in teilen" (closed)="closeGymSheet()">
      <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Notiz (optional)</mat-label>
        <textarea matInput id="gym-note" rows="2" [(ngModel)]="gymNote" placeholder="Was lief heute gut?"></textarea>
      </mat-form-field>

      <p class="file-label">Foto (optional)</p>
      <div class="file-row">
        <button mat-flat-button type="button" class="action-btn ghost compact" (click)="pickGymPhoto()">Foto auswählen</button>
        <span class="file-name">{{ gymPhotoName() || 'Kein Foto ausgewählt' }}</span>
      </div>
      <input #gymPhotoInput id="gym-photo" class="sr-only" type="file" accept="image/*" (change)="onGymPhotoSelected($event)">

      <button mat-flat-button type="button" class="action-btn" [disabled]="savingPost()" (click)="submitGymPost()">
        {{ savingPost() ? 'Wird geteilt …' : 'Gym-Check-in teilen' }}
      </button>
    </app-bottom-sheet>

    <app-bottom-sheet [open]="selectedPostForActions() !== null" title="Beitrag verwalten" (closed)="closePostActions()">
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
      color: var(--m3-sys-color-on-surface);
      gap: var(--layout-gap);
    }

        .community-hero {
          display: flex;
          flex-wrap: wrap;
          align-items: end;
          justify-content: space-between;
          gap: 12px;
        }

        .section,
        .post-card {
          display: grid;
          gap: var(--space-3);
        }

    .post-card {
      background: color-mix(in srgb, var(--m3-sys-color-surface-container-high) 90%, transparent);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 24px;
      padding: 14px;
      box-shadow: none;
    }

        .section h2 {
          margin: 0;
          font-size: clamp(1.6rem, 4vw, 2.1rem);
          font-weight: 800;
          letter-spacing: -0.06em;
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
      font-weight: 700;
    }

    .period {
      color: var(--shell-accent);
      letter-spacing: 0.28em;
      text-transform: uppercase;
      font-size: 11px;
      font-weight: 800;
    }

        .hero-cta {
          width: fit-content;
          min-height: 44px;
        }

        .hero-cta-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }

        .feed-pill {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid var(--m3-sys-color-outline-variant);
          background: color-mix(in srgb, var(--m3-sys-color-surface) 62%, transparent);
          color: var(--m3-sys-color-on-surface-variant);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

    .day-divider {
      margin-top: 8px;
      width: fit-content;
      padding: 8px 12px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      font-size: 12px;
      font-weight: 600;
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

        .post-manage-btn {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 70%, transparent);
          background: color-mix(in srgb, var(--m3-sys-color-surface) 52%, transparent);
          color: var(--m3-sys-color-on-surface-variant);
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
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 12px;
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

    .photo {
      width: 100%;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container);
      min-height: 120px;
      object-fit: cover;
    }
  `]
})
export class CommunityComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly icons = {
    plus: Plus,
    more: Ellipsis
  };

  readonly facade = inject(CommunityFacadeService);
  readonly posts = this.facade.posts;
  readonly commentsByPost = this.facade.commentsByPost;
  readonly profiles = this.facade.profiles;
  readonly photoSrcMap = this.facade.photoSrcMap;
  readonly commentInputs = this.facade.commentInputs;
  readonly loadingInitial = this.facade.loadingInitial;
  readonly loadingMore = this.facade.loadingMore;
  readonly hasMore = this.facade.hasMore;
  readonly groupedPosts = this.facade.groupedPosts;
  readonly selectedPostForActions = signal<CommunityPost | null>(null);
  readonly expandedCommentPostId = signal<string | null>(null);
  readonly gymPhotoName = signal<string | null>(null);
  readonly gymPhotoInput = viewChild<ElementRef<HTMLInputElement>>('gymPhotoInput');

  readonly savingPost = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly showGymSheet = signal(false);

  gymNote = '';
  private gymPhoto: File | null = null;

  private readonly authService = inject(AuthService);

  @ViewChild('loadMoreAnchor') loadMoreAnchor?: ElementRef<HTMLElement>;
  private loadObserver: IntersectionObserver | null = null;

  readonly today = computed(() => this.formatDate(new Date()));

  ngOnInit(): void {
    void this.facade.activate(this.today());
  }

  ngAfterViewInit(): void {
    this.setupInfiniteObserver();
    this.restoreScrollPosition();
  }

  ngOnDestroy(): void {
    this.loadObserver?.disconnect();
    this.facade.deactivate(this.readScrollY());
  }

  async loadMore(): Promise<void> {
    try {
      await this.facade.loadMore();
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Weitere Einträge konnten nicht geladen werden'));
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
      await this.facade.createGymPost(this.today(), this.gymNote, this.gymPhoto);

      this.gymNote = '';
      this.gymPhoto = null;
      this.gymPhotoName.set(null);
      this.showGymSheet.set(false);
      this.successMessage.set('Dein Check-in ist jetzt in der Community.');
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Gym-Check-in konnte nicht geteilt werden'));
    } finally {
      this.savingPost.set(false);
    }
  }

  async submitComment(postId: string): Promise<void> {
    try {
      await this.facade.submitComment(postId);
      this.expandedCommentPostId.set(null);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Kommentar konnte nicht gespeichert werden'));
    }
  }

  async deletePost(postId: string): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const user = this.authService.user();
    if (!user) {
      return;
    }

    try {
      await this.facade.deletePost(postId);
      this.successMessage.set('Beitrag gelöscht.');
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Beitrag konnte nicht gelöscht werden'));
    }
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
    this.facade.setCommentInput(postId, value);
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
      return 'Protein-Ziel erreicht';
    }
    if (post.post_type === 'steps_milestone') {
      return 'Schrittziel erreicht';
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

  stepsSummary(post: CommunityPost): string {
    const summary = post.summary as { steps?: number; target?: number } | null;
    const steps = Number(summary?.steps || 0);
    const target = Number(summary?.target || 0);
    if (!steps && !target) {
      return '';
    }
    return `${steps.toLocaleString('de-CH')} / ${target.toLocaleString('de-CH')} Schritte`;
  }

  getPhotoSrc(post: CommunityPost): string | null {
    return this.photoSrcMap()[post.id] || null;
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
      { root: null, rootMargin: '300px 0px 300px 0px' }
    );

    this.loadObserver.observe(this.loadMoreAnchor.nativeElement);
  }

  private restoreScrollPosition(): void {
    if (typeof window === 'undefined') {
      return;
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top: this.facade.scrollY(), left: 0, behavior: 'auto' });
    });
  }

  private readScrollY(): number {
    if (typeof window === 'undefined') {
      return 0;
    }

    return window.scrollY || window.pageYOffset || 0;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
