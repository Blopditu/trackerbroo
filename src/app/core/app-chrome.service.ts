import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AppChromeService {
  readonly suppressAppChrome = signal(false);

  setSuppressed(value: boolean): void {
    this.suppressAppChrome.set(value);
  }
}
