import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { Profile, WeightLog } from '../../core/types';

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="page profile-page">
      @if (errorMessage()) {
        <p class="toast error" aria-live="polite">{{ errorMessage() }}</p>
      }

      @if (successMessage()) {
        <p class="toast success" aria-live="polite">{{ successMessage() }}</p>
      }

      <section class="panel halftone">
        <div class="profile-head">
          <div class="avatar-wrap">
            @if (avatarPreview()) {
              <img [src]="avatarPreview() || ''" alt="Profilvorschau" class="avatar-image">
            } @else {
              <div class="avatar-fallback" aria-hidden="true">◉</div>
            }
          </div>
          <div>
            <p class="title-font">Profil</p>
            <h1>{{ profileForm.value.display_name || 'Dein Profil' }}</h1>
            <p class="sub">Pflege deine Basisdaten und logge dein Gewicht schnell.</p>
          </div>
        </div>

        <div class="gym-target">
          <span>Wöchentliches Gym-Ziel</span>
          <strong>{{ gymProgressLabel() }}</strong>
          <span class="mono-badge">PIXEL-ABZEICHEN</span>
        </div>
      </section>

      @if (loading()) {
        <section class="panel">
          <div class="skeleton card"></div>
          <div class="skeleton card"></div>
        </section>
      } @else {
        <section class="panel" aria-labelledby="profile-form-title">
          <div id="profile-form-title" class="scroll-header">Profil-Details</div>
          <form class="stack-form" [formGroup]="profileForm" (ngSubmit)="saveProfile()">
            <label for="avatar">Profilfoto</label>
            <input id="avatar" type="file" accept="image/*" (change)="onAvatarSelected($event)">

            <label for="display-name">Anzeigename</label>
            <input id="display-name" type="text" formControlName="display_name" placeholder="Dein Name">

            <label for="bio">Kurzbeschreibung</label>
            <textarea id="bio" formControlName="bio" rows="3" placeholder="Optionale Notiz zu deinem Ziel"></textarea>

            <div class="grid-two">
              <div>
                <label for="height">Größe (cm)</label>
                <input id="height" type="number" min="80" max="260" formControlName="height_cm">
              </div>
              <div>
                <label for="weekly-target">Gym-Ziel / Woche</label>
                <input id="weekly-target" type="number" min="1" max="14" formControlName="weekly_gym_target">
              </div>
            </div>

            <div class="grid-two">
              <div>
                <label for="current-weight">Aktuelles Gewicht (kg)</label>
                <input id="current-weight" type="number" min="20" step="0.1" formControlName="current_weight_kg">
              </div>
              <div>
                <label for="target-weight">Zielgewicht (kg)</label>
                <input id="target-weight" type="number" min="20" step="0.1" formControlName="target_weight_kg">
              </div>
            </div>

            <label for="activity-level">Aktivitätslevel</label>
            <select id="activity-level" formControlName="activity_level">
              <option value="low">Niedrig</option>
              <option value="moderate">Mittel</option>
              <option value="high">Hoch</option>
            </select>

            <button type="submit" class="action-btn" [disabled]="savingProfile() || profileForm.invalid">
              {{ savingProfile() ? 'Wird gespeichert...' : 'Profil speichern' }}
            </button>
          </form>
        </section>
      }

      <section class="panel" aria-labelledby="weight-log-title">
        <div id="weight-log-title" class="section-head">
          <div class="scroll-header">Tägliches Gewicht</div>
          <span class="mono-badge">Zuletzt {{ latestWeightLabel() }}</span>
        </div>

        <div class="sparkline-wrap" aria-label="7-Tage-Trend">
          <svg viewBox="0 0 100 28" preserveAspectRatio="none" class="sparkline">
            <polyline [attr.points]="sparklinePoints()" />
          </svg>
          <div class="trend-note">7-Tage-Veränderung: {{ weeklyTrendLabel() }}</div>
        </div>

        <form class="stack-form" [formGroup]="weightForm" (ngSubmit)="saveWeightLog()">
          <div class="grid-two">
            <div>
              <label for="logged-on">Datum</label>
              <input id="logged-on" type="date" formControlName="logged_on">
            </div>
            <div>
              <label for="weight-kg">Gewicht (kg)</label>
              <input id="weight-kg" type="number" step="0.1" min="20" formControlName="weight_kg">
            </div>
          </div>

          <label for="weight-note">Notiz (optional)</label>
          <textarea id="weight-note" formControlName="note" rows="2" placeholder="Kontext zu diesem Wiegen"></textarea>

          <button type="submit" class="action-btn alt" [disabled]="savingWeight() || weightForm.invalid">
            {{ savingWeight() ? 'Wird gespeichert...' : 'Gewichtseintrag speichern' }}
          </button>
        </form>

        <div class="entries-list" aria-label="Letzte Gewichtseinträge">
          @for (entry of weightLogs(); track entry.id) {
            <article class="list-card">
              <div>
                <strong>{{ entry.weight_kg }} kg</strong>
                <div class="entry-sub">{{ entry.logged_on }}</div>
                @if (entry.note) {
                  <div class="entry-note">{{ entry.note }}</div>
                }
              </div>
            </article>
          }
          @if (weightLogs().length === 0) {
            <p class="empty-state">Noch keine Gewichtseinträge.</p>
          }
        </div>
      </section>
    </main>
  `,
  styles: [`
    .profile-page {
      display: grid;
      gap: 0.75rem;
    }

    .profile-head {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.7rem;
      align-items: center;
    }

    h1 {
      margin-top: 0.2rem;
      font-size: 1.45rem;
    }

    .sub {
      margin: 0.35rem 0 0;
      color: var(--ink-500);
      font-size: var(--text-sm);
      font-weight: 600;
    }

    .avatar-image,
    .avatar-fallback {
      width: 76px;
      height: 76px;
      border-radius: 16px;
      border: 1px solid var(--border-strong);
      background: #1a2738;
    }

    .avatar-image {
      object-fit: cover;
    }

    .avatar-fallback {
      display: grid;
      place-items: center;
      font-size: 1.3rem;
      font-weight: 800;
      color: var(--ink-700);
    }

    .gym-target {
      margin-top: 0.7rem;
      border: 1px solid var(--border-strong);
      border-radius: 12px;
      background: #121f2f;
      padding: 0.55rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      font-weight: 700;
    }

    .stack-form {
      margin-top: 0.75rem;
      display: grid;
      gap: 0.55rem;
    }

    .stack-form label {
      font-size: var(--text-sm);
      color: var(--ink-700);
      font-weight: 700;
    }

    .grid-two {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.65rem;
    }

    .sparkline-wrap {
      border: 1px solid var(--border-strong);
      border-radius: 12px;
      background: #111a27;
      padding: 0.5rem;
      margin-bottom: 0.65rem;
    }

    .sparkline {
      width: 100%;
      height: 48px;
    }

    .sparkline polyline {
      fill: none;
      stroke: var(--accent-500);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .trend-note {
      margin-top: 0.2rem;
      color: var(--ink-500);
      font-size: var(--text-xs);
      font-weight: 700;
    }

    .entries-list {
      margin-top: 0.75rem;
      display: grid;
      gap: 0.5rem;
    }

    .entry-sub {
      margin-top: 0.15rem;
      font-size: var(--text-sm);
      color: var(--ink-500);
      font-weight: 700;
    }

    .entry-note {
      margin-top: 0.2rem;
      font-size: var(--text-sm);
      color: var(--ink-700);
    }
  `]
})
export class ProfileComponent implements OnInit {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);

  readonly savingProfile = signal(false);
  readonly savingWeight = signal(false);
  readonly loading = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly weightLogs = signal<WeightLog[]>([]);
  readonly avatarPreview = signal<string | null>(null);
  readonly gymWeekSessions = signal(0);

  private avatarFile: File | null = null;

  readonly profileForm = this.formBuilder.nonNullable.group({
    display_name: [''],
    bio: [''],
    height_cm: [170, [Validators.min(80), Validators.max(260)]],
    current_weight_kg: [70, [Validators.min(20)]],
    target_weight_kg: [70, [Validators.min(20)]],
    weekly_gym_target: [3, [Validators.min(1), Validators.max(14)]],
    activity_level: ['moderate' as 'low' | 'moderate' | 'high']
  });

  readonly weightForm = this.formBuilder.nonNullable.group({
    logged_on: [this.formatDate(new Date()), [Validators.required]],
    weight_kg: [70, [Validators.required, Validators.min(20)]],
    note: ['']
  });

  readonly latestWeightLabel = computed(() => {
    const latest = this.weightLogs()[0];
    return latest ? `${latest.weight_kg} kg` : '--';
  });

  readonly gymProgressLabel = computed(() => {
    const target = Number(this.profileForm.value.weekly_gym_target || 3);
    return `${this.gymWeekSessions()}/${target}`;
  });

  readonly sparklinePoints = computed(() => {
    const points = [...this.weightLogs()].slice(0, 7).reverse();
    if (points.length === 0) {
      return '0,24 100,24';
    }

    const values = points.map(entry => Number(entry.weight_kg));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);

    return values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * 100;
        const y = 24 - ((value - min) / range) * 20;
        return `${x},${y}`;
      })
      .join(' ');
  });

  readonly weeklyTrendLabel = computed(() => {
    const logs = this.weightLogs();
    if (logs.length < 2) {
      return '--';
    }

    const lastSevenDays = logs.filter(log => {
      const loggedAt = new Date(`${log.logged_on}T00:00:00`);
      const diffDays = (Date.now() - loggedAt.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    });

    if (lastSevenDays.length < 2) {
      return '--';
    }

    const newest = Number(lastSevenDays[0].weight_kg);
    const oldest = Number(lastSevenDays[lastSevenDays.length - 1].weight_kg);
    const delta = Number((newest - oldest).toFixed(1));

    if (delta > 0) {
      return `+${delta} kg`;
    }

    return `${delta} kg`;
  });

  ngOnInit(): void {
    void this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    await this.loadProfile();
    await this.loadWeightLogs();
    await this.loadGymProgress();
    this.loading.set(false);
  }

  async loadProfile(): Promise<void> {
    this.errorMessage.set(null);
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      this.errorMessage.set(error.message);
      return;
    }

    const resolvedProfile = data || {
      user_id: user.id,
      display_name: '',
      bio: '',
      avatar_url: '',
      height_cm: 170,
      current_weight_kg: 70,
      target_weight_kg: 70,
      weekly_gym_target: 3,
      activity_level: 'moderate',
      updated_at: new Date().toISOString()
    };

    if (!data) {
      const { error: insertError } = await this.supabaseService.client
        .from('profiles')
        .insert({
          user_id: user.id,
          display_name: '',
          bio: '',
          height_cm: 170,
          current_weight_kg: 70,
          target_weight_kg: 70,
          weekly_gym_target: 3,
          activity_level: 'moderate'
        });

      if (insertError) {
        this.errorMessage.set(insertError.message);
      }
    }

    this.profile.set(resolvedProfile as Profile);
    this.avatarPreview.set(resolvedProfile.avatar_url || null);

    this.profileForm.patchValue({
      display_name: resolvedProfile.display_name || '',
      bio: resolvedProfile.bio || '',
      height_cm: Number(resolvedProfile.height_cm || 170),
      current_weight_kg: Number(resolvedProfile.current_weight_kg || 70),
      target_weight_kg: Number(resolvedProfile.target_weight_kg || 70),
      weekly_gym_target: Number(resolvedProfile.weekly_gym_target || 3),
      activity_level: (resolvedProfile.activity_level || 'moderate') as 'low' | 'moderate' | 'high'
    });
  }

  async loadWeightLogs(): Promise<void> {
    this.errorMessage.set(null);
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const { data, error } = await this.supabaseService.client
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_on', { ascending: false })
      .limit(30);

    if (error) {
      this.errorMessage.set(error.message);
      return;
    }

    this.weightLogs.set((data || []) as WeightLog[]);
  }

  async loadGymProgress(): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const groupRaw = localStorage.getItem('activeGroup');
    if (!groupRaw) {
      this.gymWeekSessions.set(0);
      return;
    }

    const group = JSON.parse(groupRaw) as { id: string };
    const weekStart = this.getWeekStart(this.formatDate(new Date()));

    const { data } = await this.supabaseService.client
      .from('gym_checkins')
      .select('checkin_date')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .eq('week_start', weekStart);

    const uniqueDays = new Set((data || []).map(entry => entry.checkin_date));
    this.gymWeekSessions.set(uniqueDays.size);
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.avatarFile = file;
    this.avatarPreview.set(URL.createObjectURL(file));
  }

  async saveProfile(): Promise<void> {
    this.successMessage.set(null);
    this.errorMessage.set(null);

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.savingProfile.set(true);

    try {
      let avatarUrl = this.profile()?.avatar_url || null;
      if (this.avatarFile) {
        avatarUrl = await this.uploadImage(this.avatarFile, 'profile-images', user.id);
      }

      const formValue = this.profileForm.getRawValue();

      const payload = {
        user_id: user.id,
        display_name: formValue.display_name.trim() || null,
        bio: formValue.bio.trim() || null,
        avatar_url: avatarUrl,
        height_cm: formValue.height_cm,
        current_weight_kg: formValue.current_weight_kg,
        target_weight_kg: formValue.target_weight_kg,
        weekly_gym_target: formValue.weekly_gym_target,
        activity_level: formValue.activity_level,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabaseService.client
        .from('profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        throw error;
      }

      this.avatarFile = null;
      this.successMessage.set('Profil gespeichert.');
      await this.loadAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Profil konnte nicht gespeichert werden.';
      this.errorMessage.set(errorMessage);
    } finally {
      this.savingProfile.set(false);
    }
  }

  async saveWeightLog(): Promise<void> {
    this.successMessage.set(null);
    this.errorMessage.set(null);

    if (this.weightForm.invalid) {
      this.weightForm.markAllAsTouched();
      return;
    }

    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.savingWeight.set(true);

    try {
      const formValue = this.weightForm.getRawValue();
      const note = formValue.note.trim();

      const { error } = await this.supabaseService.client
        .from('weight_logs')
        .upsert(
          {
            user_id: user.id,
            logged_on: formValue.logged_on,
            weight_kg: formValue.weight_kg,
            note: note || null
          },
          { onConflict: 'user_id,logged_on' }
        );

      if (error) {
        throw error;
      }

      await this.supabaseService.client
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            current_weight_kg: formValue.weight_kg,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );

      this.successMessage.set('Gewichtseintrag gespeichert.');
      await this.loadAll();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Gewichtseintrag konnte nicht gespeichert werden.';
      this.errorMessage.set(errorMessage);
    } finally {
      this.savingWeight.set(false);
    }
  }

  private getWeekStart(dateInput: string): string {
    const date = new Date(`${dateInput}T00:00:00`);
    const day = date.getDay();
    const daysSinceMonday = (day + 6) % 7;
    date.setDate(date.getDate() - daysSinceMonday);
    return this.formatDate(date);
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

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
