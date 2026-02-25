import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../core/supabase.service';
import { DailySummary } from '../../core/types';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <main class="page dashboard-page">
      @if (errorMessage()) {
        <p class="toast error" aria-live="polite">{{ errorMessage() }}</p>
      }

      <header class="panel halftone">
        <p class="title-font">Stats</p>
        <h1>Squad Snapshot</h1>
        <p class="lead">Daily summary cards and 7-day calories trend.</p>
      </header>

      <section class="panel">
        <div class="section-head">
          <div class="scroll-header">Today</div>
          <span class="mono-badge">Protein-hit days: {{ proteinHitDays() }}</span>
        </div>

        @if (loading()) {
          <div class="skeleton card"></div>
          <div class="skeleton card"></div>
        } @else {
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
              <p class="empty-state">No summaries for today yet.</p>
            }
          </div>
        }
      </section>

      <section class="panel">
        <div class="section-head">
          <div class="scroll-header">Weekly Calories</div>
          <span class="manga-badge">STREAK</span>
        </div>

        @if (loading()) {
          <div class="skeleton card"></div>
        } @else {
          <div class="week-chart" role="list" aria-label="Weekly calories">
            @for (day of weekDays; track day.date) {
              <div class="bar-col" role="listitem">
                <div class="bar-wrap">
                  <div class="bar" [style.height.%]="barHeight(day.date)"></div>
                </div>
                <span class="day">{{ day.label }}</span>
                <span class="val">{{ dayTotal(day.date) }}</span>
              </div>
            }
          </div>
        }
      </section>
    </main>
  `,
  styles: [`
    .dashboard-page {
      display: grid;
      gap: 0.75rem;
    }

    h1 {
      margin-top: 0.2rem;
      font-size: 1.7rem;
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
      gap: 0.45rem;
      margin-bottom: 0.65rem;
    }

    .manga-badge {
      border: 2px solid var(--border-strong);
      border-radius: 999px;
      background: #f0f9ff;
      color: #0369a1;
      padding: 0.2rem 0.55rem;
      font-size: var(--text-xs);
      font-weight: 800;
      letter-spacing: 0.05em;
      box-shadow: 0 2px 0 var(--border-strong);
    }

    .today-cards {
      display: grid;
      gap: 0.5rem;
    }

    .summary-card {
      align-items: flex-start;
      flex-direction: column;
    }

    .sub {
      margin-top: 0.2rem;
      color: var(--ink-500);
      font-weight: 700;
      font-size: var(--text-sm);
    }

    .macro-line {
      margin-top: 0.45rem;
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .week-chart {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 0.4rem;
      min-height: 196px;
      align-items: end;
    }

    .bar-col {
      display: grid;
      gap: 0.22rem;
      justify-items: center;
    }

    .bar-wrap {
      width: 100%;
      height: 132px;
      border: 2px solid var(--border-strong);
      border-radius: 10px;
      background: #eef5ff;
      display: flex;
      align-items: end;
      padding: 0.18rem;
    }

    .bar {
      width: 100%;
      border-radius: 7px;
      min-height: 10px;
      background: linear-gradient(180deg, #22d3ee, #0284c7);
      border: 2px solid #075985;
    }

    .day,
    .val {
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--ink-500);
    }
  `]
})
export class DashboardComponent implements OnInit {
  todaySummaries = signal<DailySummary[]>([]);
  weekSummaries = signal<DailySummary[]>([]);
  weekDays: { date: string; label: string }[] = [];
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  proteinHitDays = computed(() => {
    const uniqueDays = new Set(
      this.weekSummaries()
        .filter(item => Number(item.protein) >= 100)
        .map(item => item.day)
    );
    return uniqueDays.size;
  });

  private supabaseService = inject(SupabaseService);

  ngOnInit() {
    this.generateWeekDays();
    void this.loadData();
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

    this.loading.set(true);
    this.errorMessage.set(null);

    const today = new Date().toISOString().split('T')[0];

    const { data: todayData, error: todayError } = await this.supabaseService.client
      .from('daily_summaries')
      .select('*')
      .eq('group_id', group.id)
      .eq('day', today);

    if (todayError) {
      this.errorMessage.set(todayError.message);
      this.loading.set(false);
      return;
    }

    this.todaySummaries.set((todayData || []) as DailySummary[]);

    const weekStart = this.weekDays[0].date;
    const { data: weekData, error: weekError } = await this.supabaseService.client
      .from('daily_summaries')
      .select('*')
      .eq('group_id', group.id)
      .gte('day', weekStart);

    if (weekError) {
      this.errorMessage.set(weekError.message);
      this.loading.set(false);
      return;
    }

    this.weekSummaries.set((weekData || []) as DailySummary[]);
    this.loading.set(false);
  }

  getActiveGroup() {
    const groupStr = localStorage.getItem('activeGroup');
    return groupStr ? JSON.parse(groupStr) : null;
  }

  dayTotal(date: string) {
    return Math.round(
      this.weekSummaries()
        .filter(item => item.day === date)
        .reduce((sum, item) => sum + Number(item.kcal), 0)
    );
  }

  barHeight(date: string) {
    const maxKcal = Math.max(...this.weekDays.map(day => this.dayTotal(day.date)), 1);
    return Math.min((this.dayTotal(date) / maxKcal) * 100, 100);
  }

  getUserName(userId: string) {
    return userId.slice(0, 8);
  }
}
