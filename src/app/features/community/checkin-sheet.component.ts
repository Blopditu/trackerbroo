import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PactCheckinPayload {
  day: string;
  gym_done: boolean;
  sleep_done: boolean;
  protein_done: boolean;
  confirm_done: boolean;
  note: string;
  photo: File | null;
}

@Component({
  selector: 'app-checkin-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sheet-overlay" role="dialog" aria-modal="true" aria-label="Ritual Check-in">
      <div class="sheet-card">
        <h2 class="title-font">Ritual Check-in</h2>

        <label for="checkin-day">Tag</label>
        <input id="checkin-day" type="date" [(ngModel)]="day">

        <div class="toggles" role="group" aria-label="Rituale">
          <button type="button" class="toggle" [class.active]="gymDone" (click)="gymDone = !gymDone">Gym gemacht</button>
          <button type="button" class="toggle" [class.active]="sleepDone" (click)="sleepDone = !sleepDone">8h Schlaf</button>
          <button type="button" class="toggle" [class.active]="proteinDone" (click)="proteinDone = !proteinDone">100g Protein</button>
          <button type="button" class="toggle" [class.active]="confirmDone" (click)="confirmDone = !confirmDone">Morgen-Abend Meldung</button>
        </div>

        <label for="checkin-note">Notiz (optional)</label>
        <textarea id="checkin-note" rows="2" [(ngModel)]="note" placeholder="Kurzer Kontext"></textarea>

        <label for="checkin-photo">Foto (optional)</label>
        <input id="checkin-photo" type="file" accept="image/*" (change)="onPhotoSelected($event)">

        <div class="actions">
          <button type="button" class="action-btn" [disabled]="saving()" (click)="submit()">{{ saving() ? 'Posting...' : 'Posten' }}</button>
          <button type="button" class="action-btn ghost" [disabled]="saving()" (click)="closed.emit()">Abbrechen</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sheet-overlay {
      position: fixed;
      inset: 0;
      z-index: 33;
      display: grid;
      align-items: end;
      background: rgba(4, 8, 12, 0.68);
      padding: 0.6rem;
    }

    .sheet-card {
      background: var(--bg-surface-2);
      border: 1px solid var(--border-strong);
      border-radius: 16px 16px 10px 10px;
      padding: 0.95rem;
      display: grid;
      gap: 0.55rem;
    }

    label {
      font-size: var(--text-sm);
      font-weight: 700;
      color: var(--ink-700);
    }

    .toggles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.4rem;
    }

    .toggle {
      min-height: 40px;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      background: #142031;
      color: var(--ink-700);
      font-weight: 700;
      font-size: var(--text-sm);
      padding: 0.35rem;
    }

    .toggle.active {
      border-color: var(--accent-500);
      background: var(--accent-soft);
      color: var(--ink-900);
    }

    .actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.5rem;
    }
  `]
})
export class CheckinSheetComponent {
  readonly saving = input(false);
  readonly initialDay = input.required<string>();
  readonly submitted = output<PactCheckinPayload>();
  readonly closed = output<void>();

  day = '';
  gymDone = false;
  sleepDone = false;
  proteinDone = false;
  confirmDone = false;
  note = '';
  photo: File | null = null;

  constructor() {
    effect(() => {
      this.day = this.initialDay();
    });
  }

  onPhotoSelected(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.photo = inputElement.files?.[0] || null;
  }

  submit(): void {
    this.submitted.emit({
      day: this.day,
      gym_done: this.gymDone,
      sleep_done: this.sleepDone,
      protein_done: this.proteinDone,
      confirm_done: this.confirmDone,
      note: this.note.trim(),
      photo: this.photo
    });
  }
}
