import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, effect, input, output, signal, viewChild } from '@angular/core';
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
      <div
        class="overlay"
        [class.active]="isActive()"
        [class.dragging]="isDragging()"
        [style.--sheet-keyboard-inset.px]="keyboardInset()"
        [style.--sheet-drag-y.px]="dragOffsetY()"
        [style.--sheet-drag-progress]="dragProgress()"
        (click)="onBackdropClick()"
      >
        <section
          #sheet
          class="sheet"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <div
            class="drag-handle"
            aria-hidden="true"
            (pointerdown)="onHandlePointerDown($event)"
            (pointermove)="onHandlePointerMove($event)"
            (pointerup)="onHandlePointerUp($event)"
            (pointercancel)="onHandlePointerCancel($event)"
          ></div>
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
      padding-bottom: var(--sheet-keyboard-inset, 0px);
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
      max-height: min(86vh, calc(100vh - 12px - var(--sheet-keyboard-inset, 0px)));
      overflow: auto;
      scroll-padding-bottom: calc(var(--sheet-keyboard-inset, 0px) + 96px);
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      box-shadow: 0 -12px 28px rgba(0, 0, 0, 0.35);
      transform: translateY(calc(28px + var(--sheet-drag-y, 0px))) scale(0.985);
      opacity: 0;
      transition:
        transform var(--motion-duration-long) var(--motion-easing-decelerate),
        opacity var(--motion-duration-medium) var(--motion-easing-standard);
    }

    .overlay.active {
      opacity: calc(1 - (var(--sheet-drag-progress, 0) * 0.35));
      pointer-events: auto;
    }

    .overlay.active .sheet {
      transform: translateY(var(--sheet-drag-y, 0px)) scale(1);
      opacity: 1;
    }

    .overlay.dragging .sheet {
      transition: none;
    }

    .drag-handle {
      width: 52px;
      height: 5px;
      border-radius: 99px;
      background: var(--m3-sys-color-outline-variant);
      margin: 0 auto 10px;
      touch-action: none;
      cursor: grab;
      position: relative;
    }

    .overlay.dragging .drag-handle {
      cursor: grabbing;
    }

    .head {
      display: flex;
      justify-content: space-between;
      align-items: start;
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
      flex: 0 0 auto;
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
      margin-top: -2px;
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
  readonly keyboardInset = signal(0);
  readonly dragOffsetY = signal(0);
  readonly isDragging = signal(false);
  readonly dragProgress = computed(() => Math.min(this.dragOffsetY() / 220, 1));

  private previousFocusedElement: HTMLElement | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private dragPointerId: number | null = null;
  private dragStartY = 0;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.openSheet();
        return;
      }

      this.closeSheet();
    });

    if (typeof window !== 'undefined') {
      window.visualViewport?.addEventListener('resize', this.handleViewportChange);
      window.visualViewport?.addEventListener('scroll', this.handleViewportChange);
      window.addEventListener('focusin', this.handleViewportChange);
      window.addEventListener('focusout', this.handleViewportChange);
    }
  }

  ngOnDestroy(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    if (typeof window !== 'undefined') {
      window.visualViewport?.removeEventListener('resize', this.handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', this.handleViewportChange);
      window.removeEventListener('focusin', this.handleViewportChange);
      window.removeEventListener('focusout', this.handleViewportChange);
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

  onHandlePointerDown(event: PointerEvent): void {
    if (!this.open()) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    this.dragPointerId = event.pointerId;
    this.dragStartY = event.clientY;
    this.isDragging.set(true);
    this.dragOffsetY.set(0);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  onHandlePointerMove(event: PointerEvent): void {
    if (!this.isDragging() || this.dragPointerId !== event.pointerId) {
      return;
    }

    const offset = Math.max(0, event.clientY - this.dragStartY);
    this.dragOffsetY.set(offset);
    if (offset > 0) {
      event.preventDefault();
    }
  }

  onHandlePointerUp(event: PointerEvent): void {
    if (!this.isDragging() || this.dragPointerId !== event.pointerId) {
      return;
    }

    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }

    const shouldClose = this.dragOffsetY() > 110;
    this.resetDragState();
    if (shouldClose) {
      this.closed.emit();
    }
  }

  onHandlePointerCancel(event: PointerEvent): void {
    if (!this.isDragging() || this.dragPointerId !== event.pointerId) {
      return;
    }

    const target = event.currentTarget as HTMLElement;
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }

    this.resetDragState();
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
    this.updateKeyboardInset();
    this.resetDragState();

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
    this.keyboardInset.set(0);
    this.resetDragState();
    this.restorePreviousFocus();

    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }

    this.closeTimer = setTimeout(() => {
      this.rendered.set(false);
      this.closeTimer = null;
    }, 280);
  }

  private readonly handleViewportChange = (): void => {
    if (!this.open()) {
      this.keyboardInset.set(0);
      return;
    }
    this.updateKeyboardInset();
  };

  private updateKeyboardInset(): void {
    if (typeof window === 'undefined') {
      this.keyboardInset.set(0);
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      this.keyboardInset.set(0);
      return;
    }

    const activeElement = document.activeElement;
    const activeIsInput = activeElement instanceof HTMLInputElement
      || activeElement instanceof HTMLTextAreaElement
      || activeElement instanceof HTMLSelectElement
      || (activeElement instanceof HTMLElement && activeElement.isContentEditable);

    const rawInset = Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop));
    const resolvedInset = activeIsInput && rawInset > 80 ? Math.round(rawInset) : 0;
    this.keyboardInset.set(resolvedInset);

    if (activeIsInput && resolvedInset > 0 && activeElement instanceof HTMLElement) {
      requestAnimationFrame(() => {
        activeElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    }
  }

  private resetDragState(): void {
    this.dragPointerId = null;
    this.dragStartY = 0;
    this.isDragging.set(false);
    this.dragOffsetY.set(0);
  }
}
