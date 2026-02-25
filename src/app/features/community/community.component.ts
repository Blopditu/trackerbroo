import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { DailySummary, GymCheckin, Profile } from '../../core/types';

interface LeaderboardRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gymSessions: number;
  gymTarget: number;
  proteinHitDays: number;
  proteinTotal: number;
  score: number;
}

@Component({
  selector: 'app-community',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="page community-page">
      @if (errorMessage()) {
        <p class="toast error" aria-live="polite">{{ errorMessage() }}</p>
      }

      @if (successMessage()) {
        <p class="toast success" aria-live="polite">{{ successMessage() }}</p>
      }

      <header class="panel halftone">
        <p class="title-font">Gemeinschaft</p>
        <h1>Gruppen-Feed</h1>
        <p class="sub">Check-ins, Rangliste und Konstanz im Überblick.</p>
      </header>

      @if (!hasGroup()) {
        <section class="panel">
          <p class="empty-state">Wähle zuerst eine aktive Gruppe, um das Gruppen-Tracking zu nutzen.</p>
        </section>
      } @else {
        <section class="panel" aria-labelledby="gym-checkin-title">
          <div id="gym-checkin-title" class="section-head">
            <div class="scroll-header">Gym-Check-in</div>
            <span class="mono-badge">{{ myProgressLabel() }}</span>
          </div>

          <form class="stack-form" [formGroup]="checkinForm" (ngSubmit)="submitCheckin()">
            <div class="grid-two">
              <div>
                <label for="checkin-date">Datum</label>
                <input id="checkin-date" type="date" formControlName="checkin_date">
              </div>
              <div>
                <label for="checkin-photo">Foto (optional)</label>
                <input id="checkin-photo" type="file" accept="image/*" (change)="onCheckinPhotoSelected($event)">
              </div>
            </div>

            <label for="checkin-note">Notiz</label>
            <textarea id="checkin-note" rows="2" formControlName="note" placeholder="2/3 geschafft, heute Oberkörper"></textarea>

            <button type="submit" class="action-btn alt" [disabled]="savingCheckin() || checkinForm.invalid">
              {{ savingCheckin() ? 'Wird gepostet...' : 'Check-in posten' }}
            </button>
          </form>
        </section>

        <section class="panel" aria-labelledby="leaderboard-title">
          <div id="leaderboard-title" class="section-head">
            <div class="scroll-header">Rangliste</div>
            <span class="mono-badge">{{ selectedWindowDays() }} Tage</span>
          </div>

          <div class="segmented window-tabs" role="tablist" aria-label="Ranglisten-Zeitraum">
            <button type="button" role="tab" [attr.aria-selected]="selectedWindowDays() === 7" [class.active]="selectedWindowDays() === 7" (click)="setWindowDays(7)">7 Tage</button>
            <button type="button" role="tab" [attr.aria-selected]="selectedWindowDays() === 14" [class.active]="selectedWindowDays() === 14" (click)="setWindowDays(14)">14 Tage</button>
            <button type="button" role="tab" [attr.aria-selected]="selectedWindowDays() === 30" [class.active]="selectedWindowDays() === 30" (click)="setWindowDays(30)">30 Tage</button>
          </div>

          @if (loading()) {
            <div class="skeleton card"></div>
            <div class="skeleton card"></div>
          } @else {
            <div class="board-list">
              @for (row of leaderboard(); track row.userId) {
                <article class="list-card board-row" [class.you]="row.userId === currentUserId()">
                  <div class="row-head">
                    <div class="avatar">{{ initials(row.displayName) }}</div>
                    <div class="row-main">
                      <strong>{{ row.displayName }}</strong>
                      <div class="row-sub">Gym {{ row.gymSessions }}/{{ row.gymTarget }} · Protein {{ row.proteinHitDays }}/{{ selectedWindowDays() }} Tage</div>
                    </div>
                  </div>
                  <div class="score-wrap">
                    <div class="score-bar-bg">
                      <div class="score-bar" [style.width.%]="row.score"></div>
                    </div>
                    <span class="mono-badge">{{ row.score }} Pkt</span>
                  </div>
                </article>
              }
              @if (leaderboard().length === 0) {
                <p class="empty-state">Noch keine Ranglisten-Daten in diesem Zeitraum.</p>
              }
            </div>
          }
        </section>

        <section class="panel" aria-labelledby="feed-title">
          <div id="feed-title" class="scroll-header">Letzte Check-ins</div>

          @if (loading()) {
            <div class="skeleton card"></div>
            <div class="skeleton card"></div>
          } @else {
            <div class="feed-list">
              @for (item of checkins(); track item.id) {
                <article class="list-card feed-item">
                  <div class="feed-head">
                    <div class="avatar">{{ initials(displayName(item.user_id)) }}</div>
                    <div>
                      <strong>{{ displayName(item.user_id) }}</strong>
                      <div class="entry-sub">{{ item.checkin_date }} · {{ getWeeklyProgressLabel(item.user_id, item.week_start) }}</div>
                    </div>
                  </div>

                  @if (item.note) {
                    <p class="feed-note">{{ item.note }}</p>
                  }

                  @if (item.photo_url) {
                    <img [src]="item.photo_url" alt="Gym-Check-in-Foto" class="feed-photo">
                  }

                  <div class="reaction-placeholder">Reaktionen kommen bald</div>
                </article>
              }

              @if (checkins().length === 0) {
                <p class="empty-state">Noch keine Check-ins. Poste dein erstes Update.</p>
              }
            </div>
          }
        </section>
      }
    </main>
  `,
  styles: [`
    .community-page {
      display: grid;
      gap: 0.75rem;
    }

    h1 {
      margin-top: 0.2rem;
      font-size: 1.7rem;
    }

    .sub {
      margin: 0.35rem 0 0;
      color: var(--ink-500);
      font-weight: 600;
      font-size: var(--text-sm);
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.45rem;
      margin-bottom: 0.65rem;
    }

    .stack-form {
      display: grid;
      gap: 0.55rem;
    }

    label {
      font-size: var(--text-sm);
      color: var(--ink-700);
      font-weight: 700;
    }

    .grid-two {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
    }

    .window-tabs {
      margin-bottom: 0.65rem;
    }

    .board-list,
    .feed-list {
      display: grid;
      gap: 0.5rem;
    }

    .board-row {
      display: grid;
      gap: 0.55rem;
    }

    .board-row.you {
      border-color: var(--accent-500);
      background: var(--accent-soft);
    }

    .row-head {
      display: flex;
      gap: 0.55rem;
      align-items: center;
    }

    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: 1px solid var(--border-strong);
      display: grid;
      place-items: center;
      background: #1a2738;
      font-size: var(--text-xs);
      font-weight: 800;
    }

    .row-main {
      display: grid;
      gap: 0.15rem;
    }

    .row-sub {
      font-size: var(--text-sm);
      color: var(--ink-500);
      font-weight: 700;
    }

    .score-wrap {
      width: 100%;
      display: grid;
      gap: 0.25rem;
    }

    .score-bar-bg {
      width: 100%;
      height: 10px;
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      background: #142335;
      overflow: hidden;
    }

    .score-bar {
      height: 100%;
      background: var(--accent-500);
    }

    .feed-item {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.5rem;
    }

    .feed-head {
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }

    .entry-sub {
      font-size: var(--text-xs);
      color: var(--ink-500);
      font-weight: 700;
    }

    .feed-note {
      margin: 0;
      color: var(--ink-700);
      font-weight: 600;
    }

    .feed-photo {
      width: 100%;
      border-radius: 10px;
      border: 2px solid var(--border-strong);
      object-fit: cover;
      max-height: 240px;
    }

    .reaction-placeholder {
      font-size: var(--text-xs);
      color: var(--ink-500);
      font-weight: 700;
    }
  `]
})
export class CommunityComponent implements OnInit {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);

  readonly selectedWindowDays = signal<7 | 14 | 30>(7);
  readonly checkins = signal<GymCheckin[]>([]);
  readonly summaries = signal<DailySummary[]>([]);
  readonly memberIds = signal<string[]>([]);
  readonly profiles = signal<Record<string, Profile>>({});
  readonly savingCheckin = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly loading = signal(false);

  private selectedCheckinPhoto: File | null = null;

  readonly checkinForm = this.formBuilder.nonNullable.group({
    checkin_date: [this.formatDate(new Date()), [Validators.required]],
    note: ['']
  });

  readonly hasGroup = computed(() => this.getActiveGroupId() !== null);
  readonly currentUserId = computed(() => this.authService.user()?.id || '');

  readonly myProgressLabel = computed(() => {
    const userId = this.currentUserId();
    if (!userId) {
      return '0/3';
    }

    const weekStart = this.getWeekStart(this.formatDate(new Date()));
    const gymTarget = this.getWeeklyTarget(userId);
    const sessions = this.getUniqueGymDays(userId, weekStart);
    return `${sessions}/${gymTarget}`;
  });

  readonly leaderboard = computed(() => {
    const proteinGoalGrams = 100;
    const rows: LeaderboardRow[] = this.memberIds().map(userId => {
      const weekStart = this.getWeekStart(this.formatDate(new Date()));
      const gymTarget = this.getWeeklyTarget(userId);
      const gymSessions = this.getUniqueGymDays(userId, weekStart);
      const userSummaries = this.summaries().filter(summary => summary.owner_id === userId);
      const proteinHitDays = userSummaries.filter(summary => Number(summary.protein) >= proteinGoalGrams).length;
      const proteinTotal = userSummaries.reduce((sum, summary) => sum + Number(summary.protein), 0);

      const gymScore = Math.min(gymSessions / gymTarget, 1);
      const proteinScore = proteinHitDays / this.selectedWindowDays();
      const score = Math.round((gymScore * 0.55 + proteinScore * 0.45) * 100);

      return {
        userId,
        displayName: this.displayName(userId),
        avatarUrl: this.profiles()[userId]?.avatar_url || null,
        gymSessions,
        gymTarget,
        proteinHitDays,
        proteinTotal,
        score
      };
    });

    return rows.sort((a, b) => b.score - a.score || b.proteinTotal - a.proteinTotal);
  });

  ngOnInit(): void {
    void this.loadCommunityData();
  }

  async setWindowDays(days: 7 | 14 | 30): Promise<void> {
    this.selectedWindowDays.set(days);
    await this.loadCommunityData();
  }

  async loadCommunityData(): Promise<void> {
    this.errorMessage.set(null);
    const user = this.authService.user();
    const groupId = this.getActiveGroupId();

    if (!user || !groupId) {
      this.checkins.set([]);
      this.summaries.set([]);
      this.memberIds.set([]);
      return;
    }

    this.loading.set(true);

    const endDate = this.formatDate(new Date());
    const startDate = this.shiftDate(endDate, -(this.selectedWindowDays() - 1));

    const [{ data: membersData, error: membersError }, { data: checkinsData, error: checkinsError }, { data: summariesData, error: summariesError }] = await Promise.all([
      this.supabaseService.client
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId),
      this.supabaseService.client
        .from('gym_checkins')
        .select('*')
        .eq('group_id', groupId)
        .gte('checkin_date', startDate)
        .lte('checkin_date', endDate)
        .order('created_at', { ascending: false })
        .limit(120),
      this.supabaseService.client
        .from('daily_summaries')
        .select('*')
        .eq('group_id', groupId)
        .gte('day', startDate)
        .lte('day', endDate)
    ]);

    if (membersError || checkinsError || summariesError) {
      const message = membersError?.message || checkinsError?.message || summariesError?.message || 'Gruppen-Daten konnten nicht geladen werden.';
      this.errorMessage.set(message);
      this.loading.set(false);
      return;
    }

    const memberIds = (membersData || []).map(member => member.user_id);
    this.memberIds.set(memberIds);
    this.checkins.set((checkinsData || []) as GymCheckin[]);
    this.summaries.set((summariesData || []) as DailySummary[]);

    if (memberIds.length === 0) {
      this.profiles.set({});
      this.loading.set(false);
      return;
    }

    const { data: profilesData, error: profilesError } = await this.supabaseService.client
      .from('profiles')
      .select('*')
      .in('user_id', memberIds);

    if (profilesError) {
      this.errorMessage.set(profilesError.message);
      this.loading.set(false);
      return;
    }

    const profileMap: Record<string, Profile> = {};
    for (const profile of profilesData || []) {
      const castProfile = profile as Profile;
      profileMap[castProfile.user_id] = castProfile;
    }

    this.profiles.set(profileMap);
    this.loading.set(false);
  }

  onCheckinPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedCheckinPhoto = input.files?.[0] || null;
  }

  async submitCheckin(): Promise<void> {
    this.successMessage.set(null);
    this.errorMessage.set(null);

    if (this.checkinForm.invalid) {
      this.checkinForm.markAllAsTouched();
      return;
    }

    const user = this.authService.user();
    const groupId = this.getActiveGroupId();
    if (!user || !groupId) {
      this.errorMessage.set('Du brauchst eine aktive Gruppe für den Check-in.');
      return;
    }

    this.savingCheckin.set(true);

    try {
      const formValue = this.checkinForm.getRawValue();
      const checkinDate = formValue.checkin_date;
      const weekStart = this.getWeekStart(checkinDate);
      const note = formValue.note.trim();
      let photoUrl: string | null = null;

      if (this.selectedCheckinPhoto) {
        photoUrl = await this.uploadImage(this.selectedCheckinPhoto, 'gym-checkins', user.id);
      }

      const { error } = await this.supabaseService.client
        .from('gym_checkins')
        .insert({
          group_id: groupId,
          user_id: user.id,
          checkin_date: checkinDate,
          week_start: weekStart,
          note: note || null,
          photo_url: photoUrl
        });

      if (error) {
        throw error;
      }

      this.successMessage.set('Check-in gepostet.');
      this.selectedCheckinPhoto = null;
      this.checkinForm.patchValue({ note: '' });
      await this.loadCommunityData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check-in konnte nicht gespeichert werden.';
      this.errorMessage.set(message);
    } finally {
      this.savingCheckin.set(false);
    }
  }

  displayName(userId: string): string {
    const profile = this.profiles()[userId];
    if (!profile) {
      return userId.slice(0, 8);
    }

    return profile.display_name || userId.slice(0, 8);
  }

  initials(name: string): string {
    return name.slice(0, 2).toUpperCase();
  }

  getWeeklyProgressLabel(userId: string, weekStart: string): string {
    const target = this.getWeeklyTarget(userId);
    const sessions = this.getUniqueGymDays(userId, weekStart);
    return `${sessions}/${target}`;
  }

  private getWeeklyTarget(userId: string): number {
    const profile = this.profiles()[userId];
    return Number(profile?.weekly_gym_target || 3);
  }

  private getUniqueGymDays(userId: string, weekStart: string): number {
    const checkinDays = this.checkins()
      .filter(checkin => checkin.user_id === userId && checkin.week_start === weekStart)
      .map(checkin => checkin.checkin_date);

    return new Set(checkinDays).size;
  }

  private getActiveGroupId(): string | null {
    const groupRaw = localStorage.getItem('activeGroup');
    if (!groupRaw) {
      return null;
    }

    try {
      const group = JSON.parse(groupRaw) as { id?: string };
      return group.id || null;
    } catch {
      return null;
    }
  }

  private getWeekStart(dateInput: string): string {
    const date = new Date(`${dateInput}T00:00:00`);
    const day = date.getDay();
    const daysSinceMonday = (day + 6) % 7;
    date.setDate(date.getDate() - daysSinceMonday);
    return this.formatDate(date);
  }

  private shiftDate(dateInput: string, deltaDays: number): string {
    const date = new Date(`${dateInput}T00:00:00`);
    date.setDate(date.getDate() + deltaDays);
    return this.formatDate(date);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
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

    const { data } = this.supabaseService.client.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
}
