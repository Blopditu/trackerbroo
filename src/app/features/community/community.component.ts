import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { ActiveGroupService } from '../../core/active-group.service';
import { DailySummary, GroupActivity, GymCheckin, Profile } from '../../core/types';
import { HabitGridComponent, HabitState } from '../../ui/minimal/habit-grid.component';
import { ListRowComponent } from '../../ui/minimal/list-row.component';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';
import { MinimalMetricComponent } from '../../ui/minimal/minimal-metric.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-community',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, HabitGridComponent, ListRowComponent, BottomSheetComponent, MinimalMetricComponent],
  template: `
    <main class="page community-page">
      @if (errorMessage()) {
        <p class="toast error" aria-live="polite">{{ errorMessage() }}</p>
      }

      @if (successMessage()) {
        <p class="toast success" aria-live="polite">{{ successMessage() }}</p>
      }

      <section class="hero">
        <p class="period"><i class="fa-regular fa-calendar icon" aria-hidden="true"></i> Periode bis {{ periodEndLabel() }}</p>
        <h1>Gruppen-Pakt</h1>
        <p class="motto">{{ groupMotto() }}</p>
      </section>

      @if (!hasGroup()) {
        <section class="section">
          <p class="muted">No active group. Join or create one.</p>
          <button type="button" class="btn" (click)="goToGroupSetup()"><i class="fa-solid fa-people-group icon" aria-hidden="true"></i> 🤝 Join/Create Group</button>
        </section>
      } @else {
        <section class="section">
          <h2><i class="fa-solid fa-shield-heart icon" aria-hidden="true"></i> My Status</h2>
          <div class="metric-row">
            <app-minimal-metric label="Training" [value]="trainingCount() + '/3'" />
            <app-minimal-metric label="Protein" [value]="proteinDaysCount() + '/7'" />
            <app-minimal-metric label="Sleep" [value]="sleepCount() + '/5'" />
          </div>
          <p class="card" [class.yellow]="cardStatus() === 'yellow'" [class.red]="cardStatus() === 'red'">Card status: {{ cardLabel() }}</p>
        </section>

        <section class="section">
          <h2><i class="fa-solid fa-chart-simple icon" aria-hidden="true"></i> Group Consistency</h2>
          <app-habit-grid label="Consistency" [states]="groupConsistencyStates()" [targetPerWeek]="7" />
        </section>

        <section class="section">
          <h2><i class="fa-solid fa-stream icon" aria-hidden="true"></i> Activity Feed</h2>
          @for (item of streamItems(); track item.id) {
            <app-list-row [title]="displayName(item.user_id)" [subtitle]="streamBadges(item) + (item.note ? ' · ' + item.note : '')" [meta]="item.day" />
            @if (item.photo_url) {
              <button type="button" class="photo-toggle" (click)="togglePhoto(item.id)">
                {{ expandedPhotoId() === item.id ? 'Hide photo' : 'Show photo' }}
              </button>
              @if (expandedPhotoId() === item.id) {
                <img [src]="item.photo_url" alt="Check-in photo" class="photo">
              }
            }
          }
          @if (streamItems().length === 0) {
            <p class="muted">No activity yet.</p>
          }
        </section>

        <section class="section">
          <h2><i class="fa-solid fa-triangle-exclamation icon" aria-hidden="true"></i> Yellow / Red Rules</h2>
          <p class="muted">{{ yellowCardRule() }}</p>
          <p class="danger">{{ redCardConsequence() }}</p>
        </section>

        <button class="group-fab" type="button" (click)="showCheckinSheet.set(true)" aria-label="Ritual check-in"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
      }
    </main>

    <app-bottom-sheet [open]="showCheckinSheet()" title="Ritual Check-in" (closed)="closeCheckinSheet()">
      <div class="toggle-grid">
        <button type="button" class="toggle" [class.active]="checkinGym()" (click)="checkinGym.set(!checkinGym())"><i class="fa-solid fa-dumbbell icon" aria-hidden="true"></i> 🏋️ Gym gemacht</button>
        <button type="button" class="toggle" [class.active]="checkinProtein()" (click)="checkinProtein.set(!checkinProtein())"><i class="fa-solid fa-drumstick-bite icon" aria-hidden="true"></i> 🍗 100g Protein</button>
        <button type="button" class="toggle" [class.active]="checkinSleep()" (click)="checkinSleep.set(!checkinSleep())"><i class="fa-solid fa-moon icon" aria-hidden="true"></i> 😴 8h Schlaf</button>
      </div>

      <label for="checkin-note">Note (optional)</label>
      <textarea id="checkin-note" rows="2" [(ngModel)]="checkinNote" placeholder="Optional context"></textarea>

      <label for="checkin-photo">Photo (optional)</label>
      <input id="checkin-photo" type="file" accept="image/*" (change)="onCheckinPhotoSelected($event)">

      <button type="button" class="btn" [disabled]="savingCheckin()" (click)="submitCheckin()"><i class="fa-solid fa-paper-plane icon" aria-hidden="true"></i> {{ savingCheckin() ? 'Saving...' : 'Post Check-in' }}</button>
    </app-bottom-sheet>
  `,
  styles: [`
    .community-page {
      background: #0F1115;
      color: #E6E8EC;
      gap: 16px;
      padding: 16px;
    }

    .hero,
    .section {
      display: grid;
      gap: 12px;
      background: #151922;
      border: 1px solid #1B202B;
      padding: 16px;
    }

    .period {
      margin: 0;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #A4A9B6;
      font-weight: 700;
    }

    .icon {
      margin-right: 8px;
    }

    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .motto,
    .muted {
      margin: 0;
      font-size: 13px;
      color: #A4A9B6;
      font-weight: 600;
    }

    .metric-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .card {
      margin: 0;
      font-size: 13px;
      color: #A4A9B6;
      font-weight: 600;
    }

    .card.yellow { color: #F4B740; }
    .card.red { color: #E35D5D; }

    .danger {
      margin: 0;
      color: #E35D5D;
      font-size: 13px;
      font-weight: 600;
    }

    .photo-toggle,
    .btn,
    .toggle {
      min-height: 44px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #E6E8EC;
      padding: 0 12px;
      font-size: 16px;
      font-weight: 600;
      text-align: left;
    }

    .toggle-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }

    .toggle.active {
      border-color: #3DBB78;
      color: #3DBB78;
    }

    .photo {
      width: 100%;
      border: 1px solid #1B202B;
    }

    .group-fab {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: calc(96px + env(safe-area-inset-bottom));
      width: 56px;
      height: 56px;
      border: 1px solid #1B202B;
      background: #5B8CFF;
      color: #0F1115;
      font-size: 24px;
      font-weight: 700;
      z-index: 30;
    }

    label {
      font-size: 13px;
      color: #A4A9B6;
      font-weight: 600;
    }

    input,
    textarea {
      width: 100%;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #E6E8EC;
      padding: 12px;
      font-size: 16px;
      margin-bottom: 8px;
    }

    textarea { min-height: 88px; }
  `]
})
export class CommunityComponent implements OnInit {
  readonly activities = signal<GroupActivity[]>([]);
  readonly summaries = signal<DailySummary[]>([]);
  readonly memberIds = signal<string[]>([]);
  readonly profiles = signal<Record<string, Profile>>({});
  readonly loading = signal(false);
  readonly savingCheckin = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly expandedPhotoId = signal<string | null>(null);

  readonly showCheckinSheet = signal(false);
  readonly checkinGym = signal(false);
  readonly checkinProtein = signal(false);
  readonly checkinSleep = signal(false);
  checkinNote = '';
  private checkinPhoto: File | null = null;

  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly activeGroupService = inject(ActiveGroupService);
  private readonly router = inject(Router);

  readonly hasGroup = computed(() => this.activeGroupService.activeGroupId() !== null);
  readonly today = signal(this.formatDate(new Date()));

  readonly weekDays = computed(() => {
    const monday = this.getWeekStartDate(new Date(`${this.today()}T00:00:00`));
    const days: string[] = [];
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      days.push(this.formatDate(date));
    }
    return days;
  });

  readonly myDayState = computed(() => {
    const userId = this.authService.user()?.id;
    const state: Record<string, { gym: boolean; sleep: boolean; protein: boolean }> = {};
    for (const day of this.weekDays()) {
      state[day] = { gym: false, sleep: false, protein: false };
    }

    if (!userId) return state;

    for (const activity of this.activities()) {
      if (activity.user_id !== userId || !state[activity.day]) continue;
      state[activity.day].gym = state[activity.day].gym || activity.gym_done;
      state[activity.day].sleep = state[activity.day].sleep || activity.sleep_done;
      state[activity.day].protein = state[activity.day].protein || activity.protein_done;
    }

    for (const summary of this.summaries()) {
      if (summary.owner_id === userId && state[summary.day] && Number(summary.protein) >= 100) {
        state[summary.day].protein = true;
      }
    }

    return state;
  });

  readonly trainingCount = computed(() => this.countDays('gym'));
  readonly sleepCount = computed(() => this.countDays('sleep'));
  readonly proteinDaysCount = computed(() => this.countDays('protein'));

  readonly cardStatus = computed<'none' | 'yellow' | 'red'>(() => {
    const reached = [this.trainingCount() >= 3, this.sleepCount() >= 5, this.proteinDaysCount() >= 7].filter(Boolean).length;
    if (reached === 3) return 'none';
    if (reached === 2) return 'yellow';
    return 'red';
  });

  readonly groupConsistencyStates = computed<HabitState[]>(() => {
    const days = this.weekDays();
    const memberCount = Math.max(this.memberIds().length, 1);

    return days.map(day => {
      const activities = this.activities().filter(item => item.day === day);
      if (activities.length === 0) return 'empty';

      const activeUsers = new Set(activities.map(item => item.user_id)).size;
      const ratio = activeUsers / memberCount;
      return ratio >= 0.6 ? 'complete' : 'missed';
    });
  });

  readonly streamItems = computed(() =>
    [...this.activities()].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 30)
  );

  readonly groupMotto = computed(() => this.activeGroupService.activeGroup()?.motto || 'Consistency over ego.');
  readonly periodEndLabel = computed(() => this.activeGroupService.activeGroup()?.period_end || '31.08.25');
  readonly yellowCardRule = computed(() => this.activeGroupService.activeGroup()?.yellow_card_rules || 'Miss weekly targets = yellow card.');
  readonly redCardConsequence = computed(() => this.activeGroupService.activeGroup()?.red_card_consequence || 'Repeated misses trigger red card consequence.');

  ngOnInit(): void {
    void this.loadCommunityData();
  }

  async loadCommunityData(): Promise<void> {
    this.errorMessage.set(null);
    const user = this.authService.user();
    const groupId = this.activeGroupService.activeGroupId();

    if (!user || !groupId) {
      this.activities.set([]);
      this.summaries.set([]);
      this.memberIds.set([]);
      return;
    }

    this.loading.set(true);
    const weekStart = this.weekDays()[0];
    const weekEnd = this.weekDays()[6];

    const [{ data: membersData, error: membersError }, { data: activitiesData, error: activityError }, { data: summariesData, error: summaryError }] = await Promise.all([
      this.supabaseService.client.from('group_members').select('user_id').eq('group_id', groupId),
      this.supabaseService.client
        .from('group_activities')
        .select('*')
        .eq('group_id', groupId)
        .gte('day', weekStart)
        .lte('day', weekEnd)
        .order('created_at', { ascending: false })
        .limit(240),
      this.supabaseService.client
        .from('daily_summaries')
        .select('*')
        .eq('group_id', groupId)
        .gte('day', weekStart)
        .lte('day', weekEnd)
    ]);

    if (membersError || activityError || summaryError) {
      this.errorMessage.set('Could not load group data.');
      this.loading.set(false);
      return;
    }

    const memberIds = (membersData || []).map(member => String(member.user_id));
    this.memberIds.set(memberIds);
    this.activities.set((activitiesData || []) as GroupActivity[]);
    this.summaries.set((summariesData || []) as DailySummary[]);

    if (memberIds.length > 0) {
      const { data: profilesData } = await this.supabaseService.client.from('profiles').select('*').in('user_id', memberIds);
      const profileMap: Record<string, Profile> = {};
      for (const profile of profilesData || []) {
        const cast = profile as Profile;
        profileMap[cast.user_id] = cast;
      }
      this.profiles.set(profileMap);
    }

    this.loading.set(false);
  }

  async submitCheckin(): Promise<void> {
    this.successMessage.set(null);
    this.errorMessage.set(null);

    const user = this.authService.user();
    const groupId = this.activeGroupService.activeGroupId();
    if (!user || !groupId) {
      this.errorMessage.set('You need an active group.');
      return;
    }

    if (!this.checkinGym() && !this.checkinProtein() && !this.checkinSleep() && !this.checkinNote.trim() && !this.checkinPhoto) {
      this.errorMessage.set('Select at least one ritual.');
      return;
    }

    this.savingCheckin.set(true);

    try {
      const day = this.today();
      const { data: existing } = await this.supabaseService.client
        .from('group_activities')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .eq('day', day)
        .maybeSingle();

      let photoUrl: string | null = existing?.photo_url || null;
      if (this.checkinPhoto) {
        photoUrl = await this.uploadImage(this.checkinPhoto, 'gym-checkins', user.id);
      }

      const { error } = await this.supabaseService.client
        .from('group_activities')
        .upsert(
          {
            group_id: groupId,
            user_id: user.id,
            day,
            gym_done: this.checkinGym() || Boolean(existing?.gym_done),
            protein_done: this.checkinProtein() || Boolean(existing?.protein_done),
            sleep_done: this.checkinSleep() || Boolean(existing?.sleep_done),
            confirm_done: Boolean(existing?.confirm_done),
            note: this.checkinNote.trim() || existing?.note || null,
            photo_url: photoUrl
          },
          { onConflict: 'group_id,user_id,day' }
        );

      if (error) {
        throw error;
      }

      if (this.checkinGym()) {
        await this.supabaseService.client.from('gym_checkins').insert({
          group_id: groupId,
          user_id: user.id,
          checkin_date: day,
          week_start: this.weekDays()[0],
          note: this.checkinNote.trim() || null,
          photo_url: photoUrl
        } as Omit<GymCheckin, 'id' | 'created_at'>);
      }

      this.successMessage.set('Check-in posted.');
      this.closeCheckinSheet();
      await this.loadCommunityData();
    } catch {
      this.errorMessage.set('Could not post check-in.');
    } finally {
      this.savingCheckin.set(false);
    }
  }

  closeCheckinSheet(): void {
    this.showCheckinSheet.set(false);
    this.checkinGym.set(false);
    this.checkinProtein.set(false);
    this.checkinSleep.set(false);
    this.checkinNote = '';
    this.checkinPhoto = null;
  }

  onCheckinPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.checkinPhoto = input.files?.[0] || null;
  }

  displayName(userId: string): string {
    return this.profiles()[userId]?.display_name || userId.slice(0, 8);
  }

  cardLabel(): string {
    if (this.cardStatus() === 'yellow') return 'yellow';
    if (this.cardStatus() === 'red') return 'red';
    return 'none';
  }

  streamBadges(item: GroupActivity): string {
    const badges: string[] = [];
    if (item.gym_done) badges.push('Gym');
    if (item.protein_done) badges.push('Protein');
    if (item.sleep_done) badges.push('Sleep');
    return badges.join(' · ') || 'Update';
  }

  togglePhoto(activityId: string): void {
    this.expandedPhotoId.set(this.expandedPhotoId() === activityId ? null : activityId);
  }

  goToGroupSetup(): void {
    void this.router.navigate(['/group']);
  }

  private countDays(type: 'gym' | 'sleep' | 'protein'): number {
    const state = this.myDayState();
    return this.weekDays().filter(day => state[day]?.[type]).length;
  }

  private getWeekStartDate(date: Date): Date {
    const cloned = new Date(date);
    const day = cloned.getDay();
    const daysSinceMonday = (day + 6) % 7;
    cloned.setDate(cloned.getDate() - daysSinceMonday);
    return cloned;
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

    const { data } = this.supabaseService.client.storage.from(bucketName).getPublicUrl(filePath);
    return data.publicUrl;
  }
}
