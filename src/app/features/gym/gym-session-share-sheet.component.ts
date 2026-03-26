import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-gym-session-share-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <p class="muted">{{ suggestion() }}</p>
    <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
      <mat-label>Notiz (optional)</mat-label>
      <textarea
        matInput
        id="session-share-note"
        rows="2"
        [ngModel]="note()"
        (ngModelChange)="noteChange.emit($event)"
        placeholder="Wie lief das Training?"
      ></textarea>
    </mat-form-field>

    <p class="file-label">Foto (optional)</p>
    <div class="file-row">
      <button mat-flat-button type="button" class="action-btn ghost compact" (click)="pickPhoto()">
        Foto auswählen
      </button>
      <span class="file-name">{{ photoName() || 'Kein Foto ausgewählt' }}</span>
    </div>
    <input
      #photoInput
      class="sr-only"
      type="file"
      accept="image/*"
      (change)="onPhotoSelected($event)"
    />

    <div class="action-list">
      <button
        mat-flat-button
        type="button"
        class="action-btn"
        [disabled]="sharing()"
        (click)="submit.emit()"
      >
        {{ sharing() ? 'Wird geteilt …' : 'In der Community teilen' }}
      </button>
      <button
        mat-flat-button
        type="button"
        class="action-btn ghost"
        [disabled]="sharing()"
        (click)="skip.emit()"
      >
        Überspringen
      </button>
    </div>
  `,
})
export class GymSessionShareSheetComponent {
  readonly suggestion = input.required<string>();
  readonly note = input.required<string>();
  readonly photoName = input<string | null>(null);
  readonly sharing = input.required<boolean>();

  readonly noteChange = output<string>();
  readonly photoChange = output<File | null>();
  readonly submit = output<void>();
  readonly skip = output<void>();

  readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photoInput');

  pickPhoto(): void {
    this.photoInput()?.nativeElement.click();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.photoChange.emit(input.files?.[0] || null);
  }
}
