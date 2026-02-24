import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { Group } from '../../core/types';

@Component({
  selector: 'app-group',
  imports: [CommonModule, FormsModule],
  template: `
    <main class="page group-page">
      <header class="panel">
        <p class="title-font">Village Selection</p>
        <h1 class="group-title">Choose Your Squad</h1>
      </header>

      @if (groups().length > 0) {
        <section class="panel" aria-label="Your groups">
          <div class="scroll-header title-font">Your Groups</div>
          <div class="group-list">
            @for (group of groups(); track group.id) {
              <button type="button" class="list-card group-card" (click)="selectGroup(group)">
                <span>{{ group.name }}</span>
                <span class="mono-badge">Enter</span>
              </button>
            }
          </div>
        </section>
      }

      <section class="panel" aria-label="Create group">
        <div class="scroll-header title-font">Create Group</div>
        <form (ngSubmit)="createGroup()" #groupForm="ngForm" class="stack-form">
          <label for="group-name" class="sr-only">Group name</label>
          <input
            id="group-name"
            type="text"
            [(ngModel)]="groupName"
            name="groupName"
            placeholder="Leaf Village"
            required
          >
          <button type="submit" class="action-btn" [disabled]="!groupForm.valid || loading">
            {{ loading ? 'Creating...' : 'Create Group' }}
          </button>
        </form>
      </section>

      <section class="panel" aria-label="Join group">
        <div class="scroll-header title-font">Join Group</div>
        <form (ngSubmit)="joinGroup()" #joinForm="ngForm" class="stack-form">
          <label for="invite-code" class="sr-only">Invite code</label>
          <input
            id="invite-code"
            type="text"
            [(ngModel)]="inviteCode"
            name="inviteCode"
            placeholder="Paste invite code"
            required
          >
          <button type="submit" class="action-btn alt" [disabled]="!joinForm.valid || loading">
            {{ loading ? 'Joining...' : 'Join Group' }}
          </button>
        </form>
      </section>
    </main>
  `,
  styles: [`
    .group-page {
      display: grid;
      gap: 0.8rem;
    }

    .group-title {
      margin-top: 0.2rem;
      font-size: 1.8rem;
    }

    .group-list {
      margin-top: 0.75rem;
      display: grid;
      gap: 0.55rem;
    }

    .group-card {
      width: 100%;
      text-align: left;
      background: linear-gradient(180deg, #fff9eb 0%, #f7e0b8 100%);
    }

    .stack-form {
      margin-top: 0.75rem;
      display: grid;
      gap: 0.65rem;
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
export class GroupComponent implements OnInit {
  groups = signal<Group[]>([]);
  groupName = '';
  inviteCode = '';
  loading = false;

  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
    this.loadGroups();
  }

  async loadGroups() {
    const user = this.authService.user();
    if (!user) return;

    const { data, error } = await this.supabaseService.client
      .from('group_members')
      .select('groups(*)')
      .eq('user_id', user.id);

    if (error) {
      console.error(error);
      return;
    }

    const resolvedGroups = (data ?? [])
      .map(item => (Array.isArray(item.groups) ? item.groups[0] : item.groups))
      .filter((group): group is Group => Boolean(group));

    this.groups.set(resolvedGroups);
  }

  async createGroup() {
    const user = this.authService.user();
    if (!user) return;

    this.loading = true;
    try {
      const { data, error } = await this.supabaseService.client
        .from('groups')
        .insert({
          name: this.groupName,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      await this.supabaseService.client
        .from('group_members')
        .insert({
          group_id: data.id,
          user_id: user.id,
          role: 'owner'
        });

      this.selectGroup(data);
    } catch (error) {
      console.error(error);
    } finally {
      this.loading = false;
    }
  }

  async joinGroup() {
    const user = this.authService.user();
    if (!user) return;

    this.loading = true;
    try {
      const { error } = await this.supabaseService.client
        .from('group_members')
        .insert({
          group_id: this.inviteCode,
          user_id: user.id,
          role: 'member'
        });

      if (error) throw error;

      this.router.navigate(['/today']);
    } catch (error) {
      console.error(error);
    } finally {
      this.loading = false;
    }
  }

  selectGroup(group: Group) {
    localStorage.setItem('activeGroup', JSON.stringify(group));
    this.router.navigate(['/today']);
  }
}
