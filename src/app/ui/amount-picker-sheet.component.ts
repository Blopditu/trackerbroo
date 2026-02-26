import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface AmountPickResult {
  amount: number;
  totals: MacroTotals;
}

@Component({
  selector: 'app-amount-picker-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sheet-overlay" role="dialog" aria-modal="true" [attr.aria-label]="'Menge für ' + itemName()">
      <div class="sheet-card">
        <h2 class="title-font">Menge wählen</h2>
        <p class="item">{{ itemName() }}</p>

        <div class="preset-row" role="group" aria-label="Schnellmengen">
          @for (preset of presets(); track preset) {
            <button type="button" class="action-btn ghost" [class.active]="amount() === preset" (click)="amount.set(preset)">
              {{ preset }}{{ unitLabel() }}
            </button>
          }
        </div>

        <label for="custom-amount">Eigene Menge</label>
        <input id="custom-amount" type="number" min="0.1" step="0.1" [(ngModel)]="customAmount">
        <button type="button" class="action-btn ghost apply-btn" (click)="applyCustomAmount()">Übernehmen</button>

        <div class="preview">
          <span>{{ amount() }}{{ unitLabel() }}</span>
          <span>P {{ totals().protein.toFixed(1) }}g · K {{ totals().kcal.toFixed(0) }}</span>
        </div>

        <div class="actions">
          <button type="button" class="action-btn" (click)="confirm()">Add</button>
          <button type="button" class="action-btn ghost" (click)="closed.emit()">Abbrechen</button>
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

    .item {
      margin: 0;
      color: var(--ink-500);
      font-weight: 700;
      font-size: var(--text-sm);
    }

    .preset-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.4rem;
    }

    .preset-row button {
      min-height: 40px;
      padding: 0.3rem;
      font-size: var(--text-xs);
    }

    .preset-row button.active {
      border-color: var(--accent-500);
      background: var(--accent-soft);
      color: var(--ink-900);
    }

    label {
      font-size: var(--text-sm);
      font-weight: 700;
      color: var(--ink-700);
    }

    .apply-btn {
      min-height: 40px;
    }

    .preview {
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      background: #131d2b;
      padding: 0.55rem;
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      font-size: var(--text-sm);
      color: var(--ink-700);
    }

    .actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.5rem;
    }
  `]
})
export class AmountPickerSheetComponent {
  readonly itemName = input.required<string>();
  readonly unitLabel = input.required<string>();
  readonly presets = input.required<number[]>();
  readonly baseAmount = input.required<number>();
  readonly baseMacros = input.required<MacroTotals>();
  readonly initialAmount = input(100);

  readonly closed = output<void>();
  readonly confirmed = output<AmountPickResult>();

  readonly amount = signal(100);
  customAmount = 100;

  readonly totals = computed(() => {
    const factor = this.amount() / this.baseAmount();
    return {
      kcal: Number(this.baseMacros().kcal) * factor,
      protein: Number(this.baseMacros().protein) * factor,
      carbs: Number(this.baseMacros().carbs) * factor,
      fat: Number(this.baseMacros().fat) * factor
    };
  });

  constructor() {
    effect(() => {
      const initialAmount = this.initialAmount();
      this.amount.set(initialAmount);
      this.customAmount = initialAmount;
    });
  }

  applyCustomAmount(): void {
    if (this.customAmount > 0) {
      this.amount.set(this.customAmount);
    }
  }

  confirm(): void {
    this.confirmed.emit({
      amount: this.amount(),
      totals: this.totals()
    });
  }
}
