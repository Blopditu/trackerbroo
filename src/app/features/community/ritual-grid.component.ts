import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ritual-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="grid-wrap" role="table" aria-label="Wöchentliche Ritualübersicht">
      <div class="head" role="row">
        <span role="columnheader">Ritual</span>
        @for (day of days(); track day.date) {
          <span role="columnheader">{{ day.label }}</span>
        }
      </div>

      @for (row of rows(); track row.key) {
        <div class="row" role="row">
          <strong role="rowheader">{{ row.label }}</strong>
          @for (day of days(); track day.date) {
            <span
              role="cell"
              class="cell"
              [class.done]="row.values[day.date]"
              [attr.aria-label]="row.label + ' ' + day.label + ': ' + (row.values[day.date] ? 'erfüllt' : 'offen')"
            ></span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .grid-wrap {
      display: grid;
      gap: 0.4rem;
    }

    .head,
    .row {
      display: grid;
      grid-template-columns: 88px repeat(7, minmax(0, 1fr));
      gap: 0.3rem;
      align-items: center;
    }

    .head {
      color: var(--ink-500);
      font-size: var(--text-xs);
      font-weight: 700;
    }

    .row strong {
      font-size: var(--text-xs);
      color: var(--ink-700);
    }

    .cell {
      display: block;
      width: 100%;
      height: 14px;
      border-radius: 4px;
      border: 1px solid var(--border-strong);
      background: #121b27;
    }

    .cell.done {
      border-color: var(--accent-500);
      background: var(--accent-500);
    }
  `]
})
export class RitualGridComponent {
  readonly days = input.required<Array<{ date: string; label: string }>>();
  readonly rows = input.required<Array<{ key: string; label: string; values: Record<string, boolean> }>>();
}
