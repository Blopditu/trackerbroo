import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { Profile, WeightLog } from '../../core/types';
import { formatAppError } from '../../core/error-format';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <main class="page profile-page">
      @if (errorMessage()) {
        <p class="toast error" role="status" aria-live="polite" aria-atomic="true">{{ errorMessage() }}</p>
      }

      @if (successMessage()) {
        <p class="toast success" role="status" aria-live="polite" aria-atomic="true">{{ successMessage() }}</p>
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
            <div class="file-row">
              <button mat-flat-button type="button" class="action-btn ghost" (click)="pickAvatar()">Foto auswählen</button>
              <span class="file-name">{{ avatarFileName() || 'Kein Foto gewählt' }}</span>
            </div>
            <input #avatarInput id="avatar" class="sr-only" type="file" accept="image/*" (change)="onAvatarSelected($event)">

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Anzeigename</mat-label>
              <input matInput id="display-name" type="text" formControlName="display_name" placeholder="Dein Name">
            </mat-form-field>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Kurzbeschreibung</mat-label>
              <textarea matInput id="bio" formControlName="bio" rows="3" placeholder="Optionale Notiz zu deinem Ziel"></textarea>
            </mat-form-field>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Gym Name</mat-label>
              <input matInput id="gym-name" type="text" formControlName="gym_name" placeholder="z.B. Mein Gym">
            </mat-form-field>

            <div class="grid-two">
              <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                <mat-label>Größe (cm)</mat-label>
                <input matInput id="height" type="number" min="80" max="260" formControlName="height_cm">
              </mat-form-field>
              <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                <mat-label>Gym-Ziel / Woche</mat-label>
                <input matInput id="weekly-target" type="number" min="1" max="14" formControlName="weekly_gym_target">
              </mat-form-field>
            </div>

            <div class="grid-two">
              <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                <mat-label>Aktuelles Gewicht (kg)</mat-label>
                <input matInput id="current-weight" type="number" min="20" step="0.1" formControlName="current_weight_kg">
              </mat-form-field>
              <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                <mat-label>Zielgewicht (kg)</mat-label>
                <input matInput id="target-weight" type="number" min="20" step="0.1" formControlName="target_weight_kg">
              </mat-form-field>
            </div>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Aktivitätslevel</mat-label>
              <mat-select id="activity-level" formControlName="activity_level">
                <mat-option value="low">Niedrig</mat-option>
                <mat-option value="moderate">Mittel</mat-option>
                <mat-option value="high">Hoch</mat-option>
              </mat-select>
            </mat-form-field>

            <label for="theme-seed-text">Design-Farbe (Material 3)</label>
            <div class="theme-seed-row">
              <input
                id="theme-seed-picker"
                type="color"
                [value]="profileForm.controls.theme_seed_color.value"
                (input)="onThemeSeedPickerInput($event)"
                aria-label="Design-Farbe auswählen"
              >
              <mat-form-field class="m3-field theme-seed-text-field" appearance="outline" subscriptSizing="dynamic">
                <mat-label>Hex</mat-label>
                <input
                  matInput
                  id="theme-seed-text"
                  type="text"
                  formControlName="theme_seed_color"
                  placeholder="#4c8dff"
                  (input)="onThemeSeedTextInput($event)"
                  (blur)="normalizeThemeSeedControl()"
                >
              </mat-form-field>
            </div>
            <div class="theme-preset-grid" role="list" aria-label="Farbvorschläge">
              @for (preset of themeSeedPresets; track preset) {
                <button
                  type="button"
                  role="listitem"
                  class="theme-swatch"
                  [class.active]="profileForm.controls.theme_seed_color.value === preset"
                  [style.background]="preset"
                  (click)="applyThemePreset(preset)"
                  [attr.aria-label]="'Farbpreset ' + preset"
                ></button>
              }
            </div>
            <p class="subtle">Die App nutzt daraus ein dynamisches Material-3-Farbsystem.</p>

            <button mat-flat-button type="submit" class="action-btn" [disabled]="savingProfile() || profileForm.invalid">
              {{ savingProfile() ? 'Wird gespeichert...' : 'Profil speichern' }}
            </button>
          </form>
        </section>
      }

      <section class="panel" aria-labelledby="weight-log-title">
        <div id="weight-log-title" class="m3-section-head">
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
            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Datum</mat-label>
              <input matInput id="logged-on" type="date" formControlName="logged_on">
            </mat-form-field>
            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Gewicht (kg)</mat-label>
              <input matInput id="weight-kg" type="number" step="0.1" min="20" formControlName="weight_kg">
            </mat-form-field>
          </div>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Notiz (optional)</mat-label>
            <textarea matInput id="weight-note" formControlName="note" rows="2" placeholder="Kontext zu diesem Wiegen"></textarea>
          </mat-form-field>

          <button mat-flat-button type="submit" class="action-btn tonal" [disabled]="savingWeight() || weightForm.invalid">
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

      <section class="panel danger-zone" aria-labelledby="reset-onboarding-title">
        <div id="reset-onboarding-title" class="scroll-header">Onboarding zurücksetzen</div>
        <p class="subtle">
          Setzt nur Profildaten zurück und startet das Onboarding neu. Zutaten, Mahlzeiten und Bibliothekseinträge
          bleiben erhalten.
        </p>
        <button mat-flat-button type="button" class="action-btn ghost danger-btn" (click)="resetOnboarding()" [disabled]="savingProfile()">
          Onboarding neu starten
        </button>
      </section>
    </main>
  `,
  styles: [`
    .profile-page {
      display: grid;
      gap: var(--layout-gap);
    }

    .profile-head {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.9rem;
      align-items: center;
    }

    h1 {
      margin-top: 0.2rem;
      font-size: clamp(1.8rem, 4vw, 2.2rem);
      line-height: 1.05;
    }

    .sub {
      margin: 0.35rem 0 0;
      color: var(--ink-500);
      font-size: var(--text-sm);
      font-weight: 600;
    }

    .avatar-image,
    .avatar-fallback {
      width: 84px;
      height: 84px;
      border-radius: 20px;
      border: 1px solid var(--border-strong);
      background: var(--m3-sys-color-surface-container-high);
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
      border-radius: 18px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 0.75rem 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      font-weight: 700;
    }

    .stack-form {
      margin-top: 0.75rem;
      display: grid;
      gap: 0.75rem;
    }

    .stack-form label {
      font-size: var(--text-sm);
      color: var(--ink-700);
      font-weight: 700;
    }

    .file-row {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 0.65rem;
      margin-bottom: 0.35rem;
    }

    .file-name {
      color: var(--ink-700);
      font-size: var(--text-sm);
      font-weight: 700;
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

    .grid-two {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .sparkline-wrap {
      border: 1px solid var(--border-strong);
      border-radius: 20px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 0.75rem;
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
      gap: 0.65rem;
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

    .danger-zone {
      border-color: var(--m3-sys-color-error);
      background: var(--m3-sys-color-error-container);
    }

    .subtle {
      margin: 0.45rem 0 0.65rem;
      color: var(--ink-500);
      font-size: var(--text-sm);
      font-weight: 600;
    }

    .danger-btn {
      border-color: var(--m3-sys-color-error);
      color: var(--m3-sys-color-on-error-container);
      background: color-mix(in srgb, var(--m3-sys-color-error-container) 90%, var(--m3-sys-color-surface-container-low));
    }

    .theme-seed-row {
      display: grid;
      grid-template-columns: 56px 1fr;
      gap: 0.75rem;
      align-items: center;
    }

    .theme-seed-row input[type='color'] {
      padding: 0.24rem;
      min-height: var(--touch-target);
      border-radius: 16px;
      border: 1px solid var(--border-strong);
      background: var(--bg-surface-2);
    }

    .theme-preset-grid {
      display: grid;
      grid-template-columns: repeat(8, minmax(0, 1fr));
      gap: 0.55rem;
      margin-top: 0.35rem;
    }

    .theme-swatch {
      min-height: 34px;
      border-radius: 999px;
      border: 1px solid var(--border-strong);
    }

    .theme-swatch.active {
      box-shadow: inset 0 0 0 2px color-mix(in srgb, #ffffff 65%, transparent);
    }
  `]
})
export class ProfileComponent implements OnInit {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  readonly savingProfile = signal(false);
  readonly savingWeight = signal(false);
  readonly loading = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly weightLogs = signal<WeightLog[]>([]);
  readonly avatarPreview = signal<string | null>(null);
  readonly avatarFileName = signal<string | null>(null);
  readonly avatarInput = viewChild<ElementRef<HTMLInputElement>>('avatarInput');
  readonly gymWeekSessions = signal(0);
  readonly themeSeedPresets = [
    '#4c8dff',
    '#0ea5e9',
    '#14b8a6',
    '#22c55e',
    '#84cc16',
    '#f59e0b',
    '#ef4444',
    '#a855f7'
  ];

  private avatarFile: File | null = null;

  readonly profileForm = this.formBuilder.nonNullable.group({
    display_name: [''],
    bio: [''],
    gym_name: [''],
    height_cm: [170, [Validators.min(80), Validators.max(260)]],
    current_weight_kg: [70, [Validators.min(20)]],
    target_weight_kg: [70, [Validators.min(20)]],
    weekly_gym_target: [3, [Validators.min(1), Validators.max(14)]],
    activity_level: ['moderate' as 'low' | 'moderate' | 'high'],
    theme_seed_color: [this.themeService.getCurrentSeed(), [Validators.pattern(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)]]
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
      this.errorMessage.set(formatAppError(error, 'Profil konnte nicht geladen werden'));
      return;
    }

    const resolvedProfile = data || {
      user_id: user.id,
      display_name: '',
      bio: '',
      gym_name: null,
      avatar_url: '',
      age: null,
      height_cm: 170,
      current_weight_kg: 70,
      target_weight_kg: 70,
      weekly_gym_target: 3,
      activity_level: 'moderate',
      theme_seed_color: this.themeService.getCurrentSeed(),
      onboarding_completed: false,
      track_nutrition: true,
      track_gym: true,
      updated_at: new Date().toISOString()
    };

    if (!data) {
      const { error: insertError } = await this.supabaseService.client
        .from('profiles')
        .insert({
          user_id: user.id,
          display_name: '',
          bio: '',
          gym_name: null,
          age: null,
          height_cm: 170,
          current_weight_kg: 70,
          target_weight_kg: 70,
          weekly_gym_target: 3,
          activity_level: 'moderate',
          theme_seed_color: this.themeService.getCurrentSeed(),
          onboarding_completed: false,
          track_nutrition: true,
          track_gym: true
        });

      if (insertError) {
        this.errorMessage.set(formatAppError(insertError, 'Profil konnte nicht initialisiert werden'));
      }
    }

    const resolvedThemeSeed = this.themeService.applySeed(
      (resolvedProfile as Profile).theme_seed_color || this.themeService.getCurrentSeed(),
      { persistLocal: true }
    );

    this.profile.set({ ...(resolvedProfile as Profile), theme_seed_color: resolvedThemeSeed });
    this.authService.setOnboardingCompleted(Boolean(resolvedProfile.onboarding_completed));
    this.avatarPreview.set(resolvedProfile.avatar_url || null);
    this.avatarFileName.set(null);

    this.profileForm.patchValue({
      display_name: resolvedProfile.display_name || '',
      bio: resolvedProfile.bio || '',
      gym_name: resolvedProfile.gym_name || '',
      height_cm: Number(resolvedProfile.height_cm || 170),
      current_weight_kg: Number(resolvedProfile.current_weight_kg || 70),
      target_weight_kg: Number(resolvedProfile.target_weight_kg || 70),
      weekly_gym_target: Number(resolvedProfile.weekly_gym_target || 3),
      activity_level: (resolvedProfile.activity_level || 'moderate') as 'low' | 'moderate' | 'high',
      theme_seed_color: resolvedThemeSeed
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
      this.errorMessage.set(formatAppError(error, 'Gewichtseinträge konnten nicht geladen werden'));
      return;
    }

    this.weightLogs.set((data || []) as WeightLog[]);
  }

  async loadGymProgress(): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const weekStart = this.getWeekStart(this.formatDate(new Date()));
    const weekEnd = this.formatDate(new Date(new Date(`${weekStart}T00:00:00`).getTime() + 6 * 24 * 60 * 60 * 1000));

    const { data } = await this.supabaseService.client
      .from('community_posts')
      .select('day')
      .eq('user_id', user.id)
      .eq('post_type', 'gym_checkin')
      .gte('day', weekStart)
      .lte('day', weekEnd);

    const uniqueDays = new Set((data || []).map(entry => String(entry.day)));
    this.gymWeekSessions.set(uniqueDays.size);
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.avatarFileName.set(null);
      return;
    }

    this.avatarFile = file;
    this.avatarFileName.set(file.name);
    this.avatarPreview.set(URL.createObjectURL(file));
  }

  pickAvatar(): void {
    this.avatarInput()?.nativeElement.click();
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
      const normalizedThemeSeed = this.themeService.applySeed(formValue.theme_seed_color, { persistLocal: false });

      const payload = {
        user_id: user.id,
        display_name: formValue.display_name.trim() || null,
        bio: formValue.bio.trim() || null,
        gym_name: formValue.gym_name.trim() || null,
        avatar_url: avatarUrl,
        height_cm: formValue.height_cm,
        current_weight_kg: formValue.current_weight_kg,
        target_weight_kg: formValue.target_weight_kg,
        weekly_gym_target: formValue.weekly_gym_target,
        activity_level: formValue.activity_level,
        theme_seed_color: normalizedThemeSeed,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabaseService.client
        .from('profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        throw error;
      }

      this.avatarFile = null;
      this.avatarFileName.set(null);
      this.profileForm.controls.theme_seed_color.setValue(normalizedThemeSeed);
      this.themeService.applySeed(normalizedThemeSeed, { persistLocal: true });
      this.successMessage.set('Profil gespeichert.');
      await this.loadAll();
    } catch (error) {
      this.errorMessage.set(formatAppError(error, 'Profil konnte nicht gespeichert werden'));
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
      this.errorMessage.set(formatAppError(error, 'Gewichtseintrag konnte nicht gespeichert werden'));
    } finally {
      this.savingWeight.set(false);
    }
  }

  async resetOnboarding(): Promise<void> {
    this.successMessage.set(null);
    this.errorMessage.set(null);

    if (typeof window !== 'undefined') {
      const shouldReset = window.confirm(
        'Onboarding neu starten? Profildaten und Gewichtsverlauf werden zurückgesetzt. Zutaten und Mahlzeiten bleiben erhalten.'
      );
      if (!shouldReset) {
        return;
      }
    }

    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.savingProfile.set(true);

    try {
      const { error: profileError } = await this.supabaseService.client
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            display_name: null,
            bio: null,
            avatar_url: null,
            age: null,
            height_cm: null,
            current_weight_kg: null,
            target_weight_kg: null,
            weekly_gym_target: 3,
            activity_level: 'moderate',
            theme_seed_color: this.themeService.getDefaultSeed(),
            onboarding_completed: false,
            track_nutrition: true,
            track_gym: true,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );

      if (profileError) {
        throw profileError;
      }

      this.authService.setOnboardingCompleted(false);

      const { error: weightsError } = await this.supabaseService.client
        .from('weight_logs')
        .delete()
        .eq('user_id', user.id);

      if (weightsError) {
        throw weightsError;
      }

      await this.router.navigate(['/onboarding']);
      this.themeService.applySeed(this.themeService.getDefaultSeed(), { persistLocal: true });
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Onboarding konnte nicht zurückgesetzt werden'));
    } finally {
      this.savingProfile.set(false);
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

  onThemeSeedPickerInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.profileForm.controls.theme_seed_color.setValue(value);
    this.themeService.applySeed(value, { persistLocal: false });
  }

  onThemeSeedTextInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) {
      this.themeService.applySeed(value, { persistLocal: false });
    }
  }

  normalizeThemeSeedControl(): void {
    const rawValue = this.profileForm.controls.theme_seed_color.value;
    const normalized = this.themeService.applySeed(rawValue, { persistLocal: false });
    this.profileForm.controls.theme_seed_color.setValue(normalized);
  }

  applyThemePreset(seed: string): void {
    this.profileForm.controls.theme_seed_color.setValue(seed);
    this.themeService.applySeed(seed, { persistLocal: false });
  }
}
