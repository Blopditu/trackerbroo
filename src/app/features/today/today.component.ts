import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { DailySummary, Ingredient, LogEntry, Meal, WeightLog } from '../../core/types';
import { AmountPickerSheetComponent, AmountPickResult, MacroTotals } from '../../ui/amount-picker-sheet.component';
import { HeroRingComponent } from '../../ui/minimal/hero-ring.component';
import { MacroBarComponent } from '../../ui/minimal/macro-bar.component';
import { HabitGridComponent, HabitState } from '../../ui/minimal/habit-grid.component';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';
import { formatAppError } from '../../core/error-format';

type QuickItem = Ingredient | Meal;

interface MealMacroMap {
  [mealId: string]: MacroTotals;
}

@Component({
  selector: 'app-today',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    AmountPickerSheetComponent,
    HeroRingComponent,
    MacroBarComponent,
    HabitGridComponent,
    BottomSheetComponent
  ],
  template: `
    <main class="page today-page">
      @if (errorMessage()) {
        <p class="toast error" aria-live="polite">{{ errorMessage() }}</p>
      }

      @if (successMessage()) {
        <p class="toast success" aria-live="polite">{{ successMessage() }}</p>
      }

      <section class="hero">
        <p class="date-label"><i class="fa-regular fa-calendar icon" aria-hidden="true"></i> {{ todayLabel() }}</p>

        <div class="day-nav">
          <button type="button" class="nav-btn" (click)="goPreviousDay()" aria-label="Vorheriger Tag">←</button>
          <input type="date" class="day-input" [ngModel]="today()" (ngModelChange)="onDayPicked($event)">
          <button type="button" class="nav-btn" (click)="goNextDay()" [disabled]="today() >= realToday" aria-label="Nächster Tag">→</button>
        </div>

        <app-hero-ring [value]="proteinToday()" [target]="proteinGoal" accentColor="#5B8CFF" />

        <div class="bars">
          <app-macro-bar label="Protein" [value]="proteinToday()" [target]="proteinGoal" color="#5B8CFF" />
          <app-macro-bar label="Fett" [value]="fatToday()" [target]="fatGoal" color="#F4B740" />
          <app-macro-bar label="Kohlenhydrate" [value]="carbsToday()" [target]="carbGoal" color="#3DBB78" />
        </div>

        <div class="weight-row">
          <span><i class="fa-solid fa-weight-scale icon" aria-hidden="true"></i> Gewicht</span>
          <strong>{{ weightValueLabel() }}</strong>
          <span class="delta">{{ weightDeltaLabel() }}</span>
        </div>
      </section>

      <section class="section">
        <h2><i class="fa-solid fa-chart-line icon" aria-hidden="true"></i> Gewichtstrend</h2>
        <div class="sparkline-wrap" aria-label="Gewichtstrend">
          <svg viewBox="0 0 100 28" preserveAspectRatio="none" class="sparkline">
            <polyline [attr.points]="weightSparklinePoints()" />
          </svg>
          <div class="trend-note">7-Tage-Veränderung: {{ weeklyTrendLabel() }}</div>
        </div>

        <div class="weight-list">
          @for (entry of recentWeightEntries(); track entry.id) {
            <article class="weight-entry">
              <div>
                <strong>{{ entry.weight_kg }} kg</strong>
                <p class="entry-meta">{{ entry.logged_on }}</p>
              </div>
              <button type="button" class="entry-btn" (click)="editWeight(entry)">Bearbeiten</button>
            </article>
          }
        </div>
      </section>

      <section class="section">
        <h2><i class="fa-solid fa-list-check icon" aria-hidden="true"></i> Gewohnheiten</h2>
        <app-habit-grid label="Gym" [states]="gymHabitStates()" [targetPerWeek]="3" />
        <app-habit-grid label="Protein" [states]="proteinHabitStates()" [targetPerWeek]="7" />
      </section>

      <section class="section">
        <h2><i class="fa-regular fa-clock icon" aria-hidden="true"></i> Geloggt am {{ today() }}</h2>
        @for (entry of todayEntries(); track entry.id) {
          <article class="entry-card">
            <div class="entry-main">
              <strong class="entry-title">{{ entry.entry_type === 'ingredient' ? getIngredientName(entry.ref_id) : getMealName(entry.ref_id) }}</strong>
              <p class="entry-sub">
                {{
                  entry.quantity + (entry.entry_type === 'ingredient' ? 'g' : ' Portionen')
                  + ' · P ' + entry.protein.toFixed(1) + 'g'
                  + ' · KH ' + entry.carbs.toFixed(1) + 'g'
                  + ' · F ' + entry.fat.toFixed(1) + 'g'
                  + ' · ' + entry.kcal.toFixed(0) + ' kcal'
                }}
              </p>
              <p class="entry-meta">{{ entry.created_at.slice(11,16) }}</p>
            </div>
            <div class="entry-actions">
              <button type="button" class="entry-btn" (click)="editEntry(entry)">Bearbeiten</button>
              <button type="button" class="entry-btn danger" (click)="deleteEntry(entry.id)">Löschen</button>
            </div>
          </article>
        }
        @if (todayEntries().length === 0) {
          <p class="muted">Für {{ today() }} noch keine Einträge.</p>
        }
      </section>

      <button class="today-fab" type="button" (click)="openActions()" aria-label="Schnellaktionen"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
    </main>

    <app-bottom-sheet [open]="showActionSheet()" [title]="sheetTitle()" (closed)="closeActions()">
      @if (sheetMode() === 'menu') {
        <div class="action-list">
          <button type="button" class="menu-btn" (click)="setSheetMode('food')"><i class="fa-solid fa-utensils icon" aria-hidden="true"></i> 🍗 Essen hinzufügen</button>
          <button type="button" class="menu-btn" (click)="setSheetMode('weight')"><i class="fa-solid fa-weight-scale icon" aria-hidden="true"></i> ⚖️ Gewicht eintragen</button>
          <button type="button" class="menu-btn" (click)="setSheetMode('gym')"><i class="fa-solid fa-dumbbell icon" aria-hidden="true"></i> 🏋️ Gym erledigt</button>
        </div>
      }

      @if (sheetMode() === 'food') {
        <input
          type="search"
          [ngModel]="foodSearch()"
          (ngModelChange)="foodSearch.set($event)"
          placeholder="Lebensmittel suchen"
          aria-label="Lebensmittel suchen"
        >
        <div class="food-list">
          @for (item of quickFoodItems(); track item.id) {
            <button type="button" class="menu-btn" (click)="openAmountPicker(item)">
              <span class="food-name">{{ item.name }}</span>
              <small class="food-macros">{{ quickItemMacroLine(item) }}</small>
            </button>
          }
        </div>
      }

      @if (sheetMode() === 'weight') {
        <label for="weight-day-input">Datum</label>
        <input id="weight-day-input" type="date" [(ngModel)]="weightDateInput">

        <label for="weight-input">Gewicht (kg)</label>
        <input id="weight-input" type="number" min="20" step="0.1" [(ngModel)]="weightInput">

        <button type="button" class="menu-btn" (click)="saveWeight()">Gewicht speichern</button>
      }

      @if (sheetMode() === 'gym') {
        <label for="gym-note-input">Notiz (optional)</label>
        <textarea id="gym-note-input" rows="3" [(ngModel)]="gymNote" placeholder="Was lief heute gut?"></textarea>

        <label for="gym-photo-input">Foto (optional)</label>
        <input id="gym-photo-input" type="file" accept="image/*" (change)="onGymPhotoSelected($event)">

        <button type="button" class="menu-btn" [disabled]="savingGymPost()" (click)="submitGymPost()">
          {{ savingGymPost() ? 'Wird gepostet...' : 'Gym-Check-in posten' }}
        </button>
      }
    </app-bottom-sheet>

    @if (selectedItem()) {
      <app-amount-picker-sheet
        [itemName]="selectedItem()!.name"
        [unitLabel]="isIngredient(selectedItem()!) ? 'g' : 'x'"
        [presets]="isIngredient(selectedItem()!) ? [100, 150, 200, 250] : [1, 1.5, 2, 3]"
        [baseAmount]="isIngredient(selectedItem()!) ? 100 : 1"
        [baseMacros]="selectedItemMacros()"
        [initialAmount]="selectedItemInitialAmount()"
        (confirmed)="confirmQuickAdd($event)"
        (closed)="closeAmountPicker()"
      />
    }
  `,
  styles: [`
    .today-page {
      background: #0F1115;
      color: #E6E8EC;
      gap: 16px;
      padding: 16px;
    }

    .hero,
    .section {
      display: grid;
      gap: 12px;
      background: #151922;
      border: 1px solid #1B202B;
      padding: 16px;
    }

    .date-label {
      margin: 0;
      color: #A4A9B6;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
    }

    .day-nav {
      display: grid;
      grid-template-columns: 44px 1fr 44px;
      gap: 8px;
      align-items: center;
    }

    .nav-btn {
      min-height: 44px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #E6E8EC;
      font-size: 18px;
      font-weight: 700;
    }

    .day-input {
      min-height: 44px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #E6E8EC;
      padding: 0 12px;
      font-size: 16px;
    }

    .icon {
      margin-right: 8px;
    }

    .bars {
      display: grid;
      gap: 8px;
    }

    .weight-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid #1B202B;
      font-size: 16px;
    }

    .weight-row span {
      color: #A4A9B6;
    }

    .weight-row strong {
      color: #E6E8EC;
      font-weight: 600;
    }

    .delta {
      color: #6E7483;
      font-size: 13px;
    }

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #E6E8EC;
    }

    .muted {
      margin: 0;
      color: #6E7483;
      font-size: 13px;
    }

    .sparkline-wrap {
      border: 1px solid #1B202B;
      background: #0F1115;
      padding: 10px;
      display: grid;
      gap: 8px;
    }

    .sparkline {
      width: 100%;
      height: 48px;
    }

    .sparkline polyline {
      fill: none;
      stroke: #5B8CFF;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .trend-note {
      margin: 0;
      color: #A4A9B6;
      font-size: 13px;
    }

    .weight-list {
      display: grid;
      gap: 8px;
    }

    .weight-entry {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      border: 1px solid #1B202B;
      background: #0F1115;
      padding: 10px;
    }

    .entry-card {
      display: grid;
      gap: 10px;
      border: 1px solid #1B202B;
      background: #0F1115;
      padding: 12px;
    }

    .entry-main {
      display: grid;
      gap: 2px;
    }

    .entry-title {
      color: #E6E8EC;
      font-size: 16px;
      font-weight: 600;
    }

    .entry-sub,
    .entry-meta {
      margin: 0;
      color: #A4A9B6;
      font-size: 13px;
    }

    .entry-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .entry-btn {
      min-height: 40px;
      border: 1px solid #1B202B;
      background: #151922;
      color: #E6E8EC;
      font-size: 14px;
      font-weight: 600;
    }

    .entry-btn.danger {
      border-color: #7f2a37;
      color: #f3bdc7;
      background: #2a151c;
    }

    .today-fab {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: calc(96px + env(safe-area-inset-bottom));
      width: 56px;
      height: 56px;
      border: 1px solid #1B202B;
      background: #5B8CFF;
      color: #0F1115;
      font-size: 24px;
      font-weight: 700;
      z-index: 30;
    }

    .action-list,
    .food-list {
      display: grid;
      gap: 8px;
    }

    .menu-btn {
      min-height: 64px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #E6E8EC;
      font-size: 16px;
      font-weight: 600;
      text-align: left;
      padding: 8px 12px;
      display: grid;
      gap: 2px;
      align-content: center;
    }

    .food-name {
      display: block;
      font-size: 16px;
      color: #E6E8EC;
      font-weight: 600;
      line-height: 1.25;
    }

    .food-macros {
      display: block;
      font-size: 12px;
      color: #A4A9B6;
      font-weight: 600;
      line-height: 1.25;
      white-space: normal;
      opacity: 1;
    }

    label {
      font-size: 13px;
      color: #A4A9B6;
      font-weight: 600;
    }

    input {
      width: 100%;
      min-height: 44px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #E6E8EC;
      padding: 0 12px;
      margin-bottom: 8px;
    }

    textarea {
      width: 100%;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #E6E8EC;
      padding: 12px;
      font-size: 16px;
      margin-bottom: 8px;
      min-height: 96px;
      resize: vertical;
    }
  `]
})
export class TodayComponent implements OnInit {
  readonly proteinGoal = 100;
  readonly fatGoal = 70;
  readonly carbGoal = 250;

  readonly entries = signal<LogEntry[]>([]);
  readonly summary = signal<DailySummary | null>(null);
  readonly ingredients = signal<Ingredient[]>([]);
  readonly meals = signal<Meal[]>([]);
  readonly selectedItem = signal<QuickItem | null>(null);
  readonly selectedItemInitialAmount = signal(100);
  readonly editingEntryId = signal<string | null>(null);
  readonly gymDaysThisWeek = signal<Set<string>>(new Set<string>());
  readonly proteinDaysThisWeek = signal<Set<string>>(new Set<string>());
  readonly weightLogs = signal<WeightLog[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly showActionSheet = signal(false);
  readonly sheetMode = signal<'menu' | 'food' | 'weight' | 'gym'>('menu');
  readonly foodSearch = signal('');
  readonly savingGymPost = signal(false);

  readonly realToday = this.formatDate(new Date());
  readonly today = signal(this.realToday);
  weightDateInput = this.realToday;
  weightInput = 70;
  gymNote = '';
  private gymPhoto: File | null = null;

  private mealMacros: MealMacroMap = {};

  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  readonly todayLabel = computed(() =>
    new Date(`${this.today()}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })
  );
  readonly proteinToday = computed(() => Math.round(Number(this.summary()?.protein || 0)));
  readonly fatToday = computed(() => Math.round(Number(this.summary()?.fat || 0)));
  readonly carbsToday = computed(() => Math.round(Number(this.summary()?.carbs || 0)));

  readonly todayEntries = computed(() => this.entries());
  readonly recentWeightEntries = computed(() => this.weightLogs().slice(0, 7));

  readonly selectedDayWeight = computed(() =>
    this.weightLogs().find(entry => entry.logged_on === this.today()) || null
  );

  readonly previousWeightForDay = computed(() => {
    const day = this.today();
    return this.weightLogs().find(entry => entry.logged_on < day) || null;
  });

  readonly weightSparklinePoints = computed(() => {
    const points = [...this.recentWeightEntries()].reverse();
    if (points.length === 0) {
      return '0,24 100,24';
    }

    const values = points.map(entry => Number(entry.weight_kg));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);

    return values
      .map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * 100;
        const y = 24 - ((value - min) / range) * 20;
        return `${x},${y}`;
      })
      .join(' ');
  });

  readonly quickFoodItems = computed(() => {
    const query = this.foodSearch().trim().toLowerCase();
    const recentIds = this.entries().map(entry => entry.ref_id);
    const recentIngredients = this.ingredients().filter(item => recentIds.includes(item.id));
    const recentMeals = this.meals().filter(item => recentIds.includes(item.id));
    const base = [...recentIngredients, ...recentMeals, ...this.ingredients(), ...this.meals()];
    const deduped = Array.from(new Map(base.map(item => [item.id, item])).values());

    if (!query) {
      return deduped.slice(0, 12);
    }

    return deduped.filter(item => item.name.toLowerCase().includes(query)).slice(0, 12);
  });

  readonly selectedItemMacros = computed<MacroTotals>(() => {
    const item = this.selectedItem();
    if (!item) {
      return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    }
    return this.itemMacros(item);
  });

  readonly gymHabitStates = computed(() => this.toHabitStates('gym'));
  readonly proteinHabitStates = computed(() => {
    const states = this.toHabitStates('protein');
    const dayIndex = this.getCurrentWeekDayIndex();
    if (this.proteinToday() >= this.proteinGoal && dayIndex >= 0 && dayIndex < states.length) {
      states[dayIndex] = 'complete';
    }
    return states;
  });

  ngOnInit(): void {
    void this.loadData();
  }

  async loadData(): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const [{ data: ingredientsData, error: ingredientError }, { data: mealsData, error: mealError }] = await Promise.all([
      this.supabaseService.client.from('ingredients').select('*').eq('owner_id', user.id),
      this.supabaseService.client.from('meals').select('*').eq('owner_id', user.id)
    ]);

    if (ingredientError || mealError) {
      this.errorMessage.set(formatAppError(ingredientError || mealError, 'Lebensmittel-Bibliothek konnte nicht geladen werden'));
      this.loading.set(false);
      return;
    }

    const ingredients = (ingredientsData || []) as Ingredient[];
    const meals = (mealsData || []) as Meal[];
    this.ingredients.set(ingredients);
    this.meals.set(meals);
    await this.loadMealMacros(meals, ingredients);

    const { data: entryData, error: entryError } = await this.supabaseService.client
      .from('log_entries')
      .select('*')
      .eq('owner_id', user.id)
      .is('group_id', null)
      .eq('day', this.today())
      .order('created_at', { ascending: false });

    if (entryError) {
      this.errorMessage.set(formatAppError(entryError, 'Einträge konnten nicht geladen werden'));
      this.loading.set(false);
      return;
    }

    this.entries.set((entryData || []) as LogEntry[]);

    const { data: summaryData } = await this.supabaseService.client
      .from('daily_summaries')
      .select('*')
      .eq('owner_id', user.id)
      .is('group_id', null)
      .eq('day', this.today())
      .maybeSingle();

    this.summary.set(summaryData as DailySummary | null);

    const { data: weightData } = await this.supabaseService.client
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_on', { ascending: false })
      .limit(30);

    this.weightLogs.set((weightData || []) as WeightLog[]);

    const selectedWeight = this.weightLogs().find(entry => entry.logged_on === this.today());
    this.weightInput = Number(selectedWeight?.weight_kg || this.weightInput);
    this.weightDateInput = this.today();

    const weekRange = this.getCurrentWeekRange();

    const { data: gymPostsData } = await this.supabaseService.client
      .from('community_posts')
      .select('day')
      .eq('user_id', user.id)
      .eq('post_type', 'gym_checkin')
      .gte('day', weekRange.start)
      .lte('day', weekRange.end);

    this.gymDaysThisWeek.set(new Set((gymPostsData || []).map(row => String(row.day))));

    const { data: proteinSummaryData } = await this.supabaseService.client
      .from('daily_summaries')
      .select('day,protein')
      .eq('owner_id', user.id)
      .is('group_id', null)
      .gte('day', weekRange.start)
      .lte('day', weekRange.end);

    this.proteinDaysThisWeek.set(
      new Set((proteinSummaryData || []).filter(row => Number(row.protein) >= this.proteinGoal).map(row => String(row.day)))
    );

    if (this.today() === this.realToday && Number(summaryData?.protein || 0) >= this.proteinGoal) {
      await this.ensureProteinMilestonePost(user.id, this.today());
    }

    this.loading.set(false);
  }

  goPreviousDay(): void {
    const date = new Date(`${this.today()}T00:00:00`);
    date.setDate(date.getDate() - 1);
    this.today.set(this.formatDate(date));
    void this.loadData();
  }

  goNextDay(): void {
    const date = new Date(`${this.today()}T00:00:00`);
    date.setDate(date.getDate() + 1);
    const nextDay = this.formatDate(date);
    if (nextDay > this.realToday) {
      return;
    }
    this.today.set(nextDay);
    void this.loadData();
  }

  onDayPicked(value: string): void {
    if (!value) {
      return;
    }
    this.today.set(value > this.realToday ? this.realToday : value);
    void this.loadData();
  }

  weightValueLabel(): string {
    const selected = this.selectedDayWeight();
    return selected ? `${selected.weight_kg} kg` : '--';
  }

  weightDeltaLabel(): string {
    const selected = this.selectedDayWeight();
    const prev = this.previousWeightForDay();
    if (!selected || !prev) return '--';

    const delta = Number((Number(selected.weight_kg) - Number(prev.weight_kg)).toFixed(1));
    return delta > 0 ? `+${delta} kg` : `${delta} kg`;
  }

  weeklyTrendLabel(): string {
    const logs = this.recentWeightEntries();
    if (logs.length < 2) {
      return '--';
    }

    const newest = Number(logs[0].weight_kg);
    const oldest = Number(logs[logs.length - 1].weight_kg);
    const delta = Number((newest - oldest).toFixed(1));

    if (delta > 0) {
      return `+${delta} kg`;
    }

    return `${delta} kg`;
  }

  editWeight(entry: WeightLog): void {
    this.weightDateInput = entry.logged_on;
    this.weightInput = Number(entry.weight_kg);
    this.showActionSheet.set(true);
    this.sheetMode.set('weight');
  }

  openActions(): void {
    this.sheetMode.set('menu');
    this.showActionSheet.set(true);
  }

  closeActions(): void {
    this.showActionSheet.set(false);
    this.sheetMode.set('menu');
    this.foodSearch.set('');
  }

  setSheetMode(mode: 'menu' | 'food' | 'weight' | 'gym'): void {
    this.sheetMode.set(mode);
    if (mode === 'weight') {
      this.weightDateInput = this.today();
      const selected = this.weightLogs().find(entry => entry.logged_on === this.today());
      if (selected) {
        this.weightInput = Number(selected.weight_kg);
      }
    }
  }

  sheetTitle(): string {
    if (this.sheetMode() === 'food') return 'Essen hinzufügen';
    if (this.sheetMode() === 'weight') return 'Gewicht eintragen';
    if (this.sheetMode() === 'gym') return 'Gym posten';
    return 'Schnellaktionen';
  }

  isIngredient(item: QuickItem): item is Ingredient {
    return 'kcal_per_100' in item;
  }

  openAmountPicker(item: QuickItem): void {
    this.editingEntryId.set(null);
    this.selectedItemInitialAmount.set(this.isIngredient(item) ? 100 : 1);
    this.selectedItem.set(item);
    this.showActionSheet.set(false);
  }

  quickItemMacroLine(item: QuickItem): string {
    const macros = this.itemMacros(item);
    const unit = this.isIngredient(item) ? '100g' : 'Portion';
    return `${macros.kcal.toFixed(0)} kcal · P ${macros.protein.toFixed(1)} · KH ${macros.carbs.toFixed(1)} · F ${macros.fat.toFixed(1)} / ${unit}`;
  }

  async confirmQuickAdd(result: AmountPickResult): Promise<void> {
    const item = this.selectedItem();
    const user = this.authService.user();
    if (!item || !user) {
      return;
    }

    const editingId = this.editingEntryId();
    const payload = {
      owner_id: user.id,
      group_id: null,
      day: this.today(),
      entry_type: this.isIngredient(item) ? 'ingredient' : 'meal',
      ref_id: item.id,
      quantity: result.amount,
      kcal: Number(result.totals.kcal.toFixed(2)),
      protein: Number(result.totals.protein.toFixed(2)),
      carbs: Number(result.totals.carbs.toFixed(2)),
      fat: Number(result.totals.fat.toFixed(2))
    };

    const { error } = editingId
      ? await this.supabaseService.client
          .from('log_entries')
          .update(payload)
          .eq('id', editingId)
          .eq('owner_id', user.id)
      : await this.supabaseService.client.from('log_entries').insert(payload);

    if (error) {
      this.errorMessage.set(this.formatWriteError(error));
      return;
    }

    this.successMessage.set(editingId ? 'Eintrag aktualisiert.' : `${item.name} hinzugefügt.`);
    if (!editingId) {
      this.closeActions();
    }
    this.closeAmountPicker();
    await this.loadData();
  }

  editEntry(entry: LogEntry): void {
    const item = entry.entry_type === 'ingredient'
      ? this.ingredients().find(ingredient => ingredient.id === entry.ref_id)
      : this.meals().find(meal => meal.id === entry.ref_id);

    if (!item) {
      this.errorMessage.set('Eintrag kann nicht bearbeitet werden, Basisdaten fehlen.');
      return;
    }

    this.editingEntryId.set(entry.id);
    this.selectedItemInitialAmount.set(Number(entry.quantity));
    this.selectedItem.set(item);
  }

  async deleteEntry(entryId: string): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const user = this.authService.user();
    if (!user) {
      return;
    }

    const { error } = await this.supabaseService.client
      .from('log_entries')
      .delete()
      .eq('id', entryId)
      .eq('owner_id', user.id);

    if (error) {
      this.errorMessage.set(formatAppError(error, 'Eintrag konnte nicht gelöscht werden'));
      return;
    }

    this.successMessage.set('Eintrag gelöscht.');
    await this.loadData();
  }

  async saveWeight(): Promise<void> {
    const user = this.authService.user();
    if (!user || this.weightInput <= 0) {
      this.errorMessage.set('Bitte gib ein gültiges Gewicht ein.');
      return;
    }

    const { error } = await this.supabaseService.client
      .from('weight_logs')
      .upsert(
        {
          user_id: user.id,
          logged_on: this.weightDateInput,
          weight_kg: this.weightInput,
          note: null
        },
        { onConflict: 'user_id,logged_on' }
      );

    if (error) {
      this.errorMessage.set(formatAppError(error, 'Gewicht konnte nicht gespeichert werden'));
      return;
    }

    this.successMessage.set('Gewicht gespeichert.');
    this.closeActions();
    await this.loadData();
  }

  onGymPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.gymPhoto = input.files?.[0] || null;
  }

  async submitGymPost(): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.savingGymPost.set(true);
    try {
      let photoUrl: string | null = null;
      if (this.gymPhoto) {
        photoUrl = await this.uploadImage(this.gymPhoto, 'gym-checkins', user.id);
      }

      const { error } = await this.supabaseService.client
        .from('community_posts')
        .upsert(
          {
            user_id: user.id,
            post_type: 'gym_checkin',
            day: this.today(),
            note: this.gymNote.trim() || null,
            summary: null,
            photo_url: photoUrl
          },
          { onConflict: 'user_id,day,post_type' }
        );

      if (error) {
        throw error;
      }

      this.gymNote = '';
      this.gymPhoto = null;
      this.successMessage.set('Gym-Check-in gepostet.');
      this.closeActions();
      await this.loadData();
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Gym-Check-in konnte nicht gepostet werden'));
    } finally {
      this.savingGymPost.set(false);
    }
  }

  getIngredientName(id: string): string {
    return this.ingredients().find(item => item.id === id)?.name || 'Unbekannt';
  }

  getMealName(id: string): string {
    return this.meals().find(item => item.id === id)?.name || 'Unbekannt';
  }

  private getCurrentWeekRange(): { start: string; end: string } {
    const now = new Date(`${this.today()}T00:00:00`);
    const day = now.getDay();
    const daysSinceMonday = (day + 6) % 7;
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - daysSinceMonday);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return {
      start: this.formatDate(startDate),
      end: this.formatDate(endDate)
    };
  }

  private getCurrentWeekDayIndex(): number {
    const now = new Date(`${this.today()}T00:00:00`);
    return (now.getDay() + 6) % 7;
  }

  private toHabitStates(type: 'gym' | 'protein'): HabitState[] {
    const states: HabitState[] = Array.from({ length: 7 }, () => 'empty');
    const week = this.getCurrentWeekRange();
    const days: string[] = [];
    const start = new Date(`${week.start}T00:00:00`);

    for (let i = 0; i < 7; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(this.formatDate(date));
    }

    for (let i = 0; i < days.length; i += 1) {
      const day = days[i];
      const hit = type === 'gym' ? this.gymDaysThisWeek().has(day) : this.proteinDaysThisWeek().has(day);
      states[i] = hit ? 'complete' : 'missed';
    }

    return states;
  }

  private async loadMealMacros(meals: Meal[], ingredients: Ingredient[]): Promise<void> {
    if (meals.length === 0) {
      this.mealMacros = {};
      return;
    }

    const ingredientMap = new Map(ingredients.map(item => [item.id, item]));
    const mealIds = meals.map(item => item.id);
    const { data } = await this.supabaseService.client.from('meal_items').select('*').in('meal_id', mealIds);

    const macros: MealMacroMap = {};
    for (const meal of meals) {
      macros[meal.id] = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    }

    for (const row of data || []) {
      const ingredient = ingredientMap.get(String(row.ingredient_id));
      const bucket = macros[String(row.meal_id)];
      if (!ingredient || !bucket) continue;
      const factor = Number(row.grams || 0) / 100;
      bucket.kcal += Number(ingredient.kcal_per_100) * factor;
      bucket.protein += Number(ingredient.protein_per_100) * factor;
      bucket.carbs += Number(ingredient.carbs_per_100) * factor;
      bucket.fat += Number(ingredient.fat_per_100) * factor;
    }

    this.mealMacros = macros;
  }

  private itemMacros(item: QuickItem): MacroTotals {
    if (this.isIngredient(item)) {
      return {
        kcal: Number(item.kcal_per_100),
        protein: Number(item.protein_per_100),
        carbs: Number(item.carbs_per_100),
        fat: Number(item.fat_per_100)
      };
    }

    return this.mealMacros[item.id] || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  }

  private async ensureProteinMilestonePost(userId: string, day: string): Promise<void> {
    const { data: summaryData } = await this.supabaseService.client
      .from('daily_summaries')
      .select('protein,kcal,carbs,fat')
      .eq('owner_id', userId)
      .is('group_id', null)
      .eq('day', day)
      .maybeSingle();

    const protein = Number(summaryData?.protein || 0);
    if (protein < this.proteinGoal) {
      return;
    }

    await this.supabaseService.client.from('community_posts').upsert(
      {
        user_id: userId,
        post_type: 'protein_milestone',
        day,
        note: '100g Protein erreicht.',
        summary: {
          protein,
          carbs: Number(summaryData?.carbs || 0),
          fat: Number(summaryData?.fat || 0),
          kcal: Number(summaryData?.kcal || 0)
        },
        photo_url: null
      },
      { onConflict: 'user_id,day,post_type' }
    );
  }

  private async uploadImage(file: File, bucketName: string, userId: string): Promise<string> {
    const extension = file.name.split('.').pop() || 'jpg';
    const filePath = `${userId}/${Date.now()}.${extension}`;

    const { error: uploadError } = await this.supabaseService.client.storage
      .from(bucketName)
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    return filePath;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  closeAmountPicker(): void {
    this.selectedItem.set(null);
    this.editingEntryId.set(null);
    this.selectedItemInitialAmount.set(100);
  }

  private formatWriteError(error: unknown): string {
    return formatAppError(error, 'Eintrag konnte nicht gespeichert werden');
  }
}
