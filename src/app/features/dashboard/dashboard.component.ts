import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { DailySummary } from '../../core/types';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <h1>Dashboard</h1>
      <div class="today-cards">
        @for (summary of todaySummaries(); track summary.owner_id) {
          <div class="summary-card">
            <h3>{{ getUserName(summary.owner_id) }}</h3>
            <div class="macros">
              <div>{{ summary.kcal }} kcal</div>
              <div>P: {{ summary.protein }}g</div>
              <div>C: {{ summary.carbs }}g</div>
              <div>F: {{ summary.fat }}g</div>
            </div>
          </div>
        }
      </div>

      <h2>This Week</h2>
      <div class="week-view">
        @for (day of weekDays; track day.date) {
          <div class="day-column">
            <div class="day-label">{{ day.label }}</div>
            @for (summary of getSummariesForDay(day.date); track summary.owner_id + summary.day) {
              <div class="day-bar">
                <div class="bar" [style.height.%]="getBarHeight(summary.kcal)"></div>
                <div class="user-label">{{ getUserName(summary.owner_id) }}</div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 1rem;
      max-width: 480px;
      margin: 0 auto;
    }
    .today-cards {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .summary-card {
      background: #fff;
      padding: 1rem;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .macros {
      display: flex;
      justify-content: space-around;
      margin-top: 0.5rem;
    }
    .week-view {
      display: flex;
      gap: 0.5rem;
    }
    .day-column {
      flex: 1;
      text-align: center;
    }
    .day-label {
      font-weight: bold;
      margin-bottom: 0.5rem;
    }
    .day-bar {
      margin-bottom: 0.5rem;
    }
    .bar {
      background: #667eea;
      border-radius: 5px;
      min-height: 20px;
    }
    .user-label {
      font-size: 0.8rem;
      margin-top: 0.25rem;
    }
  `]
})
export class DashboardComponent implements OnInit {
  todaySummaries = signal<DailySummary[]>([]);
  weekSummaries = signal<DailySummary[]>([]);
  weekDays: { date: string; label: string }[] = [];

  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);

  ngOnInit() {
    this.generateWeekDays();
    this.loadData();
  }

  generateWeekDays() {
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      this.weekDays.push({
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('en', { weekday: 'short' })
      });
    }
  }

  async loadData() {
    const group = this.getActiveGroup();
    if (!group) return;

    const today = new Date().toISOString().split('T')[0];

    // Load today's summaries
    const { data: todayData } = await this.supabaseService.client
      .from('daily_summaries')
      .select('*')
      .eq('group_id', group.id)
      .eq('day', today);

    this.todaySummaries.set(todayData || []);

    // Load week summaries
    const weekStart = this.weekDays[0].date;
    const { data: weekData } = await this.supabaseService.client
      .from('daily_summaries')
      .select('*')
      .eq('group_id', group.id)
      .gte('day', weekStart);

    this.weekSummaries.set(weekData || []);
  }

  getActiveGroup() {
    const groupStr = localStorage.getItem('activeGroup');
    return groupStr ? JSON.parse(groupStr) : null;
  }

  getSummariesForDay(date: string) {
    return this.weekSummaries().filter(s => s.day === date);
  }

  getBarHeight(kcal: number) {
    // Max kcal for scaling, say 3000
    return Math.min((kcal / 3000) * 100, 100);
  }

  getUserName(userId: string) {
    // For MVP, just show user ID or email
    // In real app, you'd have a users table or cache
    return userId.slice(0, 8);
  }
}