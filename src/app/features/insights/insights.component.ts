import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { LucideAngularModule, Activity, ChartLine, Dumbbell, Flame } from 'lucide-angular';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';
import { formatAppError } from '../../core/error-format';
import { TrainingDataService, TrainingGraphDataPoint } from '../../core/training/training-data.service';
import { InteractionTelemetryService, JourneyKey } from '../../core/interaction-telemetry.service';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';

interface TrendPoint {
  date: string;
  value: number;
}

type DetailKind = 'nutrition' | 'weight' | 'workouts' | 'volume';

@Component({
  selector: 'app-insights',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, LucideAngularModule, BottomSheetComponent],
  template: `
    <main class="page insights-page">
      @if (errorMessage()) {
        <p class="toast error" role="status" aria-live="polite" aria-atomic="true">{{ errorMessage() }}</p>
      }

      <section class="panel hero">
        <p class="title-font">Insights</p>
        <h1>Trends auf einen Blick</h1>
        <p class="subtle">Ernaehrung, Gewicht und Training in einem Screen.</p>

        <div class="range-toggle" role="group" aria-label="Zeitraum fuer Insights">
          <button mat-flat-button type="button" class="range-btn" [class.active]="rangeDays() === 7" (click)="setRangeDays(7)">
            7 Tage
          </button>
          <button mat-flat-button type="button" class="range-btn" [class.active]="rangeDays() === 30" (click)="setRangeDays(30)">
            30 Tage
          </button>
        </div>
      </section>

      <section class="insights-grid" aria-label="Trendkarten">
        <button type="button" class="panel trend-card" (click)="openDetail('nutrition')" aria-label="Ernaehrungstrend ansehen">
          <div class="card-head">
            <h2><lucide-icon [img]="icons.flame" class="icon" aria-hidden="true"></lucide-icon> Ernaehrung</h2>
            <span class="badge">{{ rangeDays() }}d</span>
          </div>
          <p class="headline">{{ latestLabel(nutritionSeries(), 'kcal', 0) }}</p>
          <p class="meta">Delta {{ deltaLabel(nutritionSeries(), 'kcal', 0) }}</p>
          @if (nutritionSeries().length > 0) {
            <svg class="mini-graph" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
              <polyline [attr.points]="toLinePoints(nutritionSeries())"></polyline>
            </svg>
          } @else {
            <p class="empty-note">Keine Daten.</p>
          }
        </button>

        <button type="button" class="panel trend-card" (click)="openDetail('weight')" aria-label="Gewichtstrend ansehen">
          <div class="card-head">
            <h2><lucide-icon [img]="icons.chartLine" class="icon" aria-hidden="true"></lucide-icon> Gewicht</h2>
            <span class="badge">{{ rangeDays() }}d</span>
          </div>
          <p class="headline">{{ latestLabel(weightSeries(), 'kg', 1) }}</p>
          <p class="meta">Delta {{ deltaLabel(weightSeries(), 'kg', 1) }}</p>
          @if (weightSeries().length > 0) {
            <svg class="mini-graph" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
              <polyline [attr.points]="toLinePoints(weightSeries())"></polyline>
            </svg>
          } @else {
            <p class="empty-note">Keine Daten.</p>
          }
        </button>

        <button type="button" class="panel trend-card" (click)="openDetail('workouts')" aria-label="Workouttrend ansehen">
          <div class="card-head">
            <h2><lucide-icon [img]="icons.dumbbell" class="icon" aria-hidden="true"></lucide-icon> Workouts</h2>
            <span class="badge">{{ rangeDays() }}d</span>
          </div>
          <p class="headline">{{ sumLabel(workoutSeries(), 'Sessions') }}</p>
          <p class="meta">Aktuell {{ latestLabel(workoutSeries(), '', 0) }}</p>
          <svg class="mini-graph" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
            <polyline [attr.points]="toLinePoints(workoutSeries())"></polyline>
          </svg>
        </button>

        <button type="button" class="panel trend-card" (click)="openDetail('volume')" aria-label="Volumentrend ansehen">
          <div class="card-head">
            <h2><lucide-icon [img]="icons.activity" class="icon" aria-hidden="true"></lucide-icon> Volumen</h2>
            <span class="badge">{{ rangeDays() }}d</span>
          </div>
          <p class="headline">{{ sumLabel(volumeSeries(), 'kg') }}</p>
          <p class="meta">Delta {{ deltaLabel(volumeSeries(), 'kg', 0) }}</p>
          <svg class="mini-graph" viewBox="0 0 100 26" preserveAspectRatio="none" aria-hidden="true">
            <polyline [attr.points]="toLinePoints(volumeSeries())"></polyline>
          </svg>
        </button>
      </section>

      <section class="panel telemetry-panel" aria-label="Journey-Metriken">
        <div class="card-head">
          <h2>Journey Timing</h2>
          <span class="badge">30d</span>
        </div>
        <div class="telemetry-grid">
          <article class="stat-box">
            <p class="label">Food Log</p>
            <strong>{{ metricMedianLabel('food_log') }}</strong>
            <span class="small">P75 {{ metricP75Label('food_log') }}</span>
          </article>
          <article class="stat-box">
            <p class="label">Weight Log</p>
            <strong>{{ metricMedianLabel('weight_log') }}</strong>
            <span class="small">P75 {{ metricP75Label('weight_log') }}</span>
          </article>
          <article class="stat-box">
            <p class="label">Graph Check</p>
            <strong>{{ metricMedianLabel('graph_check') }}</strong>
            <span class="small">P75 {{ metricP75Label('graph_check') }}</span>
          </article>
        </div>
      </section>
    </main>

    <app-bottom-sheet [open]="activeDetail() !== null" [title]="detailTitle()" (closed)="closeDetail()">
      <div class="sheet-stack">
        <div class="detail-head">
          <strong>{{ detailPrimaryValue() }}</strong>
          <span class="muted">{{ detailDeltaLabel() }}</span>
        </div>

        <div class="range-toggle" role="group" aria-label="Zeitraum fuer Detailansicht">
          <button mat-flat-button type="button" class="range-btn" [class.active]="rangeDays() === 7" (click)="setRangeDays(7)">7 Tage</button>
          <button mat-flat-button type="button" class="range-btn" [class.active]="rangeDays() === 30" (click)="setRangeDays(30)">30 Tage</button>
        </div>

        @if (detailSeries().length > 0) {
          <svg class="detail-graph" viewBox="0 0 100 40" preserveAspectRatio="none" aria-label="Detailgraph">
            <polyline [attr.points]="toDetailLinePoints()"></polyline>
            @for (point of detailChartPoints(); track point.date) {
              <circle
                class="detail-dot"
                [class.active]="selectedDetailDate() === point.date"
                [attr.cx]="point.x"
                [attr.cy]="point.y"
                r="2"
                tabindex="0"
                role="button"
                [attr.aria-label]="detailPointAriaLabel(point.date, point.value)"
                (click)="selectDetailDate(point.date)"
                (keydown)="onDetailDotKeydown($event, point.date)"
              ></circle>
            }
          </svg>

          <p class="detail-note">{{ selectedDetailPointLabel() }}</p>
        } @else {
          <p class="empty-note">Keine Daten fuer diesen Zeitraum.</p>
        }
      </div>
    </app-bottom-sheet>
  `,
  styles: [`
    .insights-page {
      display: grid;
      gap: var(--layout-gap);
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(1.95rem, 4vw, 2.35rem);
      line-height: 1.04;
    }

    .range-toggle {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .range-btn {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 700;
      justify-content: center;
      width: 100%;
    }

    .range-btn.active {
      border-color: transparent;
      background: var(--m3-sys-color-secondary-container);
      color: var(--m3-sys-color-on-secondary-container);
    }

    .insights-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--layout-gap);
    }

    .trend-card {
      display: grid;
      gap: 8px;
      text-align: left;
      width: 100%;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 22px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface);
      padding: var(--panel-padding);
    }

    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .card-head h2 {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 16px;
    }

    .badge {
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 700;
      color: var(--m3-sys-color-on-secondary-container);
      background: var(--m3-sys-color-secondary-container);
    }

    .headline {
      margin: 0;
      font-size: clamp(1.2rem, 3.4vw, 1.5rem);
      font-weight: 700;
      color: var(--m3-sys-color-on-surface);
    }

    .meta {
      margin: 0;
      font-size: 12px;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 600;
    }

    .mini-graph,
    .detail-graph {
      width: 100%;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 14px;
      background: var(--m3-sys-color-surface-container);
    }

    .mini-graph {
      height: 56px;
    }

    .detail-graph {
      height: 164px;
    }

    .mini-graph polyline,
    .detail-graph polyline {
      fill: none;
      stroke: var(--m3-sys-color-primary);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .detail-dot {
      fill: var(--m3-sys-color-surface-container-highest);
      stroke: var(--m3-sys-color-primary);
      stroke-width: 0.8;
      cursor: pointer;
      transition: transform var(--motion-duration-short) var(--motion-easing-standard);
      transform-origin: center;
    }

    .detail-dot.active {
      fill: var(--m3-sys-color-primary);
      transform: scale(1.2);
    }

    .detail-dot:focus-visible {
      outline: 2px solid var(--m3-sys-color-primary);
      outline-offset: 2px;
    }

    .detail-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }

    .detail-head strong {
      font-size: 22px;
      color: var(--m3-sys-color-on-surface);
    }

    .detail-note,
    .empty-note {
      margin: 0;
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 600;
    }

    .telemetry-panel {
      display: grid;
      gap: 12px;
    }

    .telemetry-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .stat-box {
      display: grid;
      gap: 4px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 10px;
    }

    .label {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      color: var(--m3-sys-color-on-surface-variant);
    }

    .stat-box strong {
      font-size: 16px;
      color: var(--m3-sys-color-on-surface);
    }

    .small {
      font-size: 11px;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 600;
    }

    @media (max-width: 700px) {
      .insights-grid {
        grid-template-columns: 1fr;
      }

      .telemetry-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class InsightsComponent implements OnInit {
  readonly icons = {
    flame: Flame,
    chartLine: ChartLine,
    dumbbell: Dumbbell,
    activity: Activity
  };

  readonly rangeDays = signal<7 | 30>(30);
  readonly nutritionSeries = signal<TrendPoint[]>([]);
  readonly weightSeries = signal<TrendPoint[]>([]);
  readonly workoutSeries = signal<TrendPoint[]>([]);
  readonly volumeSeries = signal<TrendPoint[]>([]);
  readonly activeDetail = signal<DetailKind | null>(null);
  readonly selectedDetailDate = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly trainingData = inject(TrainingDataService);
  private readonly telemetry = inject(InteractionTelemetryService);

  private graphJourneyId: string | null = null;

  readonly telemetryRevision = computed(() => this.telemetry.updatedAt());
  readonly metrics = computed(() => {
    this.telemetryRevision();
    return this.telemetry.getJourneyMetrics(30);
  });

  readonly detailSeries = computed<TrendPoint[]>(() => {
    const detail = this.activeDetail();
    if (!detail) {
      return [];
    }

    if (detail === 'nutrition') {
      return this.nutritionSeries();
    }
    if (detail === 'weight') {
      return this.weightSeries();
    }
    if (detail === 'workouts') {
      return this.workoutSeries();
    }
    return this.volumeSeries();
  });

  ngOnInit(): void {
    void this.loadData();
  }

  async setRangeDays(days: 7 | 30): Promise<void> {
    if (days === this.rangeDays()) {
      return;
    }

    this.rangeDays.set(days);
    await this.loadData(true);
  }

  openDetail(kind: DetailKind): void {
    this.activeDetail.set(kind);
    const series = this.detailSeries();
    this.selectedDetailDate.set(series[series.length - 1]?.date || null);

    if (this.graphJourneyId) {
      this.telemetry.completeJourney(this.graphJourneyId, 'success', {
        surface: 'insights',
        detail_kind: kind,
        range_days: this.rangeDays()
      });
      this.graphJourneyId = null;
    }
  }

  closeDetail(): void {
    this.activeDetail.set(null);
    this.selectedDetailDate.set(null);
  }

  detailTitle(): string {
    const detail = this.activeDetail();
    if (detail === 'nutrition') return 'Detail: Ernaehrung';
    if (detail === 'weight') return 'Detail: Gewicht';
    if (detail === 'workouts') return 'Detail: Workouts';
    if (detail === 'volume') return 'Detail: Trainingsvolumen';
    return 'Detail';
  }

  detailPrimaryValue(): string {
    const series = this.detailSeries();
    const detail = this.activeDetail();
    if (detail === 'nutrition') {
      return this.latestLabel(series, 'kcal', 0);
    }
    if (detail === 'weight') {
      return this.latestLabel(series, 'kg', 1);
    }
    if (detail === 'workouts') {
      return this.sumLabel(series, 'Sessions');
    }
    if (detail === 'volume') {
      return this.sumLabel(series, 'kg');
    }
    return '--';
  }

  detailDeltaLabel(): string {
    const detail = this.activeDetail();
    const series = this.detailSeries();
    if (detail === 'weight') {
      return `Delta ${this.deltaLabel(series, 'kg', 1)}`;
    }
    if (detail === 'nutrition') {
      return `Delta ${this.deltaLabel(series, 'kcal', 0)}`;
    }
    if (detail === 'volume') {
      return `Delta ${this.deltaLabel(series, 'kg', 0)}`;
    }
    return `Aktuell ${this.latestLabel(series, '', 0)}`;
  }

  selectDetailDate(date: string): void {
    this.selectedDetailDate.set(date);
  }

  onDetailDotKeydown(event: KeyboardEvent, date: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectDetailDate(date);
    }
  }

  selectedDetailPointLabel(): string {
    const selectedDate = this.selectedDetailDate();
    const series = this.detailSeries();
    if (!selectedDate || series.length === 0) {
      return 'Tippe auf einen Punkt fuer Details.';
    }

    const point = series.find(item => item.date === selectedDate);
    if (!point) {
      return 'Tippe auf einen Punkt fuer Details.';
    }

    const detail = this.activeDetail();
    const unit = detail === 'weight' ? 'kg' : detail === 'nutrition' ? 'kcal' : detail === 'workouts' ? 'Sessions' : 'kg';
    const precision = detail === 'weight' ? 1 : 0;
    return `${point.date}: ${this.formatNumber(point.value, precision)} ${unit}`.trim();
  }

  detailPointAriaLabel(date: string, value: number): string {
    const detail = this.activeDetail();
    const unit = detail === 'weight' ? 'Kilogramm' : detail === 'nutrition' ? 'Kilokalorien' : detail === 'workouts' ? 'Workouts' : 'Kilogramm Volumen';
    const precision = detail === 'weight' ? 1 : 0;
    return `${date}, ${this.formatNumber(value, precision)} ${unit}`;
  }

  detailChartPoints(): Array<{ date: string; value: number; x: number; y: number }> {
    const series = this.detailSeries();
    if (series.length === 0) {
      return [];
    }

    const values = series.map(item => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);

    return series.map((point, index) => {
      const x = (index / Math.max(series.length - 1, 1)) * 100;
      const y = 36 - ((point.value - min) / range) * 32;
      return {
        ...point,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2))
      };
    });
  }

  toDetailLinePoints(): string {
    const points = this.detailChartPoints();
    if (points.length === 0) {
      return '0,36 100,36';
    }
    return points.map(point => `${point.x},${point.y}`).join(' ');
  }

  toLinePoints(series: TrendPoint[]): string {
    if (series.length === 0) {
      return '0,22 100,22';
    }

    const values = series.map(point => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);

    return series
      .map((point, index) => {
        const x = (index / Math.max(series.length - 1, 1)) * 100;
        const y = 24 - ((point.value - min) / range) * 20;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }

  latestLabel(series: TrendPoint[], unit: string, precision: number): string {
    const last = series[series.length - 1];
    if (!last) {
      return '--';
    }
    const suffix = unit ? ` ${unit}` : '';
    return `${this.formatNumber(last.value, precision)}${suffix}`;
  }

  deltaLabel(series: TrendPoint[], unit: string, precision: number): string {
    if (series.length < 2) {
      return '--';
    }

    const first = series[0];
    const last = series[series.length - 1];
    const delta = Number((last.value - first.value).toFixed(precision));
    const prefix = delta > 0 ? '+' : '';
    const suffix = unit ? ` ${unit}` : '';
    return `${prefix}${this.formatNumber(delta, precision)}${suffix}`;
  }

  sumLabel(series: TrendPoint[], unit: string): string {
    if (series.length === 0) {
      return '--';
    }
    const total = series.reduce((sum, point) => sum + point.value, 0);
    const suffix = unit ? ` ${unit}` : '';
    return `${this.formatNumber(total, 0)}${suffix}`;
  }

  metricMedianLabel(key: JourneyKey): string {
    const metric = this.metrics().find(item => item.key === key);
    if (!metric || !metric.medianMs) {
      return '--';
    }
    return `${Math.round(metric.medianMs / 100) / 10}s`;
  }

  metricP75Label(key: JourneyKey): string {
    const metric = this.metrics().find(item => item.key === key);
    if (!metric || !metric.p75Ms) {
      return '--';
    }
    return `${Math.round(metric.p75Ms / 100) / 10}s`;
  }

  private async loadData(forceRefresh = false): Promise<void> {
    this.errorMessage.set(null);
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const to = this.toIsoDate(new Date());
    const from = this.toIsoDate(this.shiftDays(new Date(), -(this.rangeDays() - 1)));

    this.graphJourneyId = this.telemetry.startJourneyIfMissing('graph_check', {
      surface: 'insights',
      range_days: this.rangeDays()
    });

    try {
      const [nutritionRows, bodyweightSeries, workoutSeries, volumeSeries] = await Promise.all([
        this.fetchNutritionSeries(user.id, from, to),
        this.trainingData.getProgressSeries({ graphType: 'bodyweight', from, to }),
        this.trainingData.getProgressSeries({ graphType: 'workout_count', from, to }),
        this.trainingData.getProgressSeries({ graphType: 'total_volume', from, to })
      ]);

      this.nutritionSeries.set(nutritionRows);
      this.weightSeries.set(this.normalizeSeries(bodyweightSeries));
      this.workoutSeries.set(this.normalizeSeries(workoutSeries, true));
      this.volumeSeries.set(this.normalizeSeries(volumeSeries, true));

      if (forceRefresh) {
        this.selectedDetailDate.set(null);
      }
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Insights konnten nicht geladen werden'));
      if (this.graphJourneyId) {
        this.telemetry.failJourney(this.graphJourneyId, { surface: 'insights', reason: 'load_failed' });
        this.graphJourneyId = null;
      }
    }
  }

  private normalizeSeries(series: TrainingGraphDataPoint[], clampToZero = false): TrendPoint[] {
    const byDay = new Map<string, number>();
    for (const point of series) {
      const date = String(point.point_date);
      const value = Number(point.point_value);
      if (!Number.isFinite(value)) {
        continue;
      }
      byDay.set(date, value);
    }

    const ordered = [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, value]) => ({
        date,
        value: clampToZero ? Math.max(0, value) : value
      }));

    return ordered;
  }

  private async fetchNutritionSeries(userId: string, from: string, to: string): Promise<TrendPoint[]> {
    const { data, error } = await this.supabaseService.client
      .from('daily_summaries')
      .select('day,kcal')
      .eq('owner_id', userId)
      .is('group_id', null)
      .gte('day', from)
      .lte('day', to)
      .order('day', { ascending: true });

    if (error) {
      throw error;
    }

    const kcalByDay = new Map<string, number>();
    for (const row of (data || []) as Array<{ day: string; kcal: number }>) {
      const existing = kcalByDay.get(row.day) || 0;
      kcalByDay.set(row.day, existing + Number(row.kcal || 0));
    }

    const days = this.isoRange(from, to);
    return days.map(day => ({
      date: day,
      value: Number((kcalByDay.get(day) || 0).toFixed(0))
    }));
  }

  private isoRange(from: string, to: string): string[] {
    const list: string[] = [];
    const cursor = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);

    while (cursor <= end) {
      list.push(this.toIsoDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return list;
  }

  private shiftDays(date: Date, delta: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    return next;
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatNumber(value: number, precision: number): string {
    return Number(value).toFixed(precision);
  }
}
