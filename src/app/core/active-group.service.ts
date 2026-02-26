import { Injectable, computed, signal } from '@angular/core';
import { Group } from './types';

@Injectable({
  providedIn: 'root'
})
export class ActiveGroupService {
  readonly activeGroup = signal<Group | null>(null);
  readonly activeGroupId = computed(() => this.activeGroup()?.id ?? null);

  constructor() {
    this.syncFromStorage();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange);
    }
  }

  setActiveGroup(group: Group): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('activeGroup', JSON.stringify(group));
    }
    this.activeGroup.set(group);
  }

  clearActiveGroup(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('activeGroup');
    }
    this.activeGroup.set(null);
  }

  syncFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      this.activeGroup.set(null);
      return;
    }

    const groupRaw = localStorage.getItem('activeGroup');
    if (!groupRaw) {
      this.activeGroup.set(null);
      return;
    }

    try {
      this.activeGroup.set(JSON.parse(groupRaw) as Group);
    } catch {
      this.activeGroup.set(null);
    }
  }

  private readonly handleStorageChange = (event: StorageEvent): void => {
    if (event.key === 'activeGroup') {
      this.syncFromStorage();
    }
  };
}
