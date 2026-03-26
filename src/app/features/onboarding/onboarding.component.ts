import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { Profile } from '../../core/types';
import { formatAppError } from '../../core/error-format';

@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <main class="px-4 py-4 sm:px-6 lg:px-8">
      @if (errorMessage()) {
        <p class="toast error" role="status" aria-live="polite" aria-atomic="true">
          {{ errorMessage() }}
        </p>
      }

      <section
        class="mx-auto grid max-w-5xl gap-3 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]"
      >
        <aside
          class="rounded-[1.45rem] bg-[radial-gradient(circle_at_top_right,rgba(0,228,117,0.08),transparent_34%),linear-gradient(180deg,rgba(31,34,32,0.98),rgba(18,20,19,0.98))] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.28)] sm:p-6"
        >
          <p class="text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-shell-accent">
            Tracker Broo
          </p>
          <h1
            class="mt-3 text-[2rem] font-extrabold tracking-[-0.06em] text-shell-ink sm:text-[2.15rem]"
          >
            Dein Start in mehr Konsistenz
          </h1>
          <p class="mt-2 text-sm leading-6 text-shell-ink-muted">
            Ein kurzes Setup, dann direkt ins Tracking.
          </p>

          <div class="mt-6 grid gap-2">
            @for (index of stepIndicators; track index) {
              <div
                class="rounded-[1rem] px-3 py-2.5 transition"
                [class.bg-shell-accent-muted]="index === step()"
                [class.bg-shell-card-strong]="index !== step()"
              >
                <p
                  class="text-[0.68rem] font-extrabold uppercase tracking-[0.24em]"
                  [class.text-shell-accent]="index === step()"
                  [class.text-shell-ink-muted]="index !== step()"
                >
                  Schritt {{ index + 1 }}
                </p>
                <p
                  class="mt-1.5 text-[0.98rem] font-bold"
                  [class.text-shell-ink]="index === step()"
                  [class.text-shell-ink-muted]="index !== step()"
                >
                  {{ stepTitle(index) }}
                </p>
              </div>
            }
          </div>
        </aside>

        @if (loading()) {
          <section
            class="rounded-[1.45rem] bg-[linear-gradient(180deg,rgba(30,32,31,0.98),rgba(18,20,19,0.98))] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.28)] sm:p-6"
          >
            <div class="skeleton card"></div>
          </section>
        } @else {
          <section
            class="rounded-[1.45rem] bg-[linear-gradient(180deg,rgba(30,32,31,0.98),rgba(18,20,19,0.98))] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.28)] sm:p-6"
          >
            <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p
                  class="text-[0.68rem] font-extrabold uppercase tracking-[0.28em] text-shell-accent"
                >
                  Setup
                </p>
                <h2
                  class="mt-1 text-[1.65rem] font-extrabold tracking-[-0.05em] text-shell-ink sm:text-[1.95rem]"
                >
                  {{ stepTitle(step()) }}
                </h2>
              </div>
              <div
                class="rounded-full border border-shell-border bg-shell-card-strong px-3.5 py-1.5 text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-shell-ink-muted"
              >
                Schritt {{ step() + 1 }} / {{ totalSteps }}
              </div>
            </div>

            <form [formGroup]="onboardingForm" (ngSubmit)="finish()" class="grid gap-4">
              @if (step() === 0) {
                <section class="grid gap-4">
                  <p class="max-w-2xl text-sm leading-7 text-shell-ink-muted">
                    Nicht Perfektion, sondern Wiederholbarkeit. Tracking soll schnell, klar und
                    alltagstauglich sein.
                  </p>
                  <div class="grid gap-3 md:grid-cols-3">
                    <article class="rounded-[1rem] bg-shell-card-strong p-4">
                      <p
                        class="text-[0.68rem] font-extrabold uppercase tracking-[0.24em] text-shell-accent"
                      >
                        Heute
                      </p>
                      <p class="mt-2 text-lg font-extrabold tracking-[-0.04em] text-shell-ink">
                        Schnell loggen
                      </p>
                    </article>
                    <article class="rounded-[1rem] bg-shell-card-strong p-4">
                      <p
                        class="text-[0.68rem] font-extrabold uppercase tracking-[0.24em] text-shell-accent"
                      >
                        Gym
                      </p>
                      <p class="mt-2 text-lg font-extrabold tracking-[-0.04em] text-shell-ink">
                        Aktive Session
                      </p>
                    </article>
                    <article class="rounded-[1rem] bg-shell-card-strong p-4">
                      <p
                        class="text-[0.68rem] font-extrabold uppercase tracking-[0.24em] text-shell-accent"
                      >
                        Insights
                      </p>
                      <p class="mt-2 text-lg font-extrabold tracking-[-0.04em] text-shell-ink">
                        Klare Verläufe
                      </p>
                    </article>
                  </div>
                </section>
              }

              @if (step() === 1) {
                <section class="grid gap-4 md:grid-cols-2">
                  <mat-form-field
                    class="m3-field md:col-span-2"
                    appearance="outline"
                    subscriptSizing="dynamic"
                  >
                    <mat-label>Name</mat-label>
                    <input
                      matInput
                      id="display_name"
                      type="text"
                      formControlName="display_name"
                      placeholder="Dein Name"
                    />
                  </mat-form-field>

                  <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Alter</mat-label>
                    <input
                      matInput
                      id="age"
                      type="number"
                      min="10"
                      max="120"
                      formControlName="age"
                    />
                  </mat-form-field>

                  <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Größe (cm)</mat-label>
                    <input
                      matInput
                      id="height_cm"
                      type="number"
                      min="80"
                      max="260"
                      formControlName="height_cm"
                    />
                  </mat-form-field>

                  <mat-form-field
                    class="m3-field md:col-span-2"
                    appearance="outline"
                    subscriptSizing="dynamic"
                  >
                    <mat-label>Aktuelles Gewicht (kg)</mat-label>
                    <input
                      matInput
                      id="current_weight_kg"
                      type="number"
                      min="20"
                      step="0.1"
                      formControlName="current_weight_kg"
                    />
                  </mat-form-field>
                </section>
              }

              @if (step() === 2) {
                <section class="grid gap-4 md:grid-cols-2">
                  <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Gym pro Woche</mat-label>
                    <input
                      matInput
                      id="weekly_gym_target"
                      type="number"
                      min="1"
                      max="14"
                      formControlName="weekly_gym_target"
                    />
                  </mat-form-field>

                  <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Aktivitätslevel</mat-label>
                    <mat-select id="activity_level" formControlName="activity_level">
                      <mat-option value="low">Niedrig</mat-option>
                      <mat-option value="moderate">Mittel</mat-option>
                      <mat-option value="high">Hoch</mat-option>
                    </mat-select>
                  </mat-form-field>
                </section>
              }

              @if (step() === 3) {
                <section class="grid gap-4 md:grid-cols-2">
                  <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Ernährung tracken</mat-label>
                    <mat-select id="track_nutrition" formControlName="track_nutrition">
                      <mat-option [value]="true">Ja</mat-option>
                      <mat-option [value]="false">Nein</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Gym tracken</mat-label>
                    <mat-select id="track_gym" formControlName="track_gym">
                      <mat-option [value]="true">Ja</mat-option>
                      <mat-option [value]="false">Nein</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Schritte tracken</mat-label>
                    <mat-select id="track_steps" formControlName="track_steps">
                      <mat-option [value]="true">Ja</mat-option>
                      <mat-option [value]="false">Nein</mat-option>
                    </mat-select>
                  </mat-form-field>

                  @if (onboardingForm.controls.track_steps.value) {
                    <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Schrittziel pro Tag</mat-label>
                      <input
                        matInput
                        id="daily_steps_target"
                        type="number"
                        min="1000"
                        max="50000"
                        formControlName="daily_steps_target"
                      />
                    </mat-form-field>
                  }
                </section>
              }

              @if (step() === 4) {
                <section class="grid gap-4">
                  <p class="max-w-2xl text-sm leading-7 text-shell-ink-muted">
                    Installiert fühlt sich Tracker Broo wie eine richtige App an und bleibt
                    schneller erreichbar.
                  </p>

                  <div class="grid gap-3 md:grid-cols-3">
                    @for (guide of installGuides; track guide.platform) {
                      <article class="rounded-[1rem] bg-shell-card-strong p-4">
                        <strong
                          class="text-sm font-extrabold uppercase tracking-[0.18em] text-shell-accent"
                          >{{ guide.platform }}</strong
                        >
                        <p class="mt-3 text-sm leading-6 text-shell-ink-muted">{{ guide.steps }}</p>
                      </article>
                    }
                  </div>
                </section>
              }

              <div class="mt-1 flex flex-wrap justify-between gap-3 pt-4">
                <div class="max-w-[34rem] text-sm text-shell-ink-muted">
                  {{ helperCopy(step()) }}
                </div>

                <div class="flex flex-wrap gap-3">
                  @if (step() > 0) {
                    <button
                      mat-flat-button
                      type="button"
                      class="action-btn ghost"
                      (click)="prevStep()"
                    >
                      Zurück
                    </button>
                  }

                  @if (step() < totalSteps - 1) {
                    <button
                      mat-flat-button
                      type="button"
                      class="action-btn"
                      (click)="nextStep()"
                      [disabled]="!canGoNext()"
                    >
                      Weiter
                    </button>
                  } @else {
                    <button
                      mat-flat-button
                      type="submit"
                      class="action-btn"
                      [disabled]="saving() || !canFinish()"
                    >
                      {{ saving() ? 'Wird eingerichtet …' : 'Loslegen' }}
                    </button>
                  }
                </div>
              </div>
            </form>
          </section>
        }
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class OnboardingComponent implements OnInit {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly step = signal(0);
  readonly totalSteps = 5;
  readonly stepIndicators = [0, 1, 2, 3, 4];
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly installGuides = [
    {
      platform: 'macOS Safari',
      steps: 'Seite öffnen, Teilen wählen und dann Zum Dock hinzufügen.',
    },
    {
      platform: 'iPhone Safari',
      steps:
        'Seite öffnen, Teilen tippen und dann Zum Home-Bildschirm. Falls angeboten, Als Web-App öffnen aktivieren.',
    },
    {
      platform: 'Android Chrome',
      steps:
        'Seite öffnen und im Browser-Menü Install app oder Zum Startbildschirm hinzufügen wählen.',
    },
  ];

  private existingProfile = signal<Profile | null>(null);

  readonly onboardingForm = this.formBuilder.group(
    {
      display_name: ['', [Validators.required, Validators.minLength(2)]],
      age: [null as number | null, [Validators.required, Validators.min(10), Validators.max(120)]],
      height_cm: [
        null as number | null,
        [Validators.required, Validators.min(80), Validators.max(260)],
      ],
      current_weight_kg: [null as number | null, [Validators.required, Validators.min(20)]],
      weekly_gym_target: [3, [Validators.required, Validators.min(1), Validators.max(14)]],
      activity_level: ['moderate' as 'low' | 'moderate' | 'high', [Validators.required]],
      track_nutrition: [true, [Validators.required]],
      track_gym: [true, [Validators.required]],
      track_steps: [false, [Validators.required]],
      daily_steps_target: [8000, [Validators.min(1000), Validators.max(50000)]],
    },
    { updateOn: 'change' },
  );

  stepTitle(index: number): string {
    if (index === 0) return 'Willkommen';
    if (index === 1) return 'Basisdaten';
    if (index === 2) return 'Dein Rhythmus';
    if (index === 3) return 'Tracking Setup';
    return 'Als Web-App nutzen';
  }

  helperCopy(index: number): string {
    if (index === 0) return 'Ein kurzer Überblick, bevor du loslegst.';
    if (index === 1) return 'Nur die Basiswerte, die du später wirklich brauchst.';
    if (index === 2) return 'Damit Trainings- und Zielkarten sinnvoll starten.';
    if (index === 3) return 'Tracking nur dort aktivieren, wo es dir wirklich hilft.';
    return 'Optional, aber für den Alltag klar besser.';
  }

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    const user = this.authService.user();
    if (!user) {
      await this.router.navigate(['/login']);
      return;
    }

    const { data, error } = await this.supabaseService.client
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      this.errorMessage.set(formatAppError(error, 'Onboarding-Profil konnte nicht geladen werden'));
      this.loading.set(false);
      return;
    }

    const profile = (data as Profile | null) || null;
    this.existingProfile.set(profile);

    if (profile?.onboarding_completed) {
      this.authService.setOnboardingCompleted(true);
      await this.router.navigate(['/today']);
      return;
    }

    this.authService.setOnboardingCompleted(false);

    this.onboardingForm.patchValue({
      display_name: profile?.display_name || '',
      age: profile?.age ?? null,
      height_cm: profile?.height_cm ? Number(profile.height_cm) : null,
      current_weight_kg: profile?.current_weight_kg ? Number(profile.current_weight_kg) : null,
      weekly_gym_target: profile?.weekly_gym_target || 3,
      activity_level: profile?.activity_level || 'moderate',
      track_nutrition: profile?.track_nutrition ?? true,
      track_gym: profile?.track_gym ?? true,
      track_steps: profile?.track_steps ?? false,
      daily_steps_target: Number(profile?.daily_steps_target || 8000),
    });

    this.loading.set(false);
  }

  nextStep(): void {
    this.errorMessage.set(null);
    this.onboardingForm.updateValueAndValidity({ emitEvent: false });
    if (!this.canGoNext()) {
      this.onboardingForm.markAllAsTouched();
      this.errorMessage.set('Bitte prüfe deine Eingaben in diesem Schritt.');
      return;
    }
    this.step.update((value) => Math.min(value + 1, this.totalSteps - 1));
  }

  prevStep(): void {
    this.step.update((value) => Math.max(value - 1, 0));
  }

  async finish(): Promise<void> {
    this.errorMessage.set(null);
    if (!this.canFinish()) {
      this.onboardingForm.markAllAsTouched();
      return;
    }

    const user = this.authService.user();
    if (!user) return;

    this.saving.set(true);
    try {
      const formValue = this.onboardingForm.getRawValue();
      const payload = {
        user_id: user.id,
        display_name: (formValue.display_name || '').trim() || null,
        age: formValue.age,
        height_cm: formValue.height_cm,
        current_weight_kg: formValue.current_weight_kg,
        target_weight_kg: this.existingProfile()?.target_weight_kg ?? formValue.current_weight_kg,
        weekly_gym_target: formValue.weekly_gym_target,
        activity_level: formValue.activity_level,
        track_nutrition: formValue.track_nutrition,
        track_gym: formValue.track_gym,
        track_steps: formValue.track_steps,
        daily_steps_target: formValue.track_steps ? formValue.daily_steps_target : 8000,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.supabaseService.client
        .from('profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

      this.authService.setOnboardingCompleted(true);
      await this.router.navigate(['/today']);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Onboarding konnte nicht gespeichert werden'));
    } finally {
      this.saving.set(false);
    }
  }

  private isValid(controlNames: string[]): boolean {
    return controlNames.every(
      (name) =>
        this.onboardingForm.controls[name as keyof typeof this.onboardingForm.controls].valid,
    );
  }

  canGoNext(): boolean {
    if (this.step() === 0) return true;
    if (this.step() === 1) {
      return this.isValid(['display_name', 'age', 'height_cm', 'current_weight_kg']);
    }
    if (this.step() === 2) {
      return this.isValid(['weekly_gym_target', 'activity_level']);
    }
    if (this.step() === 3) {
      return (
        this.isValid(['track_nutrition', 'track_gym', 'track_steps']) &&
        (!this.onboardingForm.controls.track_steps.value || this.isValid(['daily_steps_target']))
      );
    }
    return true;
  }

  canFinish(): boolean {
    return this.canGoNext() && this.onboardingForm.valid;
  }
}
