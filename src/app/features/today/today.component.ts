import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChartLine,
  Clock3,
  Dumbbell,
  ListChecks,
  LucideAngularModule,
  Plus,
  Utensils,
  Weight
} from 'lucide-angular';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { DailySummary, Ingredient, LogEntry, Meal, WeightLog } from '../../core/types';
import { AmountPickerSheetComponent, AmountPickResult, MacroTotals } from '../../ui/amount-picker-sheet.component';
import { HeroRingComponent } from '../../ui/minimal/hero-ring.component';
import { MacroBarComponent } from '../../ui/minimal/macro-bar.component';
import { HabitGridComponent, HabitState } from '../../ui/minimal/habit-grid.component';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';
import { formatAppError } from '../../core/error-format';
import { LibraryDataService } from '../../core/library-data.service';
import { QueryCacheService } from '../../core/query-cache.service';

type QuickItem = Ingredient | Meal;

interface MealMacroMap {
  [mealId: string]: MacroTotals;
}

interface TodaySnapshot {
  entries: LogEntry[];
  summary: DailySummary | null;
  weightLogs: WeightLog[];
  gymDaysThisWeek: string[];
  proteinDaysThisWeek: string[];
}

@Component({
  selector: 'app-today',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    LucideAngularModule,
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

      <section class="panel hero">
        <p class="date-label"><lucide-icon [img]="icons.calendar" class="icon" aria-hidden="true"></lucide-icon> {{ todayLabel() }}</p>

        <div class="day-nav">
          <button mat-icon-button type="button" class="nav-btn" (click)="goPreviousDay()" aria-label="Vorheriger Tag">
            <lucide-icon [img]="icons.chevronLeft" aria-hidden="true"></lucide-icon>
          </button>
          <mat-form-field class="m3-field day-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Tag</mat-label>
            <input matInput type="date" class="day-input" [ngModel]="today()" (ngModelChange)="onDayPicked($event)">
          </mat-form-field>
          <button mat-icon-button type="button" class="nav-btn" (click)="goNextDay()" [disabled]="today() >= realToday" aria-label="Nächster Tag">
            <lucide-icon [img]="icons.chevronRight" aria-hidden="true"></lucide-icon>
          </button>
        </div>

        <div class="hero-actions">
          <button mat-flat-button type="button" class="action-btn" (click)="openActions()">
            <lucide-icon [img]="icons.plus" class="icon" aria-hidden="true"></lucide-icon>
            Eintrag hinzufügen
          </button>
          <button mat-flat-button type="button" class="action-btn ghost" [disabled]="today() === realToday" (click)="jumpToToday()">
            Heute
          </button>
        </div>

        <app-hero-ring [value]="proteinToday()" [target]="proteinGoal" accentColor="var(--m3-sys-color-primary)" />

        <div class="bars">
          <app-macro-bar label="Protein" [value]="proteinToday()" [target]="proteinGoal" color="var(--m3-sys-color-primary)" />
          <app-macro-bar label="Fett" [value]="fatToday()" [target]="fatGoal" color="var(--warning-500)" />
          <app-macro-bar label="Kohlenhydrate" [value]="carbsToday()" [target]="carbGoal" color="var(--success-500)" />
        </div>

        <div class="kcal-row">
          <span>Kalorien</span>
          <strong>{{ caloriesToday() }} kcal</strong>
        </div>

        <div class="weight-row">
          <span><lucide-icon [img]="icons.weight" class="icon" aria-hidden="true"></lucide-icon> Gewicht</span>
          <strong>{{ weightValueLabel() }}</strong>
          <span class="delta">{{ weightDeltaLabel() }}</span>
        </div>
      </section>

      <section class="panel section">
        <div class="m3-section-head">
          <h2><lucide-icon [img]="icons.chartLine" class="icon" aria-hidden="true"></lucide-icon> Gewichtstrend</h2>
          <span class="m3-section-meta">{{ recentWeightEntries().length }} Einträge</span>
        </div>
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

      <section class="panel section">
        <div class="m3-section-head">
          <h2><lucide-icon [img]="icons.listChecks" class="icon" aria-hidden="true"></lucide-icon> Gewohnheiten</h2>
          <span class="m3-section-meta">Diese Woche</span>
        </div>
        <app-habit-grid label="Gym" [states]="gymHabitStates()" [targetPerWeek]="3" />
        <app-habit-grid label="Protein" [states]="proteinHabitStates()" [targetPerWeek]="7" />
      </section>

      <section class="panel section">
        <div class="m3-section-head">
          <h2><lucide-icon [img]="icons.clock3" class="icon" aria-hidden="true"></lucide-icon> Geloggt am {{ today() }}</h2>
          <span class="m3-section-meta">{{ todayEntries().length }} Einträge</span>
        </div>
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
              <button type="button" class="entry-btn" (click)="openEntryActions(entry)">Mehr</button>
            </div>
          </article>
        }
        @if (todayEntries().length === 0) {
          <p class="muted">Für {{ today() }} noch keine Einträge.</p>
        }
      </section>

      <button mat-fab class="app-fab today-fab" type="button" (click)="openActions()" aria-label="Schnellaktionen">
        <lucide-icon [img]="icons.plus" class="fab-icon" aria-hidden="true"></lucide-icon>
      </button>
    </main>

    <app-bottom-sheet [open]="showActionSheet()" [title]="sheetTitle()" (closed)="closeActions()">
      @if (sheetMode() === 'menu') {
        <div class="action-list">
          <button type="button" class="menu-btn" (click)="setSheetMode('food')"><lucide-icon [img]="icons.utensils" class="icon" aria-hidden="true"></lucide-icon> Essen hinzufügen</button>
          <button type="button" class="menu-btn" (click)="setSheetMode('weight')"><lucide-icon [img]="icons.weight" class="icon" aria-hidden="true"></lucide-icon> Gewicht eintragen</button>
          <button type="button" class="menu-btn" (click)="setSheetMode('gym')"><lucide-icon [img]="icons.dumbbell" class="icon" aria-hidden="true"></lucide-icon> Gym erledigt</button>
        </div>
      }

      @if (sheetMode() === 'food') {
        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Lebensmittel suchen</mat-label>
          <input
            matInput
            type="search"
            [ngModel]="foodSearch()"
            (ngModelChange)="foodSearch.set($event)"
            placeholder="Lebensmittel suchen"
            aria-label="Lebensmittel suchen"
          >
        </mat-form-field>
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
        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Datum</mat-label>
          <input matInput id="weight-day-input" type="date" [(ngModel)]="weightDateInput">
        </mat-form-field>

        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Gewicht (kg)</mat-label>
          <input matInput id="weight-input" type="number" min="20" step="0.1" [(ngModel)]="weightInput">
        </mat-form-field>

        <button type="button" class="menu-btn" (click)="saveWeight()">Gewicht speichern</button>
      }

      @if (sheetMode() === 'gym') {
        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Notiz (optional)</mat-label>
          <textarea matInput id="gym-note-input" rows="3" [(ngModel)]="gymNote" placeholder="Was lief heute gut?"></textarea>
        </mat-form-field>

        <p class="file-label">Foto (optional)</p>
        <div class="file-row">
          <button type="button" class="menu-btn compact" (click)="pickGymPhoto()">Foto auswählen</button>
          <span class="file-name">{{ gymPhotoName() || 'Kein Foto gewählt' }}</span>
        </div>
        <input #gymPhotoInput id="gym-photo-input" class="sr-only" type="file" accept="image/*" (change)="onGymPhotoSelected($event)">

        <button type="button" class="menu-btn" [disabled]="savingGymPost()" (click)="submitGymPost()">
          {{ savingGymPost() ? 'Wird gepostet...' : 'Gym-Check-in posten' }}
        </button>
      }

      @if (sheetMode() === 'entry') {
        @if (selectedEntryForActions()) {
          <article class="entry-action-card">
            <p class="entry-action-title">{{ entryName(selectedEntryForActions()!) }}</p>
            <p class="entry-action-sub">{{ selectedEntryForActions()!.quantity }}{{ selectedEntryForActions()!.entry_type === 'ingredient' ? 'g' : ' Portionen' }} • {{ selectedEntryForActions()!.kcal.toFixed(0) }} kcal</p>
          </article>
          <div class="action-list">
            <button type="button" class="menu-btn" (click)="editSelectedEntry()">Bearbeiten</button>
            <button type="button" class="menu-btn danger-outline" (click)="deleteSelectedEntry()">Löschen</button>
          </div>
        }
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
      background: var(--m3-sys-color-surface);
      color: var(--m3-sys-color-on-surface);
      gap: 16px;
      padding: 16px;
    }

    .hero,
    .section {
      display: grid;
      gap: 12px;
    }

    .date-label {
      margin: 0;
      color: var(--m3-sys-color-on-surface-variant);
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
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface);
      color: var(--m3-sys-color-on-surface);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      line-height: 1;
    }

    .nav-btn lucide-icon {
      width: 18px;
      height: 18px;
    }

    .day-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .day-field .mat-mdc-text-field-wrapper {
      min-height: 44px;
      border-radius: 12px;
    }

    .hero-actions {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
    }

    .hero-actions .action-btn {
      min-height: 42px;
    }

    .icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 16px;
      margin-right: 8px;
      vertical-align: middle;
    }

    .fab-icon {
      width: 24px;
      height: 24px;
    }

    .bars {
      display: grid;
      gap: 8px;
    }

    .kcal-row,
    .weight-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--m3-sys-color-outline-variant);
      font-size: 16px;
    }

    .kcal-row span,
    .weight-row span {
      color: var(--m3-sys-color-on-surface-variant);
    }

    .kcal-row strong,
    .weight-row strong {
      color: var(--m3-sys-color-on-surface);
      font-weight: 600;
    }

    .delta {
      color: color-mix(in srgb, var(--m3-sys-color-on-surface-variant) 72%, transparent);
      font-size: 13px;
    }

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--m3-sys-color-on-surface);
    }

    .muted {
      margin: 0;
      color: color-mix(in srgb, var(--m3-sys-color-on-surface-variant) 72%, transparent);
      font-size: 13px;
    }

    .sparkline-wrap {
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface);
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
      stroke: var(--m3-sys-color-primary);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .trend-note {
      margin: 0;
      color: var(--m3-sys-color-on-surface-variant);
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
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface);
      padding: 10px;
    }

    .entry-card {
      display: grid;
      gap: 10px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface);
      padding: 12px;
    }

    .entry-main {
      display: grid;
      gap: 2px;
    }

    .entry-title {
      color: var(--m3-sys-color-on-surface);
      font-size: 16px;
      font-weight: 600;
    }

    .entry-sub,
    .entry-meta {
      margin: 0;
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 13px;
    }

    .entry-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .entry-btn {
      min-height: 40px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface-container);
      color: var(--m3-sys-color-on-surface);
      font-size: 14px;
      font-weight: 600;
    }

    .today-fab {
      z-index: 31;
    }

    .action-list,
    .food-list {
      display: grid;
      gap: 8px;
    }

    .menu-btn {
      min-height: 64px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface);
      color: var(--m3-sys-color-on-surface);
      font-size: 16px;
      font-weight: 600;
      text-align: left;
      padding: 8px 12px;
      display: grid;
      gap: 2px;
      align-content: center;
    }

    .action-list .menu-btn {
      min-height: 44px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
    }

    .file-label {
      margin: 0;
      font-size: 13px;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 600;
    }

    .file-row {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .menu-btn.compact {
      min-height: 44px;
      padding: 0 14px;
      width: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
    }

    .file-name {
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 13px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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

    .entry-action-card {
      border: 1px solid var(--m3-sys-color-outline-variant);
      background: var(--m3-sys-color-surface);
      padding: 10px;
      display: grid;
      gap: 4px;
    }

    .entry-action-title {
      margin: 0;
      color: var(--m3-sys-color-on-surface);
      font-size: 15px;
      font-weight: 700;
    }

    .entry-action-sub {
      margin: 0;
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 13px;
      font-weight: 600;
    }

    .danger-outline {
      border-color: var(--m3-sys-color-error);
      color: var(--m3-sys-color-on-error-container);
      background: var(--m3-sys-color-error-container);
    }

    .food-name {
      display: block;
      font-size: 16px;
      color: var(--m3-sys-color-on-surface);
      font-weight: 600;
      line-height: 1.25;
    }

    .food-macros {
      display: block;
      font-size: 12px;
      color: var(--m3-sys-color-on-surface-variant);
      font-weight: 600;
      line-height: 1.25;
      white-space: normal;
      opacity: 1;
    }

    .m3-field {
      margin-bottom: 2px;
    }
  `]
})
export class TodayComponent implements OnInit {
  readonly icons = {
    calendar: Calendar,
    chevronLeft: ChevronLeft,
    chevronRight: ChevronRight,
    weight: Weight,
    chartLine: ChartLine,
    listChecks: ListChecks,
    clock3: Clock3,
    plus: Plus,
    utensils: Utensils,
    dumbbell: Dumbbell
  };

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
  readonly sheetMode = signal<'menu' | 'food' | 'weight' | 'gym' | 'entry'>('menu');
  readonly foodSearch = signal('');
  readonly savingGymPost = signal(false);
  readonly gymPhotoName = signal<string | null>(null);
  readonly selectedEntryForActions = signal<LogEntry | null>(null);
  readonly gymPhotoInput = viewChild<ElementRef<HTMLInputElement>>('gymPhotoInput');

  readonly realToday = this.formatDate(new Date());
  readonly today = signal(this.realToday);
  weightDateInput = this.realToday;
  weightInput = 70;
  gymNote = '';
  private gymPhoto: File | null = null;

  private mealMacros: MealMacroMap = {};
  private readonly dayDataTtlMs = 1000 * 60 * 3;

  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly libraryDataService = inject(LibraryDataService);
  private readonly queryCache = inject(QueryCacheService);

  readonly todayLabel = computed(() =>
    new Date(`${this.today()}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })
  );
  readonly proteinToday = computed(() => Math.round(Number(this.summary()?.protein || 0)));
  readonly fatToday = computed(() => Math.round(Number(this.summary()?.fat || 0)));
  readonly carbsToday = computed(() => Math.round(Number(this.summary()?.carbs || 0)));
  readonly caloriesToday = computed(() => Math.round(Number(this.summary()?.kcal || 0)));

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

  async loadData(forceRefresh = false): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const library = await this.libraryDataService.loadLibrary(user.id, {
        forceRefresh,
        allowStaleOnError: true
      });

      this.ingredients.set(library.ingredients);
      this.meals.set(library.meals);
      this.mealMacros = library.mealMacros;

      const day = this.today();
      const weekRange = this.getCurrentWeekRange();
      const cacheKey = this.getTodayCacheKey(user.id, day, weekRange.start, weekRange.end);

      const dayResult = await this.queryCache.getOrLoad({
        key: cacheKey,
        ttlMs: this.dayDataTtlMs,
        forceRefresh,
        allowStaleOnError: true,
        loader: () => this.fetchDaySnapshot(user.id, day, weekRange.start, weekRange.end)
      });

      this.entries.set(dayResult.value.entries);
      this.summary.set(dayResult.value.summary);
      this.weightLogs.set(dayResult.value.weightLogs);
      this.gymDaysThisWeek.set(new Set(dayResult.value.gymDaysThisWeek));
      this.proteinDaysThisWeek.set(new Set(dayResult.value.proteinDaysThisWeek));

      const selectedWeight = this.weightLogs().find(entry => entry.logged_on === day);
      this.weightInput = Number(selectedWeight?.weight_kg || this.weightInput);
      this.weightDateInput = day;

      if (day === this.realToday && Number(dayResult.value.summary?.protein || 0) >= this.proteinGoal) {
        await this.ensureProteinMilestonePost(user.id, day, dayResult.value.summary);
      }
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Heute-Daten konnten nicht geladen werden'));
    } finally {
      this.loading.set(false);
    }
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

  jumpToToday(): void {
    if (this.today() === this.realToday) {
      return;
    }
    this.today.set(this.realToday);
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
    this.selectedEntryForActions.set(null);
    this.gymNote = '';
    this.gymPhoto = null;
    this.gymPhotoName.set(null);
    const photoInput = this.gymPhotoInput()?.nativeElement;
    if (photoInput) {
      photoInput.value = '';
    }
  }

  setSheetMode(mode: 'menu' | 'food' | 'weight' | 'gym' | 'entry'): void {
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
    if (this.sheetMode() === 'entry') return 'Eintrag';
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
    this.invalidateDayCaches(user.id);
    await this.loadData(true);
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

  openEntryActions(entry: LogEntry): void {
    this.selectedEntryForActions.set(entry);
    this.sheetMode.set('entry');
    this.showActionSheet.set(true);
  }

  editSelectedEntry(): void {
    const entry = this.selectedEntryForActions();
    if (!entry) {
      return;
    }

    this.closeActions();
    this.editEntry(entry);
  }

  async deleteSelectedEntry(): Promise<void> {
    const entry = this.selectedEntryForActions();
    if (!entry) {
      return;
    }
    await this.deleteEntry(entry.id);
    this.closeActions();
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
    this.invalidateDayCaches(user.id);
    await this.loadData(true);
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
    this.invalidateDayCaches(user.id);
    await this.loadData(true);
  }

  onGymPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.gymPhoto = input.files?.[0] || null;
    this.gymPhotoName.set(this.gymPhoto?.name || null);
  }

  pickGymPhoto(): void {
    this.gymPhotoInput()?.nativeElement.click();
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
      this.gymPhotoName.set(null);
      this.successMessage.set('Gym-Check-in gepostet.');
      this.closeActions();
      this.invalidateDayCaches(user.id);
      await this.loadData(true);
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

  entryName(entry: LogEntry): string {
    return entry.entry_type === 'ingredient' ? this.getIngredientName(entry.ref_id) : this.getMealName(entry.ref_id);
  }

  private invalidateDayCaches(userId: string): void {
    this.queryCache.invalidatePrefix(`today:${userId}:`);
    this.queryCache.invalidate(this.getProteinMilestoneCacheKey(userId, this.today()));
  }

  private getTodayCacheKey(userId: string, day: string, weekStart: string, weekEnd: string): string {
    return `today:${userId}:${day}:${weekStart}:${weekEnd}`;
  }

  private getProteinMilestoneCacheKey(userId: string, day: string): string {
    return `protein-posted:${userId}:${day}`;
  }

  private async fetchDaySnapshot(userId: string, day: string, weekStart: string, weekEnd: string): Promise<TodaySnapshot> {
    const [
      { data: entryData, error: entryError },
      { data: summaryData, error: summaryError },
      { data: weightData, error: weightError },
      { data: gymPostsData, error: gymPostsError },
      { data: proteinSummaryData, error: proteinSummaryError }
    ] = await Promise.all([
      this.supabaseService.client
        .from('log_entries')
        .select('id,owner_id,group_id,day,entry_type,ref_id,quantity,kcal,protein,carbs,fat,created_at')
        .eq('owner_id', userId)
        .is('group_id', null)
        .eq('day', day)
        .order('created_at', { ascending: false }),
      this.supabaseService.client
        .from('daily_summaries')
        .select('owner_id,group_id,day,kcal,protein,carbs,fat,updated_at')
        .eq('owner_id', userId)
        .is('group_id', null)
        .eq('day', day)
        .maybeSingle(),
      this.supabaseService.client
        .from('weight_logs')
        .select('id,user_id,logged_on,weight_kg,note,created_at')
        .eq('user_id', userId)
        .order('logged_on', { ascending: false })
        .limit(30),
      this.supabaseService.client
        .from('community_posts')
        .select('day')
        .eq('user_id', userId)
        .eq('post_type', 'gym_checkin')
        .gte('day', weekStart)
        .lte('day', weekEnd),
      this.supabaseService.client
        .from('daily_summaries')
        .select('day,protein')
        .eq('owner_id', userId)
        .is('group_id', null)
        .gte('day', weekStart)
        .lte('day', weekEnd)
    ]);

    if (entryError || summaryError || weightError || gymPostsError || proteinSummaryError) {
      throw entryError || summaryError || weightError || gymPostsError || proteinSummaryError;
    }

    return {
      entries: (entryData || []) as LogEntry[],
      summary: (summaryData as DailySummary | null) || null,
      weightLogs: (weightData || []) as WeightLog[],
      gymDaysThisWeek: (gymPostsData || []).map(row => String(row.day)),
      proteinDaysThisWeek: (proteinSummaryData || [])
        .filter(row => Number(row.protein) >= this.proteinGoal)
        .map(row => String(row.day))
    };
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

  private async ensureProteinMilestonePost(
    userId: string,
    day: string,
    initialSummary?: Pick<DailySummary, 'protein' | 'kcal' | 'carbs' | 'fat'> | null
  ): Promise<void> {
    if (this.queryCache.getFresh<boolean>(this.getProteinMilestoneCacheKey(userId, day))) {
      return;
    }

    let summaryData = initialSummary;
    if (!summaryData) {
      const { data } = await this.supabaseService.client
        .from('daily_summaries')
        .select('protein,kcal,carbs,fat')
        .eq('owner_id', userId)
        .is('group_id', null)
        .eq('day', day)
        .maybeSingle();
      summaryData = data as Pick<DailySummary, 'protein' | 'kcal' | 'carbs' | 'fat'> | null;
    }

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

    this.queryCache.set(this.getProteinMilestoneCacheKey(userId, day), true, 1000 * 60 * 60 * 6);
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
