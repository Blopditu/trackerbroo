import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { ActiveGroupService } from '../../core/active-group.service';
import { Group } from '../../core/types';
import { formatAppError } from '../../core/error-format';

@Component({
  selector: 'app-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <main class="page group-page">
      @if (errorMessage()) {
        <p class="toast error" role="status" aria-live="polite" aria-atomic="true">{{ errorMessage() }}</p>
      }

      <header class="panel halftone">
        <p class="title-font">Gruppen-Setup</p>
        <h1>Aktive Gruppe wählen</h1>
        <p class="lead">Erstelle oder tritt einer Gruppe bei und setze sie als aktiv.</p>
      </header>

      <section class="panel" aria-label="Deine Gruppen">
        <div class="section-head">
          <div class="scroll-header">Deine Gruppen</div>
          <span class="mono-badge">{{ groups().length }}</span>
        </div>

        @if (loadingGroups()) {
          <div class="skeleton card"></div>
          <div class="skeleton card"></div>
        } @else if (groups().length === 0) {
          <p class="empty-state">Noch keine Gruppen. Erstelle unten eine.</p>
        } @else {
          <div class="group-list">
            @for (group of groups(); track group.id) {
              <button type="button" class="list-card group-card" (click)="selectGroup(group)">
                <span>{{ group.name }}</span>
                <span class="mono-badge">Aktiv setzen</span>
              </button>
            }
          </div>
        }
      </section>

      <section class="panel" aria-label="Gruppe erstellen">
        <div class="scroll-header">Gruppe erstellen</div>
        <form (ngSubmit)="createGroup()" #groupForm="ngForm" class="stack-form">
          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Gruppenname</mat-label>
            <input
              matInput
              id="group-name"
              type="text"
              [(ngModel)]="groupName"
              name="groupName"
              placeholder="z. B. Team Alpen"
              required
            >
          </mat-form-field>
          <button mat-flat-button type="submit" class="action-btn" [disabled]="!groupForm.valid || loading">
            {{ loading ? 'Wird erstellt...' : 'Gruppe erstellen' }}
          </button>
        </form>
      </section>

      <section class="panel" aria-label="Gruppe beitreten">
        <div class="scroll-header">Gruppe beitreten</div>
        <form (ngSubmit)="joinGroup()" #joinForm="ngForm" class="stack-form">
          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Einladungscode (Gruppen-ID)</mat-label>
            <input
              matInput
              id="invite-code"
              type="text"
              [(ngModel)]="inviteCode"
              name="inviteCode"
              placeholder="Einladungscode einfügen"
              required
            >
          </mat-form-field>
          <button mat-flat-button type="submit" class="action-btn alt" [disabled]="!joinForm.valid || loading">
            {{ loading ? 'Wird beigetreten...' : 'Gruppe beitreten' }}
          </button>
        </form>
      </section>
    </main>
  `,
  styles: [`
    .group-page {
      display: grid;
      gap: 0.75rem;
    }

    h1 {
      font-size: 1.7rem;
      margin-top: 0.2rem;
    }

    .lead {
      margin: 0.35rem 0 0;
      color: var(--ink-500);
      font-size: var(--text-sm);
      font-weight: 600;
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.65rem;
    }

    .group-list,
    .stack-form {
      display: grid;
      gap: 0.55rem;
    }

    .group-card {
      width: 100%;
      text-align: left;
      min-height: 56px;
    }

  `]
})
export class GroupComponent implements OnInit {
  groups = signal<Group[]>([]);
  groupName = '';
  inviteCode = '';
  loading = false;
  loadingGroups = signal(false);
  errorMessage = signal<string | null>(null);

  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  private activeGroupService = inject(ActiveGroupService);
  private router = inject(Router);

  ngOnInit() {
    void this.loadGroups();
  }

  async loadGroups() {
    const user = this.authService.user();
    if (!user) return;

    this.loadingGroups.set(true);
    this.errorMessage.set(null);

    const { data, error } = await this.supabaseService.client
      .from('group_members')
      .select('groups(*)')
      .eq('user_id', user.id);

    if (error) {
      this.errorMessage.set(formatAppError(error, 'Gruppen konnten nicht geladen werden'));
      this.loadingGroups.set(false);
      return;
    }

    const resolvedGroups = (data ?? [])
      .map(item => (Array.isArray(item.groups) ? item.groups[0] : item.groups))
      .filter((group): group is Group => Boolean(group));

    this.groups.set(resolvedGroups);
    this.loadingGroups.set(false);
  }

  async createGroup() {
    const user = this.authService.user();
    if (!user) return;

    this.loading = true;
    this.errorMessage.set(null);
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
      this.errorMessage.set(formatAppError(error, 'Gruppe konnte nicht erstellt werden'));
    } finally {
      this.loading = false;
    }
  }

  async joinGroup() {
    const user = this.authService.user();
    if (!user) return;

    this.loading = true;
    this.errorMessage.set(null);

    try {
      const { error } = await this.supabaseService.client
        .from('group_members')
        .insert({
          group_id: this.inviteCode,
          user_id: user.id,
          role: 'member'
        });

      if (error) throw error;

      const { data: joinedGroupData } = await this.supabaseService.client
        .from('groups')
        .select('*')
        .eq('id', this.inviteCode)
        .maybeSingle();

      if (joinedGroupData) {
        this.activeGroupService.setActiveGroup(joinedGroupData as Group);
      }

      await this.router.navigate(['/today']);
    } catch (error) {
      this.errorMessage.set(formatAppError(error, 'Gruppe konnte nicht beigetreten werden'));
    } finally {
      this.loading = false;
    }
  }

  selectGroup(group: Group) {
    this.activeGroupService.setActiveGroup(group);
    void this.router.navigate(['/today']);
  }
}
