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
      border-bottom: 1px solid var(--m3-sys-color-outline-variant);
    }

    .left {
      display: grid;
      gap: 4px;
    }

    strong {
      font-size: 16px;
      color: var(--m3-sys-color-on-surface);
      font-weight: 600;
      line-height: 1.2;
    }

    span {
      font-size: 13px;
      color: var(--m3-sys-color-on-surface-variant);
      line-height: 1.2;
    }

    .meta {
      font-size: 13px;
      color: color-mix(in srgb, var(--m3-sys-color-on-surface-variant) 72%, transparent);
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
