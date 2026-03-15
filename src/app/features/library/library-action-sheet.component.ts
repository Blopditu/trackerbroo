import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-library-action-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule],
  template: `
    @if (label()) {
      <article class="sheet-preview">
        <strong>{{ label() }}</strong>
        <p class="sub">{{ subLabel() }}</p>
      </article>
    }
    <div class="action-sheet-list">
      <button mat-flat-button type="button" class="action-btn tonal" (click)="edit.emit()">Bearbeiten</button>
      <button mat-flat-button type="button" class="action-btn danger" (click)="remove.emit()">Löschen</button>
    </div>
  `
})
export class LibraryActionSheetComponent {
  readonly label = input.required<string>();
  readonly subLabel = input.required<string>();
  readonly edit = output<void>();
  readonly remove = output<void>();
}
