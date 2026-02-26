import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-list-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="row">
      <div class="left">
        <strong>{{ title() }}</strong>
        @if (subtitle()) {
          <span>{{ subtitle() }}</span>
        }
      </div>
      @if (meta()) {
        <span class="meta">{{ meta() }}</span>
      }
    </div>
  `,
  styles: [`
    .row {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #1B202B;
    }

    .left {
      display: grid;
      gap: 4px;
    }

    strong {
      font-size: 16px;
      color: #E6E8EC;
      font-weight: 600;
      line-height: 1.2;
    }

    span {
      font-size: 13px;
      color: #A4A9B6;
      line-height: 1.2;
    }

    .meta {
      font-size: 13px;
      color: #6E7483;
      font-weight: 600;
      white-space: nowrap;
    }
  `]
})
export class ListRowComponent {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly meta = input('');
}
