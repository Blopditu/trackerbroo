import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../core/supabase.service';
import { DailySummary } from '../../core/types';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  template: `
    <main class="page dashboard-page">
      <header class="panel">
        <p class="title-font">Shinobi Board</p>
        <h1>Squad Stats</h1>
      </header>

      <section class="panel">
        <div class="scroll-header title-font">Today</div>
        <div class="today-cards">
          @for (summary of todaySummaries(); track summary.owner_id) {
            <article class="list-card summary-card">
              <div>
                <strong>{{ getUserName(summary.owner_id) }}</strong>
                <div class="sub">{{ summary.kcal }} kcal</div>
              </div>
              <div class="macro-line" aria-label="Macros">
                <span class="mono-badge">P {{ summary.protein }}g</span>
                <span class="mono-badge">C {{ summary.carbs }}g</span>
                <span class="mono-badge">F {{ summary.fat }}g</span>
              </div>
            </article>
          }
          @if (todaySummaries().length === 0) {
            <p class="empty">No summaries for today yet.</p>
          }
        </div>
      </section>

      <section class="panel">
        <div class="scroll-header title-font">This Week</div>
        <div class="week-view" role="list" aria-label="Weekly calories">
          @for (day of weekDays; track day.date) {
            <div class="day-column" role="listitem">
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
      </section>
    </main>
  `,
  styles: [`
    .dashboard-page {
      display: grid;
      gap: 0.75rem;
    }

    h1 {
      font-size: 2rem;
      margin-top: 0.2rem;
    }

    .today-cards {
      margin-top: 0.75rem;
      display: grid;
      gap: 0.5rem;
    }

    .summary-card {
      align-items: flex-start;
      flex-direction: column;
    }

    .sub {
      margin-top: 0.2rem;
      color: #5d4734;
      font-weight: 700;
    }

    .macro-line {
      margin-top: 0.45rem;
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .week-view {
      margin-top: 0.75rem;
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.35rem;
      min-height: 190px;
    }

    .day-column {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      border: 2px solid #2f1f15;
      border-radius: 10px;
      background: linear-gradient(180deg, #fff9eb 0%, #f7e2b8 100%);
      padding: 0.3rem;
      gap: 0.25rem;
    }

    .day-label {
      font-weight: 800;
      color: #4f3724;
      font-size: 0.78rem;
      margin-bottom: auto;
    }

    .day-bar {
      width: 100%;
      display: grid;
      justify-items: center;
      gap: 0.2rem;
    }

    .bar {
      width: 70%;
      min-height: 14px;
      border: 2px solid #2f1f15;
      border-radius: 999px;
      background: linear-gradient(180deg, #f78a1d, #e1680e);
    }

    .user-label {
      font-size: 0.68rem;
      font-weight: 800;
      color: #4f3724;
      text-align: center;
    }

    .empty {
      margin: 0;
      text-align: center;
      color: #5c4433;
      font-weight: 700;
    }
  `]
})
export class DashboardComponent implements OnInit {
  todaySummaries = signal<DailySummary[]>([]);
  weekSummaries = signal<DailySummary[]>([]);
  weekDays: { date: string; label: string }[] = [];

  private supabaseService = inject(SupabaseService);

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

    const { data: todayData } = await this.supabaseService.client
      .from('daily_summaries')
      .select('*')
      .eq('group_id', group.id)
      .eq('day', today);

    this.todaySummaries.set(todayData || []);

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
    return Math.min((kcal / 3000) * 100, 100);
  }

  getUserName(userId: string) {
    return userId.slice(0, 8);
  }
}
