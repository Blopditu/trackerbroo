import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../core/supabase.service';
import { AuthService } from '../core/auth.service';
import { Group } from '../core/types';

@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <header class="top-bar">
      <button type="button" class="brand" (click)="goToday()" aria-label="Go to today">
        <span class="brand-mark" aria-hidden="true">▦</span>
        <span>Tracker Broo</span>
      </button>

      <div class="group-picker">
        <label for="group-select" class="sr-only">Active group</label>
        <select id="group-select" [value]="activeGroupId()" (change)="onGroupChange($event)">
          <option value="">No group</option>
          @for (group of groups(); track group.id) {
            <option [value]="group.id">{{ group.name }}</option>
          }
        </select>
      </div>

      <button type="button" class="manage" (click)="openGroupPage()">Manage</button>
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
      background: linear-gradient(180deg, #ffffff 0%, #f0f6ff 100%);
      border-bottom: 2px solid #1f2937;
      z-index: 28;
    }

    .brand {
      border: 2px solid #1f2937;
      border-radius: 999px;
      background: #e0f2fe;
      color: #0c4a6e;
      min-height: 40px;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0 0.6rem;
      font-weight: 800;
      font-size: 0.78rem;
      box-shadow: 0 2px 0 #1f2937;
    }

    .brand-mark {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      font-size: 0.85rem;
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
      border: 2px solid #1f2937;
      border-radius: 999px;
      min-height: 40px;
      padding: 0 0.7rem;
      background: #f5f7ff;
      color: #334155;
      font-size: 0.78rem;
      font-weight: 800;
      box-shadow: 0 2px 0 #1f2937;
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
      localStorage.removeItem('activeGroup');
      this.activeGroupId.set('');
      return;
    }

    const group = this.groups().find(entry => entry.id === id);
    if (!group) {
      return;
    }

    localStorage.setItem('activeGroup', JSON.stringify(group));
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
    if (!this.hasBrowserStorage()) {
      this.activeGroupId.set('');
      return;
    }

    const groupRaw = localStorage.getItem('activeGroup');
    if (!groupRaw) {
      this.activeGroupId.set('');
      return;
    }

    try {
      const group = JSON.parse(groupRaw) as Group;
      this.activeGroupId.set(group.id);
    } catch {
      this.activeGroupId.set('');
    }
  }

  private hasBrowserStorage(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }
}
