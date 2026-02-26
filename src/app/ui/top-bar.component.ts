import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { AuthService } from '../core/auth.service';
import { ActiveGroupService } from '../core/active-group.service';
import { Group } from '../core/types';

@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <header class="top-bar">
      <button type="button" class="brand" (click)="goToday()" aria-label="Zu Heute wechseln">
        <span>Tracker Broo</span>
      </button>

      <div class="group-picker">
        <label for="group-select" class="sr-only">Aktive Gruppe</label>
        <select id="group-select" [value]="activeGroupId()" (change)="onGroupChange($event)">
          <option value="">Keine Gruppe</option>
          @for (group of groups(); track group.id) {
            <option [value]="group.id">{{ group.name }}</option>
          }
        </select>
      </div>

      <button type="button" class="manage" (click)="openGroupPage()">Verwalten</button>
    </header>
  `,
  styles: [`
    .top-bar {
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: min(100%, 480px);
      height: 66px;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.45rem;
      padding: 0.6rem 0.75rem;
      background: var(--bg-shell);
      border-bottom: 1px solid var(--border-strong);
      z-index: 28;
    }

    .brand {
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      background: var(--bg-surface-2);
      color: var(--ink-700);
      min-height: 40px;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0 0.6rem;
      font-weight: 800;
      font-size: 0.78rem;
    }

    .group-picker select {
      min-height: 40px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 700;
      border-width: 2px;
      padding-right: 2rem;
    }

    .manage {
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      min-height: 40px;
      padding: 0 0.7rem;
      background: var(--bg-surface-2);
      color: var(--ink-700);
      font-size: 0.78rem;
      font-weight: 800;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `]
})
export class TopBarComponent implements OnInit {
  readonly groups = signal<Group[]>([]);
  readonly activeGroupId = signal('');

  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly activeGroupService = inject(ActiveGroupService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.loadGroups();
    this.syncActiveGroup();
  }

  async loadGroups(): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const { data } = await this.supabaseService.client
      .from('group_members')
      .select('groups(*)')
      .eq('user_id', user.id);

    const resolvedGroups = (data ?? [])
      .map(item => (Array.isArray(item.groups) ? item.groups[0] : item.groups))
      .filter((group): group is Group => Boolean(group));

    this.groups.set(resolvedGroups);
  }

  onGroupChange(event: Event): void {
    if (!this.hasBrowserStorage()) {
      return;
    }

    const id = (event.target as HTMLSelectElement).value;
    if (!id) {
      this.activeGroupService.clearActiveGroup();
      this.activeGroupId.set('');
      return;
    }

    const group = this.groups().find(entry => entry.id === id);
    if (!group) {
      return;
    }

    this.activeGroupService.setActiveGroup(group);
    this.activeGroupId.set(group.id);
    void this.router.navigate(['/today']);
  }

  openGroupPage(): void {
    void this.router.navigate(['/group']);
  }

  goToday(): void {
    void this.router.navigate(['/today']);
  }

  private syncActiveGroup(): void {
    this.activeGroupService.syncFromStorage();
    this.activeGroupId.set(this.activeGroupService.activeGroupId() ?? '');
  }

  private hasBrowserStorage(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }
}
