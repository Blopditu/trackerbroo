import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, input, output, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X } from 'lucide-angular';
import { MatButtonModule } from '@angular/material/button';

let sheetTitleIdCounter = 0;

@Component({
  selector: 'app-bottom-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)'
  },
  imports: [CommonModule, LucideAngularModule, MatButtonModule],
  template: `
    @if (rendered()) {
      <div class="overlay" [class.active]="isActive()" (click)="onBackdropClick()">
        <section
          #sheet
          class="sheet"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <div class="drag-handle" aria-hidden="true"></div>
          <div class="head">
            <h2 [id]="titleId">{{ title() }}</h2>
            <button mat-icon-button type="button" class="close" (click)="closed.emit()" aria-label="Schließen">
              <lucide-icon [img]="icons.x" aria-hidden="true"></lucide-icon>
            </button>
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
      background: rgba(4, 8, 12, 0.58);
      touch-action: pan-y;
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--motion-duration-medium) var(--motion-easing-standard);
    }

    .sheet {
      background: var(--m3-sys-color-surface-container);
      border-top: 1px solid var(--m3-sys-color-outline-variant);
      border-left: 1px solid var(--m3-sys-color-outline-variant);
      border-right: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 28px 28px 0 0;
      padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
      max-height: 86vh;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      box-shadow: 0 -12px 28px rgba(0, 0, 0, 0.35);
      transform: translateY(28px) scale(0.985);
      opacity: 0;
      transition:
        transform var(--motion-duration-long) var(--motion-easing-decelerate),
        opacity var(--motion-duration-medium) var(--motion-easing-standard);
    }

    .overlay.active {
      opacity: 1;
      pointer-events: auto;
    }

    .overlay.active .sheet {
      transform: translateY(0) scale(1);
      opacity: 1;
    }

    .drag-handle {
      width: 52px;
      height: 5px;
      border-radius: 99px;
      background: var(--m3-sys-color-outline-variant);
      margin: 0 auto 10px;
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
      color: var(--m3-sys-color-on-surface);
      font-weight: 600;
    }

    .close {
      width: 48px;
      height: 48px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 13px;
      line-height: 1;
      border-radius: 10px;
      display: grid;
      place-items: center;
    }

    @media (prefers-reduced-motion: reduce) {
      .overlay,
      .sheet {
        transition: none;
      }
    }
  `]
})
export class BottomSheetComponent implements OnDestroy {
  readonly icons = {
    x: X
  };

  readonly titleId = `app-bottom-sheet-title-${sheetTitleIdCounter += 1}`;
  readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly closeOnBackdrop = input(true);
  readonly closed = output<void>();
  readonly rendered = signal(false);
  readonly isActive = signal(false);

  private previousFocusedElement: HTMLElement | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.openSheet();
        return;
      }

      this.closeSheet();
    });
  }

  ngOnDestroy(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    this.restorePreviousFocus();
  }

  onBackdropClick(): void {
    if (this.closeOnBackdrop() && this.isActive()) {
      this.closed.emit();
    }
  }

  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open()) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closed.emit();
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  private focusFirstElement(): void {
    const host = this.sheet()?.nativeElement;
    if (!host) {
      return;
    }

    const focusables = this.getFocusableElements(host);
    const target = focusables[0] || host;
    target.focus({ preventScroll: true });
  }

  private trapFocus(event: KeyboardEvent): void {
    const host = this.sheet()?.nativeElement;
    if (!host || typeof document === 'undefined') {
      return;
    }

    const focusables = this.getFocusableElements(host);
    if (focusables.length === 0) {
      event.preventDefault();
      host.focus({ preventScroll: true });
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (!active || !host.contains(active)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  private getFocusableElements(root: HTMLElement): HTMLElement[] {
    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ];

    return Array.from(root.querySelectorAll<HTMLElement>(selectors.join(',')))
      .filter(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
  }

  private restorePreviousFocus(): void {
    if (!this.previousFocusedElement) {
      return;
    }

    queueMicrotask(() => {
      this.previousFocusedElement?.focus({ preventScroll: true });
    });
    this.previousFocusedElement = null;
  }

  private openSheet(): void {
    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      this.previousFocusedElement = active instanceof HTMLElement ? active : null;
    }

    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    this.rendered.set(true);

    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        this.isActive.set(true);
        queueMicrotask(() => this.focusFirstElement());
      });
      return;
    }

    this.isActive.set(true);
    queueMicrotask(() => this.focusFirstElement());
  }

  private closeSheet(): void {
    if (!this.rendered()) {
      return;
    }

    this.isActive.set(false);
    this.restorePreviousFocus();

    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }

    this.closeTimer = setTimeout(() => {
      this.rendered.set(false);
      this.closeTimer = null;
    }, 280);
  }
}
