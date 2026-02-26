import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-bottom-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (open()) {
      <div class="overlay" (click)="closed.emit()">
        <section class="sheet" role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
          <div class="head">
            <h2>{{ title() }}</h2>
            <button type="button" class="close" (click)="closed.emit()" aria-label="Schließen">✕</button>
          </div>
          <ng-content />
        </section>
      </div>
    }
  `,
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 40;
      display: grid;
      align-items: end;
      background: rgba(0, 0, 0, 0.5);
    }

    .sheet {
      background: #151922;
      border-top: 1px solid #1B202B;
      padding: 16px;
      max-height: 80vh;
      overflow: auto;
    }

    .head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    h2 {
      margin: 0;
      font-size: 20px;
      color: #E6E8EC;
      font-weight: 600;
    }

    .close {
      width: 32px;
      height: 32px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #A4A9B6;
      font-size: 13px;
      line-height: 1;
    }
  `]
})
export class BottomSheetComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly closed = output<void>();
}
