import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { Group } from '../../core/types';

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="group-container">
      <h1>Select or Create Group</h1>
      @if (groups().length > 0) {
        <div class="groups-list">
          <h2>Your Groups</h2>
          @for (group of groups(); track group.id) {
            <div class="group-card" (click)="selectGroup(group)">
              {{ group.name }}
            </div>
          }
        </div>
      }
      <div class="create-group">
        <h2>Create New Group</h2>
        <form (ngSubmit)="createGroup()" #groupForm="ngForm">
          <input
            type="text"
            [(ngModel)]="groupName"
            name="groupName"
            placeholder="Group name"
            required
          >
          <button type="submit" [disabled]="!groupForm.valid || loading">
            {{ loading ? 'Creating...' : 'Create Group' }}
          </button>
        </form>
      </div>
      <div class="join-group">
        <h2>Join Group</h2>
        <form (ngSubmit)="joinGroup()" #joinForm="ngForm">
          <input
            type="text"
            [(ngModel)]="inviteCode"
            name="inviteCode"
            placeholder="Invite code"
            required
          >
          <button type="submit" [disabled]="!joinForm.valid || loading">
            {{ loading ? 'Joining...' : 'Join Group' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .group-container {
      padding: 1rem;
      max-width: 480px;
      margin: 0 auto;
    }
    .groups-list {
      margin-bottom: 2rem;
    }
    .group-card {
      background: #f0f0f0;
      padding: 1rem;
      border-radius: 10px;
      margin-bottom: 0.5rem;
      cursor: pointer;
    }
    form {
      display: flex;
      flex-direction: column;
    }
    input {
      padding: 1rem;
      border: 2px solid #eee;
      border-radius: 10px;
      margin-bottom: 1rem;
    }
    button {
      padding: 1rem;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 10px;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
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

    this.groups.set(data?.map((item: any) => item.groups) || []);
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

      // Add creator as owner
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
    // For MVP, assume inviteCode is group_id
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