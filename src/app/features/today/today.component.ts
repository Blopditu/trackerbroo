import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { ActiveGroupService } from '../../core/active-group.service';
import { DailySummary, GroupActivity, Ingredient, LogEntry, Meal, WeightLog } from '../../core/types';
import { AmountPickerSheetComponent, AmountPickResult, MacroTotals } from '../../ui/amount-picker-sheet.component';
import { HeroRingComponent } from '../../ui/minimal/hero-ring.component';
import { MacroBarComponent } from '../../ui/minimal/macro-bar.component';
import { HabitGridComponent, HabitState } from '../../ui/minimal/habit-grid.component';
import { ListRowComponent } from '../../ui/minimal/list-row.component';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';

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
    ListRowComponent,
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

        <app-hero-ring [value]="proteinToday()" [target]="proteinGoal" accentColor="#5B8CFF" />

        <div class="bars">
          <app-macro-bar label="Protein" [value]="proteinToday()" [target]="proteinGoal" color="#5B8CFF" />
          <app-macro-bar label="Fat" [value]="fatToday()" [target]="fatGoal" color="#F4B740" />
          <app-macro-bar label="Carbs" [value]="carbsToday()" [target]="carbGoal" color="#3DBB78" />
        </div>

        <div class="weight-row">
          <span><i class="fa-solid fa-weight-scale icon" aria-hidden="true"></i> Weight</span>
          <strong>{{ weightValueLabel() }}</strong>
          <span class="delta">{{ weightDeltaLabel() }}</span>
        </div>
      </section>

      <section class="section">
        <h2><i class="fa-solid fa-list-check icon" aria-hidden="true"></i> Habits</h2>
        <app-habit-grid label="Gym" [states]="gymHabitStates()" [targetPerWeek]="3" />
        <app-habit-grid label="Protein" [states]="proteinHabitStates()" [targetPerWeek]="7" />
        <app-habit-grid label="Sleep" [states]="sleepHabitStates()" [targetPerWeek]="5" />
      </section>

      <section class="section">
        <h2><i class="fa-regular fa-clock icon" aria-hidden="true"></i> Recent Activity</h2>
        @for (entry of recentEntries(); track entry.id) {
          <app-list-row
            [title]="entry.entry_type === 'ingredient' ? getIngredientName(entry.ref_id) : getMealName(entry.ref_id)"
            [subtitle]="entry.quantity + (entry.entry_type === 'ingredient' ? 'g' : ' Portionen') + ' · P ' + entry.protein.toFixed(1) + 'g'"
            [meta]="entry.created_at.slice(11,16)"
          />
        }
        @if (recentEntries().length === 0) {
          <p class="muted">No activity yet today.</p>
        }
      </section>

      <button class="today-fab" type="button" (click)="openActions()" aria-label="Schnellaktionen"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
    </main>

    <app-bottom-sheet [open]="showActionSheet()" [title]="sheetTitle()" (closed)="closeActions()">
      @if (sheetMode() === 'menu') {
        <div class="action-list">
          <button type="button" class="menu-btn" (click)="setSheetMode('food')"><i class="fa-solid fa-utensils icon" aria-hidden="true"></i> 🍗 Add Food</button>
          <button type="button" class="menu-btn" (click)="setSheetMode('weight')"><i class="fa-solid fa-weight-scale icon" aria-hidden="true"></i> ⚖️ Add Weight</button>
          <button type="button" class="menu-btn" (click)="quickRitual('gym')"><i class="fa-solid fa-dumbbell icon" aria-hidden="true"></i> 🏋️ Gym Done</button>
          <button type="button" class="menu-btn" (click)="quickRitual('sleep')"><i class="fa-solid fa-moon icon" aria-hidden="true"></i> 😴 Sleep Done</button>
        </div>
      }

      @if (sheetMode() === 'food') {
        <input type="search" [(ngModel)]="foodSearch" placeholder="Search food" aria-label="Food search">
        <div class="food-list">
          @for (item of quickFoodItems(); track item.id) {
            <button type="button" class="menu-btn" (click)="openAmountPicker(item)">{{ item.name }}</button>
          }
        </div>
      }

      @if (sheetMode() === 'weight') {
        <label for="weight-input">Weight (kg)</label>
        <input id="weight-input" type="number" min="20" step="0.1" [(ngModel)]="weightInput">
        <button type="button" class="menu-btn" (click)="saveWeight()">Save Weight</button>
      }
    </app-bottom-sheet>

    @if (selectedItem()) {
      <app-amount-picker-sheet
        [itemName]="selectedItem()!.name"
        [unitLabel]="isIngredient(selectedItem()!) ? 'g' : 'x'"
        [presets]="isIngredient(selectedItem()!) ? [100, 150, 200, 250] : [1, 1.5, 2, 3]"
        [baseAmount]="isIngredient(selectedItem()!) ? 100 : 1"
        [baseMacros]="selectedItemMacros()"
        [initialAmount]="isIngredient(selectedItem()!) ? 100 : 1"
        (confirmed)="confirmQuickAdd($event)"
        (closed)="selectedItem.set(null)"
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
      min-height: 44px;
      border: 1px solid #1B202B;
      background: #0F1115;
      color: #E6E8EC;
      font-size: 16px;
      font-weight: 600;
      text-align: left;
      padding: 0 12px;
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
  readonly groupActivities = signal<GroupActivity[]>([]);
  readonly weightLogs = signal<WeightLog[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly showActionSheet = signal(false);
  readonly sheetMode = signal<'menu' | 'food' | 'weight'>('menu');
  foodSearch = '';
  weightInput = 70;

  private mealMacros: MealMacroMap = {};

  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly activeGroupService = inject(ActiveGroupService);

  readonly today = signal(this.formatDate(new Date()));
  readonly todayLabel = computed(() => new Date(`${this.today()}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' }));
  readonly proteinToday = computed(() => Math.round(Number(this.summary()?.protein || 0)));
  readonly fatToday = computed(() => Math.round(Number(this.summary()?.fat || 0)));
  readonly carbsToday = computed(() => Math.round(Number(this.summary()?.carbs || 0)));

  readonly recentEntries = computed(() => this.entries().slice(0, 3));

  readonly quickFoodItems = computed(() => {
    const query = this.foodSearch.trim().toLowerCase();
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

    if (this.isIngredient(item)) {
      return {
        kcal: Number(item.kcal_per_100),
        protein: Number(item.protein_per_100),
        carbs: Number(item.carbs_per_100),
        fat: Number(item.fat_per_100)
      };
    }

    return this.mealMacros[item.id] || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  });

  readonly gymHabitStates = computed(() => this.toHabitStates('gym_done'));
  readonly sleepHabitStates = computed(() => this.toHabitStates('sleep_done'));
  readonly proteinHabitStates = computed(() => {
    const states = this.toHabitStates('protein_done');
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
      this.errorMessage.set('Could not load food library.');
      this.loading.set(false);
      return;
    }

    const ingredients = (ingredientsData || []) as Ingredient[];
    const meals = (mealsData || []) as Meal[];
    this.ingredients.set(ingredients);
    this.meals.set(meals);
    await this.loadMealMacros(meals, ingredients);

    const groupId = this.activeGroupService.activeGroupId();

    let entryQuery = this.supabaseService.client
      .from('log_entries')
      .select('*')
      .eq('owner_id', user.id)
      .eq('day', this.today())
      .order('created_at', { ascending: false });

    entryQuery = groupId ? entryQuery.eq('group_id', groupId) : entryQuery.is('group_id', null);
    const { data: entryData, error: entryError } = await entryQuery;

    if (entryError) {
      this.errorMessage.set('Could not load entries.');
      this.loading.set(false);
      return;
    }

    this.entries.set((entryData || []) as LogEntry[]);

    let summaryQuery = this.supabaseService.client
      .from('daily_summaries')
      .select('*')
      .eq('owner_id', user.id)
      .eq('day', this.today());

    summaryQuery = groupId ? summaryQuery.eq('group_id', groupId) : summaryQuery.is('group_id', null);
    const { data: summaryData } = await summaryQuery.maybeSingle();
    this.summary.set(summaryData as DailySummary | null);

    const { data: weightData } = await this.supabaseService.client
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('logged_on', { ascending: false })
      .limit(2);

    this.weightLogs.set((weightData || []) as WeightLog[]);
    this.weightInput = Number(this.weightLogs()[0]?.weight_kg || this.weightInput);

    if (groupId) {
      const weekRange = this.getCurrentWeekRange();
      const { data: activityData } = await this.supabaseService.client
        .from('group_activities')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .gte('day', weekRange.start)
        .lte('day', weekRange.end);

      this.groupActivities.set((activityData || []) as GroupActivity[]);

      if (Number(summaryData?.protein || 0) >= this.proteinGoal) {
        await this.ensureProteinRitual(groupId, user.id, this.today());
      }
    } else {
      this.groupActivities.set([]);
    }

    this.loading.set(false);
  }

  openActions(): void {
    this.sheetMode.set('menu');
    this.showActionSheet.set(true);
  }

  closeActions(): void {
    this.showActionSheet.set(false);
    this.sheetMode.set('menu');
  }

  setSheetMode(mode: 'menu' | 'food' | 'weight'): void {
    this.sheetMode.set(mode);
  }

  sheetTitle(): string {
    if (this.sheetMode() === 'food') return 'Add Food';
    if (this.sheetMode() === 'weight') return 'Add Weight';
    return 'Quick Actions';
  }

  isIngredient(item: QuickItem): item is Ingredient {
    return 'kcal_per_100' in item;
  }

  openAmountPicker(item: QuickItem): void {
    this.selectedItem.set(item);
  }

  async confirmQuickAdd(result: AmountPickResult): Promise<void> {
    const item = this.selectedItem();
    const user = this.authService.user();
    if (!item || !user) {
      return;
    }

    const { error } = await this.supabaseService.client.from('log_entries').insert({
      owner_id: user.id,
      group_id: this.activeGroupService.activeGroupId(),
      day: this.today(),
      entry_type: this.isIngredient(item) ? 'ingredient' : 'meal',
      ref_id: item.id,
      quantity: result.amount,
      kcal: Number(result.totals.kcal.toFixed(2)),
      protein: Number(result.totals.protein.toFixed(2)),
      carbs: Number(result.totals.carbs.toFixed(2)),
      fat: Number(result.totals.fat.toFixed(2))
    });

    if (error) {
      this.errorMessage.set(this.formatWriteError(error.message));
      return;
    }

    this.successMessage.set(`${item.name} added.`);
    this.selectedItem.set(null);
    this.closeActions();
    await this.loadData();
  }

  async saveWeight(): Promise<void> {
    const user = this.authService.user();
    if (!user || this.weightInput <= 0) {
      this.errorMessage.set('Please enter a valid weight.');
      return;
    }

    const { error } = await this.supabaseService.client
      .from('weight_logs')
      .upsert(
        {
          user_id: user.id,
          logged_on: this.today(),
          weight_kg: this.weightInput,
          note: null
        },
        { onConflict: 'user_id,logged_on' }
      );

    if (error) {
      this.errorMessage.set('Could not save weight.');
      return;
    }

    this.successMessage.set('Weight saved.');
    this.closeActions();
    await this.loadData();
  }

  async quickRitual(type: 'gym' | 'sleep'): Promise<void> {
    const user = this.authService.user();
    const groupId = this.activeGroupService.activeGroupId();

    if (!user || !groupId) {
      this.errorMessage.set('Join or create a group for ritual check-ins.');
      return;
    }

    const day = this.today();
    const payload = {
      group_id: groupId,
      user_id: user.id,
      day,
      gym_done: type === 'gym',
      sleep_done: type === 'sleep',
      protein_done: false,
      confirm_done: false,
      note: null,
      photo_url: null
    };

    const { data: existing } = await this.supabaseService.client
      .from('group_activities')
      .select('*')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .eq('day', day)
      .maybeSingle();

    const { error } = await this.supabaseService.client
      .from('group_activities')
      .upsert(
        {
          ...payload,
          gym_done: type === 'gym' || Boolean(existing?.gym_done),
          sleep_done: type === 'sleep' || Boolean(existing?.sleep_done),
          protein_done: Boolean(existing?.protein_done),
          confirm_done: Boolean(existing?.confirm_done),
          note: existing?.note || null,
          photo_url: existing?.photo_url || null
        },
        { onConflict: 'group_id,user_id,day' }
      );

    if (error) {
      this.errorMessage.set('Ritual could not be saved.');
      return;
    }

    if (type === 'gym') {
      const week = this.getCurrentWeekRange();
      await this.supabaseService.client.from('gym_checkins').insert({
        group_id: groupId,
        user_id: user.id,
        checkin_date: day,
        week_start: week.start,
        note: null,
        photo_url: null
      });
    }

    this.successMessage.set(type === 'gym' ? 'Gym ritual saved.' : 'Sleep ritual saved.');
    this.closeActions();
    await this.loadData();
  }

  getIngredientName(id: string): string {
    return this.ingredients().find(item => item.id === id)?.name || 'Unknown';
  }

  getMealName(id: string): string {
    return this.meals().find(item => item.id === id)?.name || 'Unknown';
  }

  weightValueLabel(): string {
    const latest = this.weightLogs()[0];
    return latest ? `${latest.weight_kg} kg` : '--';
  }

  weightDeltaLabel(): string {
    if (this.weightLogs().length < 2) return '--';
    const current = Number(this.weightLogs()[0].weight_kg);
    const prev = Number(this.weightLogs()[1].weight_kg);
    const delta = Number((current - prev).toFixed(1));
    return delta > 0 ? `+${delta} kg` : `${delta} kg`;
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

  private toHabitStates(field: 'gym_done' | 'sleep_done' | 'protein_done'): HabitState[] {
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
      const activity = this.groupActivities().find(item => item.day === day);
      if (!activity) continue;
      states[i] = activity[field] ? 'complete' : 'missed';
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

  private async ensureProteinRitual(groupId: string, userId: string, day: string): Promise<void> {
    await this.supabaseService.client.from('group_activities').upsert(
      {
        group_id: groupId,
        user_id: userId,
        day,
        protein_done: true
      },
      { onConflict: 'group_id,user_id,day' }
    );
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatWriteError(message: string): string {
    if (message.includes('group_id') && message.includes('null value')) {
      return 'Private mode migration is missing.';
    }
    return 'Could not save entry.';
  }
}
