import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { Profile } from '../../core/types';
import { formatAppError } from '../../core/error-format';

@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="page onboarding-page">
      @if (errorMessage()) {
        <p class="toast error" aria-live="polite">{{ errorMessage() }}</p>
      }

      <section class="panel halftone">
        <p class="title-font">TRACKER BROO</p>
        <h1>Dein Start in mehr Konsistenz</h1>
        <p class="lead">Kurzes Setup und dann direkt los mit Gym- und Ernährungstracking.</p>
      </section>

      @if (loading()) {
        <section class="panel">
          <div class="skeleton card"></div>
        </section>
      } @else {
        <section class="panel">
          <div class="progress">Schritt {{ step() + 1 }} von {{ totalSteps }}</div>

          <form [formGroup]="onboardingForm" (ngSubmit)="finish()" class="stack-form">
            @if (step() === 0) {
              <h2>Willkommen</h2>
              <p class="body-text">
                Hier geht es nicht um perfekte Tage, sondern um Routine. Wir helfen dir, Essen und Training
                verlässlich zu tracken.
              </p>
            }

            @if (step() === 1) {
              <h2>Basisdaten</h2>

              <label for="display_name">Name</label>
              <input id="display_name" type="text" formControlName="display_name" placeholder="Dein Name">

              <label for="age">Alter</label>
              <input id="age" type="number" min="10" max="120" formControlName="age">

              <label for="height_cm">Größe (cm)</label>
              <input id="height_cm" type="number" min="80" max="260" formControlName="height_cm">

              <label for="current_weight_kg">Aktuelles Gewicht (kg)</label>
              <input id="current_weight_kg" type="number" min="20" step="0.1" formControlName="current_weight_kg">
            }

            @if (step() === 2) {
              <h2>Dein Rhythmus</h2>

              <label for="weekly_gym_target">Gym pro Woche</label>
              <input id="weekly_gym_target" type="number" min="1" max="14" formControlName="weekly_gym_target">

              <label for="activity_level">Aktivitätslevel</label>
              <select id="activity_level" formControlName="activity_level">
                <option value="low">Niedrig</option>
                <option value="moderate">Mittel</option>
                <option value="high">Hoch</option>
              </select>
            }

            @if (step() === 3) {
              <h2>Tracking Setup</h2>

              <label for="track_nutrition">Ernährung tracken</label>
              <select id="track_nutrition" formControlName="track_nutrition">
                <option [ngValue]="true">Ja</option>
                <option [ngValue]="false">Nein</option>
              </select>

              <label for="track_gym">Gym tracken</label>
              <select id="track_gym" formControlName="track_gym">
                <option [ngValue]="true">Ja</option>
                <option [ngValue]="false">Nein</option>
              </select>
            }

            <div class="actions">
              @if (step() > 0) {
                <button type="button" class="action-btn ghost" (click)="prevStep()">Zurück</button>
              }

              @if (step() < totalSteps - 1) {
                <button type="button" class="action-btn" (click)="nextStep()" [disabled]="!canGoNext()">
                  Weiter
                </button>
              } @else {
                <button type="submit" class="action-btn" [disabled]="saving() || !canFinish()">
                  {{ saving() ? 'Wird gespeichert...' : 'Starten' }}
                </button>
              }
            </div>
          </form>
        </section>
      }
    </main>
  `,
  styles: [`
    .onboarding-page {
      display: grid;
      gap: 0.75rem;
    }

    h1 {
      margin-top: 0.2rem;
      font-size: 1.6rem;
    }

    .lead {
      margin: 0.35rem 0 0;
      color: var(--ink-500);
      font-size: var(--text-sm);
      font-weight: 600;
    }

    .progress {
      margin-bottom: 0.65rem;
      font-size: var(--text-sm);
      color: var(--ink-500);
      font-weight: 700;
    }

    .stack-form {
      display: grid;
      gap: 0.55rem;
    }

    .stack-form label {
      font-size: var(--text-sm);
      color: var(--ink-700);
      font-weight: 700;
    }

    .body-text {
      color: var(--ink-600);
      font-weight: 600;
      line-height: 1.4;
    }

    .actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.35rem;
    }

    .actions .action-btn {
      flex: 1;
    }
  `]
})
export class OnboardingComponent implements OnInit {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly step = signal(0);
  readonly totalSteps = 4;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private existingProfile = signal<Profile | null>(null);

  readonly onboardingForm = this.formBuilder.group(
    {
      display_name: ['', [Validators.required, Validators.minLength(2)]],
      age: [null as number | null, [Validators.required, Validators.min(10), Validators.max(120)]],
      height_cm: [null as number | null, [Validators.required, Validators.min(80), Validators.max(260)]],
      current_weight_kg: [null as number | null, [Validators.required, Validators.min(20)]],
      weekly_gym_target: [3, [Validators.required, Validators.min(1), Validators.max(14)]],
      activity_level: ['moderate' as 'low' | 'moderate' | 'high', [Validators.required]],
      track_nutrition: [true, [Validators.required]],
      track_gym: [true, [Validators.required]]
    },
    { updateOn: 'change' }
  );

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
      await this.router.navigate(['/today']);
      return;
    }

    this.onboardingForm.patchValue({
      display_name: profile?.display_name || '',
      age: profile?.age ?? null,
      height_cm: profile?.height_cm ? Number(profile.height_cm) : null,
      current_weight_kg: profile?.current_weight_kg ? Number(profile.current_weight_kg) : null,
      weekly_gym_target: profile?.weekly_gym_target || 3,
      activity_level: profile?.activity_level || 'moderate',
      track_nutrition: profile?.track_nutrition ?? true,
      track_gym: profile?.track_gym ?? true
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
    this.step.update(value => Math.min(value + 1, this.totalSteps - 1));
  }

  prevStep(): void {
    this.step.update(value => Math.max(value - 1, 0));
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
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabaseService.client
        .from('profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

      await this.router.navigate(['/today']);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Onboarding konnte nicht gespeichert werden'));
    } finally {
      this.saving.set(false);
    }
  }

  private isValid(controlNames: string[]): boolean {
    return controlNames.every(name => this.onboardingForm.controls[name as keyof typeof this.onboardingForm.controls].valid);
  }

  canGoNext(): boolean {
    if (this.step() === 0) return true;
    if (this.step() === 1) {
      return this.isValid(['display_name', 'age', 'height_cm', 'current_weight_kg']);
    }
    if (this.step() === 2) {
      return this.isValid(['weekly_gym_target', 'activity_level']);
    }
    return this.isValid(['track_nutrition', 'track_gym']);
  }

  canFinish(): boolean {
    return this.onboardingForm.valid;
  }
}
