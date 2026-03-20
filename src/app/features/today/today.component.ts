import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  Footprints,
  ListChecks,
  LucideAngularModule,
  Plus,
  Star,
  Trash2,
  Utensils,
  Weight
} from 'lucide-angular';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { CommunityPost, DailySummary, Ingredient, LogEntry, Meal, Profile, StepLog, WeightLog } from '../../core/types';
import { AmountPickerSheetComponent, AmountPickResult, MacroTotals } from '../../ui/amount-picker-sheet.component';
import { HeroRingComponent } from '../../ui/minimal/hero-ring.component';
import { MacroBarComponent } from '../../ui/minimal/macro-bar.component';
import { HabitGridComponent, HabitState } from '../../ui/minimal/habit-grid.component';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';
import { formatAppError } from '../../core/error-format';
import { LibraryDataService } from '../../core/library-data.service';
import { QueryCacheService } from '../../core/query-cache.service';
import { InteractionTelemetryService } from '../../core/interaction-telemetry.service';
import { CommunityFeedService, CommunityProfileDirectoryEntry } from '../../core/community-feed.service';

type QuickItem = Ingredient | Meal;

interface MealMacroMap {
  [mealId: string]: MacroTotals;
}

interface TodaySnapshot {
  entries: LogEntry[];
  summary: DailySummary | null;
  weightLogs: WeightLog[];
  stepLogs: StepLog[];
  gymDaysThisWeek: string[];
  proteinDaysThisWeek: string[];
  proteinMilestonePosted: boolean;
  stepsMilestonePosted: boolean;
  profile: Profile | null;
}

type FoodFilter = 'all' | 'favorites' | 'recent';
type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

interface FoodQueueItem {
  id: string;
  itemId: string;
  itemType: 'ingredient' | 'meal';
  name: string;
  mealSlot: MealSlot;
  amount: number;
  totals: MacroTotals;
}

interface BrooBoardPost {
  post: CommunityPost;
  displayName: string;
  photoUrl: string | null;
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
        <p class="toast error" role="status" aria-live="polite" aria-atomic="true">{{ errorMessage() }}</p>
      }

      @if (successMessage()) {
        <p class="toast success" role="status" aria-live="polite" aria-atomic="true">{{ successMessage() }}</p>
      }

      <section class="panel broo-board" aria-labelledby="broo-board-title">
        <div class="broo-board-head">
          <div>
            <p class="title-font">Broo Board</p>
            <h1 id="broo-board-title">Heute bei den Broos</h1>
            <p class="broo-lead">Kurz sehen, wer schon geliefert hat, und direkt nachziehen.</p>
          </div>
          <span class="board-badge">{{ brooBoardPosts().length }} Einträge</span>
        </div>

        <div class="board-actions">
          <button mat-flat-button type="button" class="action-btn board-primary-btn" (click)="openGymCheckInComposer()">
            <lucide-icon [img]="icons.dumbbell" class="icon" aria-hidden="true"></lucide-icon>
            Auch im Gym gewesen
          </button>
          <button mat-flat-button type="button" class="action-btn tonal board-secondary-btn" (click)="openFoodQuickLog()">
            <lucide-icon [img]="icons.utensils" class="icon" aria-hidden="true"></lucide-icon>
            Protein jetzt loggen
          </button>
        </div>

        @if (loadingBrooBoard()) {
          <p class="muted">Der Gruppenrhythmus wird geladen …</p>
        } @else if (brooBoardPosts().length > 0) {
          <div class="board-stream" aria-label="Letzte Gruppenaktivität">
            @for (item of brooBoardPosts(); track item.post.id; let index = $index) {
              <article class="board-post" [style.--stagger]="index">
                <div class="board-post-top">
                  <div>
                    <strong>{{ item.displayName }}</strong>
                    <p class="board-post-meta">{{ brooPostLabel(item.post) }}</p>
                  </div>
                  <span class="board-post-day">{{ brooPostDayLabel(item.post.day) }}</span>
                </div>

                <p class="board-post-copy">{{ brooPostSummary(item.post) }}</p>

                @if (item.photoUrl) {
                  <img [src]="item.photoUrl" alt="" class="board-post-photo" loading="lazy" decoding="async">
                }
              </article>
            }
          </div>
        } @else {
          <p class="muted">Heute hat noch niemand etwas geteilt. Starte den ersten Check-in für eure Woche.</p>
        }
      </section>

      <section class="panel my-day-panel">
        <div class="my-day-head">
          <div>
            <p class="title-font">Mein Tag</p>
            <h2>{{ todayLabel() }}</h2>
          </div>
          <p class="date-label"><lucide-icon [img]="icons.calendar" class="icon" aria-hidden="true"></lucide-icon> {{ today() }}</p>
        </div>

        <div class="today-toolbar">
          <div class="day-nav">
            <button mat-icon-button type="button" class="nav-btn" (click)="goPreviousDay()" aria-label="Vorheriger Tag">
              <lucide-icon [img]="icons.chevronLeft" aria-hidden="true"></lucide-icon>
            </button>
            <mat-form-field class="m3-field day-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Tag</mat-label>
              <input
                matInput
                type="date"
                class="day-input"
                [ngModel]="today()"
                (ngModelChange)="onDayPicked($event)"
              >
            </mat-form-field>
            <button mat-icon-button type="button" class="nav-btn" (click)="goNextDay()" [disabled]="!canGoNextDay()" aria-label="Nächster Tag">
              <lucide-icon [img]="icons.chevronRight" aria-hidden="true"></lucide-icon>
            </button>
          </div>

          <div class="hero-actions">
            <button mat-flat-button type="button" class="action-btn compact today-quick-btn" (click)="openActions()">
              <lucide-icon [img]="icons.plus" class="icon" aria-hidden="true"></lucide-icon>
              Schnell loggen
            </button>
            <button mat-flat-button type="button" class="action-btn ghost compact" [disabled]="today() === realToday" (click)="jumpToToday()">
              Heute
            </button>
          </div>
        </div>

        @if (canShareProteinMilestone()) {
          <button mat-flat-button type="button" class="action-btn tonal protein-share-btn" (click)="shareProteinMilestone()">
            Protein-Ziel im Board teilen
          </button>
        }

        @if (canShareStepsMilestone()) {
          <button mat-flat-button type="button" class="action-btn tonal protein-share-btn" (click)="shareStepsMilestone()">
            Schrittziel im Board teilen
          </button>
        }

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

        @if (trackStepsEnabled()) {
          <div class="weight-row">
            <span><lucide-icon [img]="icons.footsteps" class="icon" aria-hidden="true"></lucide-icon> Schritte</span>
            <strong>{{ stepsValueLabel() }}</strong>
            <span class="delta">{{ stepsGoalLabel() }}</span>
          </div>
        }
      </section>

      <section class="panel section">
        <div class="m3-section-head">
          <h2><lucide-icon [img]="icons.chartLine" class="icon" aria-hidden="true"></lucide-icon> Gewichtstrend</h2>
          <span class="m3-section-meta">{{ trendWeightEntries().length }} Einträge</span>
        </div>
        <div
          class="filter-toggle"
          role="group"
          aria-label="Zeitraum für Gewichtstrend"
          style="grid-template-columns: repeat(2, minmax(0, 1fr));"
        >
          <button
            mat-flat-button
            type="button"
            class="filter-btn"
            [class.active]="weightTrendDays() === 7"
            (click)="setWeightTrendDays(7)"
          >
            7 Tage
          </button>
          <button
            mat-flat-button
            type="button"
            class="filter-btn"
            [class.active]="weightTrendDays() === 30"
            (click)="setWeightTrendDays(30)"
          >
            30 Tage
          </button>
        </div>
        <div class="sparkline-wrap" aria-label="Gewichtstrend">
          <svg viewBox="0 0 100 28" preserveAspectRatio="none" class="sparkline">
            <polyline [attr.points]="weightSparklinePoints()" />
          </svg>
          <div class="trend-note">{{ weightTrendDays() }}-Tage-Veränderung: {{ weeklyTrendLabel() }}</div>
        </div>

        <div class="weight-list">
          @for (entry of recentWeightEntries(); track entry.id) {
            <article class="weight-entry">
              <div>
                <strong>{{ entry.weight_kg }} kg</strong>
                <p class="entry-meta">{{ entry.logged_on }}</p>
              </div>
              <button mat-flat-button type="button" class="entry-btn" (click)="editWeight(entry)">Bearbeiten</button>
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
            </div>
            <div class="entry-actions">
              <button mat-flat-button type="button" class="entry-btn" (click)="openEntryActions(entry)">Verwalten</button>
            </div>
          </article>
        }
      @if (todayEntries().length === 0) {
          <p class="muted">Für heute ist noch nichts geloggt. Starte mit einem schnellen Eintrag oder zieh beim Gruppenrhythmus mit.</p>
        }
      </section>

    </main>

    <app-bottom-sheet [open]="showActionSheet()" [title]="sheetTitle()" (closed)="closeActions()">
      @if (sheetMode() === 'menu') {
        <section class="quick-add-menu">
          <div class="quick-add-grid" role="group" aria-label="Schnelllog-Aktionen">
            <button mat-flat-button type="button" class="quick-add-tile" (click)="setSheetMode('gym')">
              <span class="quick-add-icon gym"><lucide-icon [img]="icons.dumbbell" aria-hidden="true"></lucide-icon></span>
              <span class="quick-add-copy">
                <span class="quick-add-kicker">Workout</span>
                <strong>Gym-Session loggen</strong>
              </span>
            </button>

            @if (trackStepsEnabled()) {
              <button mat-flat-button type="button" class="quick-add-tile" (click)="setSheetMode('steps')">
                <span class="quick-add-icon steps"><lucide-icon [img]="icons.footsteps" aria-hidden="true"></lucide-icon></span>
                <span class="quick-add-copy">
                  <span class="quick-add-kicker">Aktivität</span>
                  <strong>Schritte hinzufügen</strong>
                </span>
              </button>
            } @else {
              <button mat-flat-button type="button" class="quick-add-tile" (click)="setSheetMode('copy')">
                <span class="quick-add-icon copy"><lucide-icon [img]="icons.clock3" aria-hidden="true"></lucide-icon></span>
                <span class="quick-add-copy">
                  <span class="quick-add-kicker">Shortcut</span>
                  <strong>Von gestern kopieren</strong>
                </span>
              </button>
            }

            <button mat-flat-button type="button" class="quick-add-tile" (click)="setSheetMode('weight')">
              <span class="quick-add-icon weight"><lucide-icon [img]="icons.weight" aria-hidden="true"></lucide-icon></span>
              <span class="quick-add-copy">
                <span class="quick-add-kicker">Messwert</span>
                <strong>Gewicht loggen</strong>
              </span>
            </button>

            <button mat-flat-button type="button" class="quick-add-tile" (click)="openFoodQuickLog()">
              <span class="quick-add-icon food"><lucide-icon [img]="icons.utensils" aria-hidden="true"></lucide-icon></span>
              <span class="quick-add-copy">
                <span class="quick-add-kicker">Nutrition</span>
                <strong>Essen hinzufügen</strong>
              </span>
            </button>
          </div>

          <div class="quick-add-secondary">
            <button mat-flat-button type="button" class="day-chip recent-activities-btn" (click)="openRecentActivities()">
              <lucide-icon [img]="icons.clock3" class="icon" aria-hidden="true"></lucide-icon>
              Letzte Aktivitäten
            </button>
          </div>
        </section>
      }

      @if (sheetMode() === 'food') {
        <section class="food-sheet food-hub">
          <mat-form-field class="m3-field food-search-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Lebensmittel suchen</mat-label>
            <input
              #foodSearchInput
              matInput
              type="search"
              [ngModel]="foodSearch()"
              (ngModelChange)="onFoodSearchInput($event)"
              placeholder="Lebensmittel suchen"
              aria-label="Lebensmittel suchen"
            >
          </mat-form-field>

          <div class="food-hub-actions">
            <button mat-flat-button type="button" class="food-hub-card" (click)="setSheetMode('copy')">
              <span class="food-hub-card-kicker">Shortcut</span>
              <strong>Von gestern kopieren</strong>
              <small>Übernimm bestehende Einträge direkt nach heute.</small>
            </button>
            <button mat-flat-button type="button" class="food-hub-card" (click)="setSheetMode('mealprep')">
              <span class="food-hub-card-kicker">Batch</span>
              <strong>Meal Prep aufteilen</strong>
              <small>Teile heutige Einträge auf mehrere Tage auf.</small>
            </button>
            <button mat-flat-button type="button" class="food-hub-card food-hub-card-accent" (click)="openFoodBuilder()">
              <span class="food-hub-card-kicker">Builder</span>
              <strong>Schnelleingabe / Makros</strong>
              <small>Durchsuche deine Bibliothek und baue den Log in Ruhe auf.</small>
            </button>
          </div>

          <div class="slot-row" role="group" aria-label="Mahlzeiten-Slot">
            <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'breakfast'" (click)="setMealSlot('breakfast')">Frühstück</button>
            <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'lunch'" (click)="setMealSlot('lunch')">Mittag</button>
            <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'dinner'" (click)="setMealSlot('dinner')">Abend</button>
            <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'snack'" (click)="setMealSlot('snack')">Snack</button>
            <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'other'" (click)="setMealSlot('other')">Sonstiges</button>
          </div>

          <div class="sheet-subhead">
            <div>
              <p class="sheet-kicker">Zuletzt geloggt</p>
              <p class="sheet-caption">Direkt in die Log-Liste legen oder tiefer in den Builder gehen.</p>
            </div>
            <button mat-flat-button type="button" class="day-chip" (click)="openFoodBuilder('all')">Alle Lebensmittel</button>
          </div>

          <div class="food-list hub-food-list">
            @for (item of foodHubItems(); track item.id) {
              <article class="food-row">
                <button mat-flat-button type="button" class="food-open-btn" (click)="openAmountPicker(item, 'queue')">
                  <span class="food-name">{{ item.name }}</span>
                  <small class="food-macros">{{ quickItemMacroLine(item) }}</small>
                </button>
                <div class="food-row-actions">
                  <button mat-icon-button type="button" class="round-icon-btn primary" (click)="addDefaultToQueue(item)" aria-label="Zur Log-Liste hinzufügen">
                    <lucide-icon [img]="icons.plus" aria-hidden="true"></lucide-icon>
                  </button>
                </div>
              </article>
            }
            @if (foodHubItems().length === 0) {
              <p class="muted">Keine Treffer für deinen Filter.</p>
            }
          </div>

          @if (favoriteQuickItems().length > 0) {
            <div class="favorite-row" role="group" aria-label="Favoriten">
              @for (item of favoriteQuickItems(); track item.id) {
                <button mat-flat-button type="button" class="favorite-chip" (click)="addDefaultToQueue(item)">
                  {{ item.name }}
                </button>
              }
            </div>
          }

          @if (foodQueueCount() > 0) {
            <article class="queue-preview-card">
              <div>
                <p class="sheet-kicker">Log-Liste</p>
                <strong>{{ foodQueueCount() }} Einträge bereit</strong>
                <small>P {{ queueTotals().protein.toFixed(0) }} · KH {{ queueTotals().carbs.toFixed(0) }} · F {{ queueTotals().fat.toFixed(0) }} · {{ queueTotals().kcal.toFixed(0) }} kcal</small>
              </div>
              <div class="queue-preview-actions">
                <button mat-flat-button type="button" class="day-chip" (click)="openFoodBuilder()">Bearbeiten</button>
                <button mat-flat-button type="button" class="menu-btn apply-log-btn" (click)="applyFoodQueue()">Loggen</button>
              </div>
            </article>
          }
        </section>
      }

      @if (sheetMode() === 'builder') {
        <section class="food-sheet meal-builder-sheet">
          <div class="utility-row">
            <button mat-flat-button type="button" class="day-chip" (click)="setSheetMode('food')">Zurück zum Hub</button>
            <button mat-flat-button type="button" class="day-chip" (click)="setSheetMode('mealprep')">Meal Prep</button>
          </div>

          <mat-form-field class="m3-field food-search-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Lebensmittel suchen</mat-label>
            <input
              matInput
              type="search"
              [ngModel]="foodSearch()"
              (ngModelChange)="onFoodSearchInput($event)"
              placeholder="Lebensmittel suchen"
              aria-label="Lebensmittel suchen"
            >
          </mat-form-field>

          <div class="builder-macro-grid" aria-label="Meal Builder Makros">
            <article class="builder-macro-card">
              <span>Protein</span>
              <strong>{{ queueTotals().protein.toFixed(0) }}g</strong>
            </article>
            <article class="builder-macro-card">
              <span>KH</span>
              <strong>{{ queueTotals().carbs.toFixed(0) }}g</strong>
            </article>
            <article class="builder-macro-card">
              <span>Fett</span>
              <strong>{{ queueTotals().fat.toFixed(0) }}g</strong>
            </article>
            <article class="builder-macro-card builder-macro-card-accent">
              <span>Kcal</span>
              <strong>{{ queueTotals().kcal.toFixed(0) }}</strong>
            </article>
          </div>

          <div class="slot-row" role="group" aria-label="Mahlzeiten-Slot">
            <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'breakfast'" (click)="setMealSlot('breakfast')">Frühstück</button>
            <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'lunch'" (click)="setMealSlot('lunch')">Mittag</button>
            <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'dinner'" (click)="setMealSlot('dinner')">Abend</button>
            <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'snack'" (click)="setMealSlot('snack')">Snack</button>
            <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'other'" (click)="setMealSlot('other')">Sonstiges</button>
          </div>

          <div class="filter-toggle compact-filter" role="group" aria-label="Food Filter">
            <button
              mat-flat-button
              type="button"
              class="filter-btn"
              [class.active]="foodFilter() === 'recent'"
              (click)="setFoodFilter('recent')"
            >
              Zuletzt
            </button>
            <button
              mat-flat-button
              type="button"
              class="filter-btn"
              [class.active]="foodFilter() === 'favorites'"
              (click)="setFoodFilter('favorites')"
            >
              Favoriten
            </button>
            <button
              mat-flat-button
              type="button"
              class="filter-btn"
              [class.active]="foodFilter() === 'all'"
              (click)="setFoodFilter('all')"
            >
              Alle
            </button>
          </div>

          <div class="food-list">
            @for (item of quickFoodItems(); track item.id) {
              <article class="food-row">
                <button mat-flat-button type="button" class="food-open-btn" (click)="openAmountPicker(item, 'queue')">
                  <span class="food-name">{{ item.name }}</span>
                  <small class="food-macros">{{ quickItemMacroLine(item) }}</small>
                </button>
                <div class="food-row-actions">
                  <button mat-icon-button type="button" class="round-icon-btn" (click)="toggleFavoriteFood(item.id)" [attr.aria-label]="isFavoriteFood(item.id) ? 'Favorit entfernen' : 'Als Favorit speichern'">
                    <lucide-icon [img]="icons.star" [class.is-favorite]="isFavoriteFood(item.id)" aria-hidden="true"></lucide-icon>
                  </button>
                  <button mat-icon-button type="button" class="round-icon-btn primary" (click)="addDefaultToQueue(item)" aria-label="Zur Log-Liste hinzufügen">
                    <lucide-icon [img]="icons.plus" aria-hidden="true"></lucide-icon>
                  </button>
                </div>
              </article>
            }
            @if (quickFoodItems().length === 0) {
              <p class="muted">Keine Treffer für deinen Filter.</p>
            }
          </div>

          <div class="queue-list">
            @if (foodQueueCount() > 0) {
              <div class="queue-head-row">
                <p class="queue-head">Log-Liste ({{ foodQueueCount() }})</p>
                <button mat-flat-button type="button" class="day-chip queue-clear-btn" (click)="clearFoodQueue()">Leeren</button>
              </div>
            }
            @for (item of foodQueue(); track item.id) {
              <article class="queue-item">
                <div class="queue-main">
                  <strong>{{ item.name }}</strong>
                  <small>{{ mealSlotLabel(item.mealSlot) }}</small>
                  <small>P {{ item.totals.protein.toFixed(1) }} · KH {{ item.totals.carbs.toFixed(1) }} · F {{ item.totals.fat.toFixed(1) }} · {{ item.totals.kcal.toFixed(0) }} kcal</small>
                </div>
                <div class="queue-controls">
                  <mat-form-field class="m3-field queue-amount-field" appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ queueUnitLabel(item) }}</mat-label>
                    <input matInput type="number" min="0.1" step="0.1" [ngModel]="item.amount" (ngModelChange)="onQueueAmountChange(item.id, $event)">
                  </mat-form-field>
                  <button mat-icon-button type="button" class="round-icon-btn" (click)="removeFoodQueueItem(item.id)" aria-label="Aus Log-Liste entfernen">
                    <lucide-icon [img]="icons.trash" aria-hidden="true"></lucide-icon>
                  </button>
                </div>
              </article>
            }

            @if (foodQueueCount() === 0) {
              <p class="muted">Suche ein Lebensmittel und tippe auf +, um es zur Log-Liste hinzuzufügen.</p>
            }
          </div>

          @if (foodQueueCount() > 0) {
            <div class="food-footer">
              <div class="queue-total">
                <small>P {{ queueTotals().protein.toFixed(0) }} · KH {{ queueTotals().carbs.toFixed(0) }} · F {{ queueTotals().fat.toFixed(0) }}</small>
                <strong>{{ queueTotals().kcal.toFixed(0) }} kcal</strong>
              </div>
              <button mat-flat-button type="button" class="menu-btn apply-log-btn" (click)="applyFoodQueue()">
                Loggen ({{ foodQueueCount() }})
              </button>
            </div>
          }
        </section>
      }

      @if (sheetMode() === 'copy') {
        <section class="copy-sheet">
          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Quelldatum</mat-label>
            <input matInput type="date" [ngModel]="copySourceDay()" (ngModelChange)="onCopySourceDayChange($event)">
          </mat-form-field>

          @if (loadingCopySourceEntries()) {
            <p class="muted">Einträge werden geladen …</p>
          } @else if (copySourceEntries().length > 0) {
            <div class="selection-list">
              @for (entry of copySourceEntries(); track entry.id) {
                <label class="selection-row">
                  <input
                    type="checkbox"
                    [checked]="copySelectedEntryIds().includes(entry.id)"
                    (change)="toggleCopyEntrySelection(entry.id)"
                  >
                  <span class="selection-copy">
                    <strong>{{ entryName(entry) }}</strong>
                    <small>{{ entry.quantity }}{{ entry.entry_type === 'ingredient' ? 'g' : ' Portionen' }} · {{ entryMacroSummary(entry) }}</small>
                  </span>
                </label>
              }
            </div>
          } @else {
            <p class="muted">An diesem Tag gibt es keine Einträge zum Übernehmen.</p>
          }

          <button mat-flat-button type="button" class="menu-btn apply-log-btn" [disabled]="copySelectedEntryIds().length === 0" (click)="applyCopiedEntries()">
            In {{ today() }} übernehmen
          </button>
        </section>
      }

      @if (sheetMode() === 'mealprep') {
        <section class="mealprep-sheet">
          <div class="grid-two">
            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Von</mat-label>
              <input matInput type="date" [ngModel]="mealPrepStartDay()" (ngModelChange)="mealPrepStartDay.set($event)">
            </mat-form-field>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Bis</mat-label>
              <input matInput type="date" [ngModel]="mealPrepEndDay()" (ngModelChange)="mealPrepEndDay.set($event)">
            </mat-form-field>
          </div>

          <p class="range-copy">Aufteilen in {{ mealPrepRangeCount() }} Tage ({{ mealPrepStartDay() }} - {{ mealPrepEndDay() }})</p>
          <p class="warning-copy">Aufgeteilte Einträge können nicht wieder zusammengeführt werden.</p>

          @if (todayEntries().length > 0) {
            <div class="selection-list">
              @for (entry of todayEntries(); track entry.id) {
                <label class="selection-row">
                  <input
                    type="checkbox"
                    [checked]="mealPrepSelectedEntryIds().includes(entry.id)"
                    (change)="toggleMealPrepEntrySelection(entry.id)"
                  >
                  <span class="selection-copy">
                    <strong>{{ entryName(entry) }}</strong>
                    <small>{{ entry.quantity }}{{ entry.entry_type === 'ingredient' ? 'g' : ' Portionen' }} · {{ entryMacroSummary(entry) }}</small>
                  </span>
                </label>
              }
            </div>
          } @else {
            <p class="muted">Am aktuell gewählten Tag gibt es keine Einträge zum Aufteilen.</p>
          }

          <button mat-flat-button type="button" class="menu-btn apply-log-btn" [disabled]="mealPrepSelectedEntryIds().length === 0 || mealPrepRangeCount() <= 0" (click)="applyMealPrepDistribution()">
            Aufteilen
          </button>
        </section>
      }

      @if (sheetMode() === 'weight') {
        <section class="weight-sheet">
          <div class="weight-actions">
            <button mat-flat-button type="button" class="day-chip" (click)="setWeightDateToToday()">Heute</button>
            <button mat-flat-button type="button" class="day-chip" (click)="setSheetMode('menu')">Anderes loggen</button>
          </div>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Datum</mat-label>
            <input matInput id="weight-day-input" type="date" [attr.max]="realToday" [(ngModel)]="weightDateInput">
          </mat-form-field>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Gewicht (kg)</mat-label>
            <input matInput id="weight-input" type="number" min="20" step="0.1" [(ngModel)]="weightInput">
          </mat-form-field>

          <button mat-flat-button type="button" class="menu-btn apply-log-btn" (click)="saveWeight()">Gewicht speichern</button>
        </section>
      }

      @if (sheetMode() === 'steps') {
        <section class="weight-sheet">
          <div class="weight-actions">
            <button mat-flat-button type="button" class="day-chip" (click)="setStepsDateToToday()">Heute</button>
            <button mat-flat-button type="button" class="day-chip" (click)="setSheetMode('menu')">Anderes loggen</button>
          </div>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Datum</mat-label>
            <input matInput id="steps-day-input" type="date" [(ngModel)]="stepsDateInput">
          </mat-form-field>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Schritte</mat-label>
            <input matInput id="steps-input" type="number" min="0" step="1" [(ngModel)]="stepsInput">
          </mat-form-field>

          <button mat-flat-button type="button" class="menu-btn apply-log-btn" (click)="saveSteps()">Schritte speichern</button>
        </section>
      }

      @if (sheetMode() === 'gym') {
        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Notiz (optional)</mat-label>
          <textarea matInput id="gym-note-input" rows="3" [(ngModel)]="gymNote" placeholder="Was lief heute gut?"></textarea>
        </mat-form-field>

        <p class="file-label">Foto (optional)</p>
        <div class="file-row">
          <button mat-flat-button type="button" class="menu-btn compact" (click)="pickGymPhoto()">Foto auswählen</button>
          <span class="file-name">{{ gymPhotoName() || 'Kein Foto ausgewählt' }}</span>
        </div>
        <input #gymPhotoInput id="gym-photo-input" class="sr-only" type="file" accept="image/*" (change)="onGymPhotoSelected($event)">

        <button mat-flat-button type="button" class="menu-btn" [disabled]="savingGymPost()" (click)="submitGymPost()">
          {{ savingGymPost() ? 'Wird geteilt …' : 'Gym-Check-in teilen' }}
        </button>
      }

      @if (sheetMode() === 'entry') {
        @if (selectedEntryForActions()) {
          <article class="entry-action-card">
            <p class="entry-action-title">{{ entryName(selectedEntryForActions()!) }}</p>
            <p class="entry-action-sub">{{ selectedEntryForActions()!.quantity }}{{ selectedEntryForActions()!.entry_type === 'ingredient' ? 'g' : ' Portionen' }} • {{ selectedEntryForActions()!.kcal.toFixed(0) }} kcal</p>
          </article>
          <div class="action-list">
            <button mat-flat-button type="button" class="menu-btn" (click)="editSelectedEntry()">Bearbeiten</button>
            <button mat-flat-button type="button" class="menu-btn danger-outline" (click)="deleteSelectedEntry()">Löschen</button>
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
      color: var(--m3-sys-color-on-surface);
      gap: var(--layout-gap);
    }

    .hero,
    .section {
      display: grid;
      gap: var(--space-3);
    }

    .date-label {
      margin: 0;
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 600;
    }

    .today-toolbar {
      display: grid;
      gap: 10px;
    }

    .day-nav {
      display: grid;
      grid-template-columns: var(--touch-target) 1fr var(--touch-target);
      gap: 8px;
      align-items: center;
    }

    .nav-btn {
      min-height: var(--touch-target);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
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
      min-height: var(--touch-target);
      border-radius: 18px;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }

    .today-quick-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .protein-share-btn {
      width: 100%;
      justify-content: center;
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
      padding-top: 10px;
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
      border-radius: 20px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 12px;
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
      gap: 10px;
    }

    .weight-entry {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 20px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 12px;
    }

    .entry-card {
      display: grid;
      gap: 10px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 20px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 14px;
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
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-secondary-container);
      color: var(--m3-sys-color-on-surface);
      font-size: 14px;
      font-weight: 600;
      padding: 0 16px;
    }

    .action-list {
      display: grid;
      gap: 8px;
    }

    .quick-add-menu {
      display: grid;
      gap: 14px;
      padding-bottom: max(8px, env(safe-area-inset-bottom));
    }

    .quick-add-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .quick-add-tile {
      min-height: 154px;
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 70%, transparent);
      border-radius: 24px;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--m3-sys-color-surface-container-high) 90%, transparent), var(--m3-sys-color-surface-container));
      color: var(--m3-sys-color-on-surface);
      display: grid;
      align-content: start;
      gap: 14px;
      padding: 18px;
      text-align: left;
      box-shadow: none;
    }

    .quick-add-icon {
      width: 48px;
      height: 48px;
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container-highest);
      display: grid;
      place-items: center;
      color: var(--m3-sys-color-on-surface-variant);
    }

    .quick-add-icon.food,
    .quick-add-icon.gym {
      color: var(--m3-sys-color-primary);
    }

    .quick-add-copy {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .quick-add-kicker {
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .quick-add-copy strong {
      font-size: 18px;
      line-height: 1.15;
      letter-spacing: -0.04em;
    }

    .quick-add-secondary {
      display: flex;
      justify-content: center;
    }

    .recent-activities-btn {
      width: auto;
      padding-inline: 18px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .food-sheet {
      display: grid;
      gap: 12px;
      padding-bottom: max(8px, env(safe-area-inset-bottom));
    }

    .food-hub {
      gap: 14px;
    }

    .food-hub-actions {
      display: grid;
      gap: 10px;
    }

    .food-hub-card {
      min-height: 108px;
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 70%, transparent);
      border-radius: 22px;
      background: var(--m3-sys-color-surface-container-low);
      color: var(--m3-sys-color-on-surface);
      padding: 14px 16px;
      text-align: left;
      display: grid;
      gap: 6px;
      box-shadow: none;
    }

    .food-hub-card-accent {
      border-color: color-mix(in srgb, var(--m3-sys-color-primary) 22%, var(--m3-sys-color-outline-variant));
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--m3-sys-color-primary) 10%, var(--m3-sys-color-surface-container-high)), var(--m3-sys-color-surface-container-low));
    }

    .food-hub-card-kicker,
    .sheet-kicker {
      margin: 0;
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .food-hub-card strong {
      font-size: 16px;
      line-height: 1.2;
    }

    .food-hub-card small,
    .sheet-caption {
      margin: 0;
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.45;
    }

    .sheet-subhead {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 10px;
    }

    .hub-food-list {
      max-height: none;
    }

    .copy-sheet,
    .mealprep-sheet {
      display: grid;
      gap: 12px;
      padding-bottom: max(8px, env(safe-area-inset-bottom));
    }

    .utility-row,
    .grid-two {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .day-chip {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface);
      font-size: 12px;
      font-weight: 600;
      width: 100%;
      justify-content: center;
    }

    .slot-row {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
      scrollbar-width: thin;
    }

    .slot-chip {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 700;
      padding: 0 12px;
      white-space: nowrap;
      justify-content: center;
    }

    .slot-chip.active {
      background: var(--m3-sys-color-secondary-container);
      color: var(--m3-sys-color-on-secondary-container);
      border-color: transparent;
    }

    .food-search-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .builder-macro-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .builder-macro-card {
      display: grid;
      gap: 4px;
      min-height: 88px;
      padding: 14px 16px;
      border-radius: 20px;
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 70%, transparent);
      background: var(--m3-sys-color-surface-container-low);
    }

    .builder-macro-card span {
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .builder-macro-card strong {
      color: var(--m3-sys-color-on-surface);
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.05em;
    }

    .builder-macro-card-accent {
      border-color: transparent;
      background: color-mix(in srgb, var(--m3-sys-color-primary-container) 72%, var(--m3-sys-color-surface-container-low));
    }

    .favorite-row {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
      scrollbar-width: thin;
      padding-top: 2px;
    }

    .favorite-chip {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface);
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      padding: 0 12px;
    }

    .filter-toggle {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }

    .compact-filter {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .filter-btn {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 600;
      justify-content: center;
      width: 100%;
    }

    .filter-btn.active {
      background: var(--m3-sys-color-secondary-container);
      color: var(--m3-sys-color-on-secondary-container);
      border-color: transparent;
    }

    .food-list {
      display: grid;
      gap: 8px;
      max-height: clamp(160px, 34vh, 320px);
      max-height: clamp(160px, 34dvh, 320px);
      overflow: auto;
      padding-right: 2px;
    }

    .food-row {
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container-low);
      padding: 8px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
      transition:
        transform var(--motion-duration-short) var(--motion-easing-standard),
        border-color var(--motion-duration-short) var(--motion-easing-standard);
    }

    .food-row:active {
      transform: translateY(1px);
    }

    .food-open-btn {
      min-height: var(--touch-target-compact);
      border: none;
      border-radius: 12px;
      background: transparent !important;
      text-align: left;
      padding: 4px;
      display: grid;
      gap: 2px;
      align-content: center;
      color: inherit;
      box-shadow: none;
    }

    .food-row-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 4px;
    }

    .round-icon-btn {
      width: 44px;
      height: 44px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container);
      color: var(--m3-sys-color-on-surface-variant);
      display: grid;
      place-items: center;
      line-height: 1;
      padding: 0;
    }

    .round-icon-btn lucide-icon {
      width: 18px;
      height: 18px;
    }

    .round-icon-btn.primary {
      background: var(--m3-sys-color-primary-container);
      color: var(--m3-sys-color-on-primary-container);
      border-color: transparent;
    }

    .round-icon-btn lucide-icon.is-favorite {
      color: var(--m3-sys-color-primary);
      fill: var(--m3-sys-color-primary);
    }

    .menu-btn {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 14px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface);
      font-size: 14px;
      font-weight: 600;
      text-align: left;
      padding: 6px 10px;
      display: grid;
      gap: 2px;
      align-content: center;
    }

    .action-list .menu-btn {
      min-height: var(--touch-target-compact);
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
    }

    .action-list .menu-btn .icon {
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
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
      min-height: var(--touch-target-compact);
      padding: 0 12px;
      width: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
    }

    .weight-sheet {
      display: grid;
      gap: 10px;
    }

    .selection-list {
      display: grid;
      gap: 8px;
      max-height: clamp(180px, 34dvh, 320px);
      overflow: auto;
      padding-right: 2px;
    }

    .selection-row {
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container-low);
      padding: 10px 12px;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      align-items: start;
    }

    .selection-row input {
      width: 18px;
      height: 18px;
      margin: 2px 0 0;
      accent-color: var(--m3-sys-color-primary);
    }

    .selection-copy {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .selection-copy strong,
    .selection-copy small {
      display: block;
    }

    .selection-copy strong {
      color: var(--m3-sys-color-on-surface);
      font-size: 14px;
      font-weight: 700;
    }

    .selection-copy small,
    .range-copy,
    .warning-copy {
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 600;
    }

    .range-copy,
    .warning-copy {
      margin: 0;
    }

    .warning-copy {
      color: color-mix(in srgb, var(--warning-500) 88%, var(--m3-sys-color-on-surface));
    }

    .weight-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
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
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container-high);
      padding: 12px;
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
      font-size: 15px;
      color: var(--m3-sys-color-on-surface);
      font-weight: 600;
      line-height: 1.25;
    }

    .food-macros {
      display: block;
      font-size: 12px;
      color: color-mix(in srgb, var(--m3-sys-color-on-surface-variant) 92%, transparent);
      font-weight: 600;
      line-height: 1.25;
      white-space: normal;
      opacity: 1;
    }

    .queue-list {
      display: grid;
      gap: 8px;
    }

    .queue-preview-card {
      border: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 70%, transparent);
      border-radius: 22px;
      background: var(--m3-sys-color-surface-container-low);
      padding: 14px 16px;
      display: grid;
      gap: 12px;
    }

    .queue-preview-card strong {
      color: var(--m3-sys-color-on-surface);
      font-size: 16px;
      line-height: 1.2;
    }

    .queue-preview-card small {
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 600;
    }

    .queue-preview-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .queue-head {
      margin: 0;
      color: var(--m3-sys-color-on-surface);
      font-size: 13px;
      font-weight: 700;
    }

    .queue-head-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .queue-clear-btn {
      width: auto;
      padding-inline: 12px;
    }

    .queue-item {
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container-low);
      padding: 8px;
      display: grid;
      gap: 8px;
      transition:
        transform var(--motion-duration-short) var(--motion-easing-standard),
        border-color var(--motion-duration-short) var(--motion-easing-standard);
    }

    .queue-item:active {
      transform: translateY(1px);
    }

    .queue-main {
      display: grid;
      gap: 2px;
    }

    .queue-main strong {
      color: var(--m3-sys-color-on-surface);
      font-size: 14px;
      font-weight: 700;
    }

    .queue-main small {
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 600;
    }

    .queue-controls {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 8px;
    }

    .queue-amount-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .food-footer {
      position: sticky;
      bottom: 0;
      z-index: 1;
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--m3-sys-color-surface-container) 5%, transparent) 0%,
        var(--m3-sys-color-surface-container) 36%
      );
      backdrop-filter: blur(8px);
      padding-top: 10px;
      border-top: 1px solid color-mix(in srgb, var(--m3-sys-color-outline-variant) 65%, transparent);
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
    }

    .queue-total {
      display: grid;
      gap: 2px;
      justify-items: start;
      min-width: 96px;
    }

    .queue-total small {
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 11px;
      font-weight: 600;
    }

    .queue-total strong {
      color: var(--m3-sys-color-on-surface);
      font-size: 13px;
      font-weight: 700;
    }

    .apply-log-btn {
      min-height: var(--touch-target-compact);
      border-radius: 999px;
      white-space: nowrap;
      padding-inline: 16px;
      background: var(--m3-sys-color-primary);
      color: var(--m3-sys-color-on-primary);
      border-color: transparent;
    }

    .apply-log-btn:disabled {
      opacity: 0.5;
    }

    .m3-field {
      margin-bottom: 2px;
    }

    @media (max-width: 440px) {
      .quick-add-grid,
      .builder-macro-grid,
      .filter-toggle {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .compact-filter {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .utility-row,
      .grid-two,
      .queue-preview-actions {
        grid-template-columns: 1fr;
      }

      .sheet-subhead {
        flex-direction: column;
        align-items: stretch;
      }

      .food-footer {
        grid-template-columns: 1fr;
      }

      .queue-total {
        justify-items: start;
      }

      .apply-log-btn {
        width: 100%;
        justify-content: center;
      }
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
    dumbbell: Dumbbell,
    footsteps: Footprints,
    star: Star,
    trash: Trash2
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
  readonly stepLogs = signal<StepLog[]>([]);
  readonly brooPosts = signal<CommunityPost[]>([]);
  readonly brooProfiles = signal<Record<string, CommunityProfileDirectoryEntry>>({});
  readonly brooPhotoSrcMap = signal<Record<string, string>>({});
  readonly profile = signal<Profile | null>(null);
  readonly loading = signal(false);
  readonly loadingBrooBoard = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly showActionSheet = signal(false);
  readonly sheetMode = signal<'menu' | 'food' | 'builder' | 'copy' | 'mealprep' | 'weight' | 'steps' | 'gym' | 'entry'>('menu');
  readonly foodSearch = signal('');
  readonly savingGymPost = signal(false);
  readonly gymPhotoName = signal<string | null>(null);
  readonly selectedEntryForActions = signal<LogEntry | null>(null);
  readonly gymPhotoInput = viewChild<ElementRef<HTMLInputElement>>('gymPhotoInput');

  readonly realToday = this.formatDate(new Date());
  readonly today = signal(this.realToday);
  readonly foodFilter = signal<FoodFilter>('recent');
  readonly selectedMealSlot = signal<MealSlot>('snack');
  readonly foodQueue = signal<FoodQueueItem[]>([]);
  readonly favoriteFoodIds = signal<string[]>([]);
  readonly amountPickerMode = signal<'queue' | 'edit'>('queue');
  readonly returnSheetMode = signal<'food' | 'builder'>('food');
  readonly weightTrendDays = signal<7 | 30>(7);
  readonly activeFoodJourneyId = signal<string | null>(null);
  readonly activeWeightJourneyId = signal<string | null>(null);
  weightDateInput = this.realToday;
  weightInput = 70;
  stepsDateInput = this.realToday;
  stepsInput = 8000;
  gymNote = '';
  private gymPhoto: File | null = null;

  private mealMacros: MealMacroMap = {};
  private readonly dayDataTtlMs = 1000 * 60 * 3;

  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly libraryDataService = inject(LibraryDataService);
  private readonly queryCache = inject(QueryCacheService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly telemetry = inject(InteractionTelemetryService);
  private readonly communityFeed = inject(CommunityFeedService);

  readonly todayLabel = computed(() =>
    this.parseIsoDate(this.today()).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })
  );
  readonly proteinToday = computed(() => Math.round(Number(this.summary()?.protein || 0)));
  readonly fatToday = computed(() => Math.round(Number(this.summary()?.fat || 0)));
  readonly carbsToday = computed(() => Math.round(Number(this.summary()?.carbs || 0)));
  readonly caloriesToday = computed(() => Math.round(Number(this.summary()?.kcal || 0)));
  readonly proteinMilestonePosted = signal(false);
  readonly stepsMilestonePosted = signal(false);

  readonly todayEntries = computed(() => this.entries());
  readonly recentWeightEntries = computed(() => this.weightLogs().slice(0, 7));
  readonly trendWeightEntries = computed(() => this.weightLogs().slice(0, this.weightTrendDays()));
  readonly brooBoardPosts = computed<BrooBoardPost[]>(() =>
    this.brooPosts().map(post => ({
      post,
      displayName: this.brooProfiles()[post.user_id]?.display_name || 'Broo',
      photoUrl: this.brooPhotoSrcMap()[post.id] || null
    }))
  );

  readonly selectedDayWeight = computed(() =>
    this.weightLogs().find(entry => entry.logged_on === this.today()) || null
  );
  readonly selectedDaySteps = computed(() =>
    this.stepLogs().find(entry => entry.logged_on === this.today()) || null
  );
  readonly trackStepsEnabled = computed(() => Boolean(this.profile()?.track_steps));
  readonly stepsGoal = computed(() => Number(this.profile()?.daily_steps_target || 8000));

  readonly previousWeightForDay = computed(() => {
    const day = this.today();
    return this.weightLogs().find(entry => entry.logged_on < day) || null;
  });

  readonly weightSparklinePoints = computed(() => {
    const points = [...this.trendWeightEntries()].reverse();
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

  readonly allFoodItems = computed(() => {
    const recentIds = this.entries().map(entry => entry.ref_id);
    const recentIngredients = this.ingredients().filter(item => recentIds.includes(item.id));
    const recentMeals = this.meals().filter(item => recentIds.includes(item.id));
    const base = [...recentIngredients, ...recentMeals, ...this.ingredients(), ...this.meals()];
    return Array.from(new Map(base.map(item => [item.id, item])).values());
  });

  readonly quickFoodItems = computed(() => {
    const query = this.foodSearch().trim().toLowerCase();
    const requestedFilter = this.foodFilter();
    const favorites = new Set(this.favoriteFoodIds());
    const recentIds = new Set(this.entries().map(entry => entry.ref_id));
    const filter: FoodFilter =
      requestedFilter === 'recent' && recentIds.size === 0
        ? (favorites.size > 0 ? 'favorites' : 'all')
        : requestedFilter;

    return this.allFoodItems()
      .filter(item => {
        if (query && !item.name.toLowerCase().includes(query)) {
          return false;
        }
        if (filter === 'favorites' && !favorites.has(item.id)) {
          return false;
        }
        if (filter === 'recent' && !recentIds.has(item.id)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aFavorite = favorites.has(a.id) ? 1 : 0;
        const bFavorite = favorites.has(b.id) ? 1 : 0;
        if (aFavorite !== bFavorite) {
          return bFavorite - aFavorite;
        }

        const aRecent = recentIds.has(a.id) ? 1 : 0;
        const bRecent = recentIds.has(b.id) ? 1 : 0;
        if (aRecent !== bRecent) {
          return bRecent - aRecent;
        }

        return a.name.localeCompare(b.name, 'de-DE');
      })
      .slice(0, 24);
  });

  readonly favoriteQuickItems = computed(() => {
    const favorites = new Set(this.favoriteFoodIds());
    return this.allFoodItems().filter(item => favorites.has(item.id)).slice(0, 8);
  });

  readonly foodHubItems = computed(() => this.quickFoodItems().slice(0, 6));

  readonly queueTotals = computed<MacroTotals>(() => {
    return this.foodQueue().reduce<MacroTotals>(
      (acc, item) => ({
        kcal: acc.kcal + item.totals.kcal,
        protein: acc.protein + item.totals.protein,
        carbs: acc.carbs + item.totals.carbs,
        fat: acc.fat + item.totals.fat
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
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
  readonly canGoNextDay = computed(() => true);
  readonly foodQueueCount = computed(() => this.foodQueue().length);
  readonly canShareProteinMilestone = computed(() =>
    this.proteinToday() >= this.proteinGoal && !this.proteinMilestonePosted()
  );
  readonly canShareStepsMilestone = computed(() =>
    this.trackStepsEnabled()
    && Number(this.selectedDaySteps()?.steps || 0) >= this.stepsGoal()
    && !this.stepsMilestonePosted()
  );
  readonly copySourceDay = signal(this.realToday);
  readonly copySourceEntries = signal<LogEntry[]>([]);
  readonly copySelectedEntryIds = signal<string[]>([]);
  readonly loadingCopySourceEntries = signal(false);
  readonly mealPrepStartDay = signal(this.realToday);
  readonly mealPrepEndDay = signal(this.realToday);
  readonly mealPrepSelectedEntryIds = signal<string[]>([]);
  readonly selectedMealPrepEntries = computed(() =>
    this.todayEntries().filter(entry => this.mealPrepSelectedEntryIds().includes(entry.id))
  );
  readonly mealPrepRangeCount = computed(() => {
    const start = this.normalizeDateInput(this.mealPrepStartDay());
    const end = this.normalizeDateInput(this.mealPrepEndDay());
    if (!start || !end) {
      return 0;
    }
    const diff = this.compareIsoDays(start, end);
    if (diff > 0) {
      return 0;
    }
    const startDate = this.parseIsoDate(start);
    const endDate = this.parseIsoDate(end);
    return Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  });

  ngOnInit(): void {
    this.favoriteFoodIds.set(this.readFavoriteFoodIds());
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        if (!params.get('quick')) {
          return;
        }
        this.openActions();
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { quick: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      });
    void this.loadInitialData();
  }

  async loadInitialData(forceRefresh = false): Promise<void> {
    await this.ensureLibraryLoaded();
    await Promise.all([
      this.loadTodaySnapshot(forceRefresh),
      this.loadBrooBoard()
    ]);
  }

  async loadTodaySnapshot(forceRefresh = false): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
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
      this.profile.set(dayResult.value.profile);
      this.weightLogs.set(dayResult.value.weightLogs);
      this.stepLogs.set(dayResult.value.stepLogs);
      this.gymDaysThisWeek.set(new Set(dayResult.value.gymDaysThisWeek));
      this.proteinDaysThisWeek.set(new Set(dayResult.value.proteinDaysThisWeek));
      this.proteinMilestonePosted.set(dayResult.value.proteinMilestonePosted);
      this.stepsMilestonePosted.set(dayResult.value.stepsMilestonePosted);

      const selectedWeight = this.weightLogs().find(entry => entry.logged_on === day);
      this.weightInput = Number(selectedWeight?.weight_kg || this.weightInput);
      this.weightDateInput = day;
      const selectedSteps = this.stepLogs().find(entry => entry.logged_on === day);
      this.stepsInput = Number(selectedSteps?.steps || this.stepsGoal());
      this.stepsDateInput = day;
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Heute-Daten konnten nicht geladen werden'));
    } finally {
      this.loading.set(false);
    }
  }

  goPreviousDay(): void {
    const date = this.parseIsoDate(this.today());
    date.setDate(date.getDate() - 1);
    this.today.set(this.formatDate(date));
    void this.loadTodaySnapshot();
  }

  goNextDay(): void {
    const current = this.parseIsoDate(this.today());
    current.setDate(current.getDate() + 1);
    this.today.set(this.formatDate(current));
    void this.loadTodaySnapshot();
  }

  onDayPicked(value: string): void {
    const normalized = this.normalizeDateInput(value);
    if (!normalized) {
      return;
    }
    this.today.set(normalized);
    void this.loadTodaySnapshot();
  }

  jumpToToday(): void {
    if (this.today() === this.realToday) {
      return;
    }
    this.today.set(this.realToday);
    void this.loadTodaySnapshot();
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

  stepsValueLabel(): string {
    const selected = this.selectedDaySteps();
    if (!selected) {
      return '--';
    }
    return selected.steps.toLocaleString('de-CH');
  }

  stepsGoalLabel(): string {
    return `${this.stepsGoal().toLocaleString('de-CH')} Ziel`;
  }

  weeklyTrendLabel(): string {
    const logs = this.trendWeightEntries();
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

  openStepsQuickLog(): void {
    this.showActionSheet.set(true);
    this.setSheetMode('steps');
  }

  openActions(): void {
    this.showActionSheet.set(true);
    this.setSheetMode('menu');
  }

  openFoodQuickLog(): void {
    this.showActionSheet.set(true);
    this.foodSearch.set('');
    this.foodFilter.set('recent');
    this.setSheetMode('food');
  }

  openGymCheckInComposer(): void {
    this.showActionSheet.set(true);
    this.setSheetMode('gym');
  }

  openRecentActivities(): void {
    this.showActionSheet.set(true);
    this.foodSearch.set('');
    this.foodFilter.set('recent');
    this.setSheetMode('food');
  }

  closeActions(): void {
    const mode = this.sheetMode();
    if (mode === 'food' || mode === 'builder') {
      this.cancelFoodJourney('sheet_closed');
    } else if (mode === 'weight') {
      this.cancelWeightJourney('sheet_closed');
    }

    this.showActionSheet.set(false);
    this.sheetMode.set('menu');
    this.foodSearch.set('');
    this.selectedEntryForActions.set(null);
    this.copySelectedEntryIds.set([]);
    this.copySourceEntries.set([]);
    this.mealPrepSelectedEntryIds.set([]);
    this.gymNote = '';
    this.gymPhoto = null;
    this.gymPhotoName.set(null);
    const photoInput = this.gymPhotoInput()?.nativeElement;
    if (photoInput) {
      photoInput.value = '';
    }
  }

  setSheetMode(mode: 'menu' | 'food' | 'builder' | 'copy' | 'mealprep' | 'weight' | 'steps' | 'gym' | 'entry'): void {
    const currentMode = this.sheetMode();
    const leavingFood = currentMode === 'food' || currentMode === 'builder';
    const enteringFood = mode === 'food' || mode === 'builder';
    if (leavingFood && !enteringFood) {
      this.cancelFoodJourney('mode_switch');
    }
    if (currentMode === 'weight' && mode !== 'weight') {
      this.cancelWeightJourney('mode_switch');
    }

    this.sheetMode.set(mode);
    if (enteringFood) {
      this.startFoodJourney('sheet_mode');
      if (this.foodQueueCount() === 0) {
        this.selectedMealSlot.set('snack');
      }
      if (mode === 'food') {
        this.foodSearch.set('');
        this.foodFilter.set('recent');
      }
    }
    if (mode === 'copy') {
      const defaultSourceDay = this.shiftIsoDay(this.today(), -1);
      this.copySourceDay.set(defaultSourceDay);
      this.copySelectedEntryIds.set([]);
      void this.loadCopySourceEntries(defaultSourceDay);
    }
    if (mode === 'mealprep') {
      this.mealPrepSelectedEntryIds.set(this.todayEntries().map(entry => entry.id));
      this.mealPrepStartDay.set(this.today());
      this.mealPrepEndDay.set(this.shiftIsoDay(this.today(), 2));
    }
    if (mode === 'weight') {
      this.startWeightJourney('sheet_mode');
      this.weightDateInput = this.today();
      const selected = this.weightLogs().find(entry => entry.logged_on === this.today());
      if (selected) {
        this.weightInput = Number(selected.weight_kg);
      }
    }
    if (mode === 'steps') {
      this.stepsDateInput = this.today();
      const selected = this.stepLogs().find(entry => entry.logged_on === this.today());
      this.stepsInput = Number(selected?.steps || this.stepsGoal());
    }
  }

  sheetTitle(): string {
    if (this.sheetMode() === 'food') return 'Essen loggen';
    if (this.sheetMode() === 'builder') return 'Meal Builder';
    if (this.sheetMode() === 'copy') return 'Von anderem Tag übernehmen';
    if (this.sheetMode() === 'mealprep') return 'Meal Prep aufteilen';
    if (this.sheetMode() === 'weight') return 'Gewicht eintragen';
    if (this.sheetMode() === 'steps') return 'Schritte eintragen';
    if (this.sheetMode() === 'gym') return 'Gym-Check-in teilen';
    if (this.sheetMode() === 'entry') return 'Eintrag verwalten';
    return 'Schnelllog wählen';
  }

  isIngredient(item: QuickItem): item is Ingredient {
    return 'kcal_per_100' in item;
  }

  openAmountPicker(item: QuickItem, mode: 'queue' | 'edit' = 'queue'): void {
    this.amountPickerMode.set(mode);
    if (mode === 'queue') {
      this.editingEntryId.set(null);
      this.returnSheetMode.set(this.sheetMode() === 'builder' ? 'builder' : 'food');
    }
    this.selectedItemInitialAmount.set(this.isIngredient(item) ? 100 : 1);
    this.selectedItem.set(item);
    this.showActionSheet.set(false);
  }

  quickItemMacroLine(item: QuickItem): string {
    const macros = this.itemMacros(item);
    const unit = this.isIngredient(item) ? '100g' : 'Portion';
    return `${macros.kcal.toFixed(0)} kcal · P ${macros.protein.toFixed(1)} · KH ${macros.carbs.toFixed(1)} · F ${macros.fat.toFixed(1)} / ${unit}`;
  }

  setFoodFilter(filter: FoodFilter): void {
    this.foodFilter.set(filter);
  }

  onFoodSearchInput(value: string): void {
    this.foodSearch.set(value);
    this.foodFilter.set(value.trim().length > 0 ? 'all' : 'recent');
  }

  openFoodBuilder(filter: FoodFilter = this.foodFilter()): void {
    this.foodFilter.set(filter);
    this.setSheetMode('builder');
  }

  setWeightTrendDays(days: 7 | 30): void {
    this.weightTrendDays.set(days);
  }

  setMealSlot(slot: MealSlot): void {
    this.selectedMealSlot.set(slot);
  }

  mealSlotLabel(slot: MealSlot): string {
    if (slot === 'breakfast') return 'Frühstück';
    if (slot === 'lunch') return 'Mittag';
    if (slot === 'dinner') return 'Abendessen';
    if (slot === 'snack') return 'Snack';
    return 'Sonstiges';
  }

  isFavoriteFood(itemId: string): boolean {
    return this.favoriteFoodIds().includes(itemId);
  }

  toggleFavoriteFood(itemId: string): void {
    this.favoriteFoodIds.update(current => {
      const next = current.includes(itemId)
        ? current.filter(id => id !== itemId)
        : [...current, itemId];
      this.writeFavoriteFoodIds(next);
      return next;
    });
  }

  addDefaultToQueue(item: QuickItem): void {
    const amount = this.isIngredient(item) ? 100 : 1;
    this.addToFoodQueue(item, amount, this.scaledMacros(item, amount), this.selectedMealSlot());
  }

  removeFoodQueueItem(queueId: string): void {
    this.foodQueue.update(current => current.filter(item => item.id !== queueId));
  }

  clearFoodQueue(): void {
    this.foodQueue.set([]);
  }

  onQueueAmountChange(queueId: string, value: string | number): void {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    this.foodQueue.update(current =>
      current.map(item => {
        if (item.id !== queueId) {
          return item;
        }

        const source = this.allFoodItems().find(entry => entry.id === item.itemId);
        if (!source) {
          return item;
        }

        return {
          ...item,
          amount,
          totals: this.scaledMacros(source, amount)
        };
      })
    );
  }

  queueUnitLabel(item: FoodQueueItem): string {
    return item.itemType === 'ingredient' ? 'g' : 'x';
  }

  async applyFoodQueue(): Promise<void> {
    const user = this.authService.user();
    const queue = this.foodQueue();
    if (!user || queue.length === 0) {
      return;
    }

    const targetDay = this.today();
    const payload = queue.map((item, index) => ({
      owner_id: user.id,
      group_id: null as string | null,
      day: targetDay,
      entry_type: item.itemType,
      ref_id: item.itemId,
      quantity: Number(item.amount.toFixed(2)),
      kcal: Number(item.totals.kcal.toFixed(2)),
      protein: Number(item.totals.protein.toFixed(2)),
      carbs: Number(item.totals.carbs.toFixed(2)),
      fat: Number(item.totals.fat.toFixed(2)),
      created_at: this.buildFoodLogTimestamp(targetDay, index * 5)
    }));

    const { error } = await this.supabaseService.client.from('log_entries').insert(payload);
    if (error) {
      this.failFoodJourney('apply_queue_error');
      this.errorMessage.set(this.formatWriteError(error));
      return;
    }

    this.successMessage.set(`${queue.length} Einträge für ${targetDay} geloggt.`);
    this.completeFoodJourney('apply_queue', { queue_count: queue.length });
    this.foodQueue.set([]);
    this.invalidateFoodCaches(user.id, [targetDay]);
    await this.loadTodaySnapshot(true);
  }

  async shareProteinMilestone(): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }
    if (this.proteinToday() < this.proteinGoal || this.proteinMilestonePosted()) {
      return;
    }

    try {
      await this.communityFeed.ensureProteinMilestonePost(user.id, this.today(), this.summary());
      this.proteinMilestonePosted.set(true);
      this.successMessage.set('Protein-Ziel im Board geteilt.');
      await this.loadBrooBoard();
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Protein-Ziel konnte nicht geteilt werden'));
    }
  }

  async shareStepsMilestone(): Promise<void> {
    const user = this.authService.user();
    const steps = Number(this.selectedDaySteps()?.steps || 0);
    if (!user || !this.trackStepsEnabled()) {
      return;
    }
    if (steps < this.stepsGoal() || this.stepsMilestonePosted()) {
      return;
    }

    try {
      await this.communityFeed.createStepsMilestonePost(user.id, this.today(), steps, this.stepsGoal());
      this.stepsMilestonePosted.set(true);
      this.successMessage.set('Schrittziel im Board geteilt.');
      await this.loadBrooBoard();
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Schrittziel konnte nicht geteilt werden'));
    }
  }

  async onCopySourceDayChange(value: string): Promise<void> {
    const normalized = this.normalizeDateInput(value);
    if (!normalized) {
      return;
    }
    this.copySourceDay.set(normalized);
    this.copySelectedEntryIds.set([]);
    await this.loadCopySourceEntries(normalized);
  }

  toggleCopyEntrySelection(entryId: string): void {
    this.copySelectedEntryIds.update(current =>
      current.includes(entryId) ? current.filter(id => id !== entryId) : [...current, entryId]
    );
  }

  async applyCopiedEntries(): Promise<void> {
    const user = this.authService.user();
    const targetDay = this.today();
    const sourceDay = this.copySourceDay();
    const selectedEntries = this.copySourceEntries().filter(entry => this.copySelectedEntryIds().includes(entry.id));

    if (!user || selectedEntries.length === 0) {
      this.errorMessage.set('Wähle mindestens einen Eintrag zum Übernehmen.');
      return;
    }
    if (sourceDay === targetDay) {
      this.errorMessage.set('Quelle und Ziel müssen unterschiedlich sein.');
      return;
    }

    const payload = selectedEntries.map((entry, index) =>
      this.buildCopiedEntryPayload(entry, user.id, targetDay, index * 5)
    );

    const { error } = await this.supabaseService.client.from('log_entries').insert(payload);
    if (error) {
      this.errorMessage.set(this.formatWriteError(error));
      return;
    }

    this.successMessage.set(`${selectedEntries.length} Einträge nach ${targetDay} übernommen.`);
    this.closeActions();
    this.invalidateFoodCaches(user.id, [targetDay]);
    await this.loadTodaySnapshot(true);
  }

  toggleMealPrepEntrySelection(entryId: string): void {
    this.mealPrepSelectedEntryIds.update(current =>
      current.includes(entryId) ? current.filter(id => id !== entryId) : [...current, entryId]
    );
  }

  async applyMealPrepDistribution(): Promise<void> {
    const user = this.authService.user();
    const start = this.normalizeDateInput(this.mealPrepStartDay());
    const end = this.normalizeDateInput(this.mealPrepEndDay());
    const selectedEntries = this.selectedMealPrepEntries();
    const dayCount = this.mealPrepRangeCount();

    if (!user || selectedEntries.length === 0) {
      this.errorMessage.set('Wähle mindestens einen Eintrag zum Aufteilen.');
      return;
    }
    if (!start || !end || dayCount <= 0) {
      this.errorMessage.set('Bitte gib einen gültigen Zeitraum an.');
      return;
    }

    const rangeDays = this.getIsoDayRange(start, end);
    const payload = selectedEntries.flatMap((entry, entryIndex) => {
      const quantityParts = this.splitAmount(entry.quantity, dayCount);
      const kcalParts = this.splitAmount(entry.kcal, dayCount);
      const proteinParts = this.splitAmount(entry.protein, dayCount);
      const carbsParts = this.splitAmount(entry.carbs, dayCount);
      const fatParts = this.splitAmount(entry.fat, dayCount);

      return rangeDays.map((day, dayIndex) =>
        this.buildCopiedEntryPayload(
          entry,
          user.id,
          day,
          entryIndex * 60 + dayIndex * 5,
          {
            quantity: quantityParts[dayIndex],
            kcal: kcalParts[dayIndex],
            protein: proteinParts[dayIndex],
            carbs: carbsParts[dayIndex],
            fat: fatParts[dayIndex]
          }
        )
      );
    });

    const { error: insertError } = await this.supabaseService.client.from('log_entries').insert(payload);
    if (insertError) {
      this.errorMessage.set(this.formatWriteError(insertError));
      return;
    }

    const { error: deleteError } = await this.supabaseService.client
      .from('log_entries')
      .delete()
      .in('id', selectedEntries.map(entry => entry.id))
      .eq('owner_id', user.id);

    if (deleteError) {
      this.errorMessage.set('Meal Prep wurde angelegt, aber die Originaleinträge konnten nicht entfernt werden. Bitte kurz prüfen.');
      this.invalidateFoodCaches(user.id, [this.today(), ...rangeDays]);
      await this.loadTodaySnapshot(true);
      return;
    }

    this.successMessage.set(`${selectedEntries.length} Einträge auf ${dayCount} Tage aufgeteilt.`);
    this.closeActions();
    this.invalidateFoodCaches(user.id, [this.today(), ...rangeDays]);
    await this.loadTodaySnapshot(true);
  }

  entryMacroSummary(entry: LogEntry): string {
    return `P ${entry.protein.toFixed(1)} · KH ${entry.carbs.toFixed(1)} · F ${entry.fat.toFixed(1)} · ${entry.kcal.toFixed(0)} kcal`;
  }

  async confirmQuickAdd(result: AmountPickResult): Promise<void> {
    const item = this.selectedItem();
    const user = this.authService.user();
    if (!item || !user) {
      return;
    }

    const editingId = this.editingEntryId();
    const pickerMode = this.amountPickerMode();

    if (!editingId && pickerMode === 'queue') {
      this.addToFoodQueue(item, result.amount, result.totals, this.selectedMealSlot());
      this.successMessage.set(`${item.name} zur Log-Liste hinzugefügt.`);
      this.closeAmountPicker();
      this.sheetMode.set(this.returnSheetMode());
      this.showActionSheet.set(true);
      return;
    }

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
      if (!editingId) {
        this.failFoodJourney('confirm_add_error');
      }
      this.errorMessage.set(this.formatWriteError(error));
      return;
    }

    this.successMessage.set('Eintrag aktualisiert.');
    if (!editingId) {
      this.completeFoodJourney('confirm_add');
    }
    this.closeActions();
    this.closeAmountPicker();
    this.invalidateFoodCaches(user.id, [this.today()]);
    await this.loadTodaySnapshot(true);
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
    this.amountPickerMode.set('edit');
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
    this.invalidateFoodCaches(user.id, [this.today()]);
    await this.loadTodaySnapshot(true);
  }

  async saveWeight(): Promise<void> {
    const user = this.authService.user();
    if (!user || this.weightInput <= 0) {
      this.errorMessage.set('Bitte gib ein gültiges Gewicht ein.');
      return;
    }

    if (!(await this.upsertWeight(user.id, this.weightDateInput, this.weightInput))) {
      return;
    }

    this.successMessage.set('Gewicht gespeichert.');
    this.completeWeightJourney('sheet_save');
    this.closeActions();
    this.invalidateDayCaches(user.id);
    await this.loadTodaySnapshot(true);
  }

  async saveSteps(): Promise<void> {
    const user = this.authService.user();
    const steps = Number(this.stepsInput);
    if (!user || !this.trackStepsEnabled() || !Number.isFinite(steps) || steps < 0) {
      this.errorMessage.set('Bitte gib einen gültigen Schrittstand ein.');
      return;
    }

    const { error } = await this.supabaseService.client
      .from('step_logs')
      .upsert(
        {
          user_id: user.id,
          logged_on: this.stepsDateInput,
          steps: Math.round(steps),
          note: null
        },
        { onConflict: 'user_id,logged_on' }
      );

    if (error) {
      this.errorMessage.set(formatAppError(error, 'Schritte konnten nicht gespeichert werden'));
      return;
    }

    this.successMessage.set('Schritte gespeichert.');
    this.closeActions();
    this.invalidateDayCaches(user.id);
    await this.loadTodaySnapshot(true);
  }

  setWeightDateToToday(): void {
    this.weightDateInput = this.realToday;
  }

  setStepsDateToToday(): void {
    this.stepsDateInput = this.realToday;
  }

  private async upsertWeight(userId: string, day: string, weightKg: number): Promise<boolean> {
    const { error } = await this.supabaseService.client
      .from('weight_logs')
      .upsert(
        {
          user_id: userId,
          logged_on: day,
          weight_kg: Number(weightKg.toFixed(1)),
          note: null
        },
        { onConflict: 'user_id,logged_on' }
      );

    if (error) {
      this.failWeightJourney('persist_error');
      this.errorMessage.set(formatAppError(error, 'Gewicht konnte nicht gespeichert werden'));
      return false;
    }

    return true;
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
      await this.communityFeed.createGymCheckinPost(user.id, this.today(), this.gymNote, this.gymPhoto);

      this.gymNote = '';
      this.gymPhoto = null;
      this.gymPhotoName.set(null);
      this.successMessage.set('Dein Gym-Check-in ist im Board.');
      this.closeActions();
      this.invalidateGymCaches(user.id, this.today());
      await Promise.all([
        this.loadTodaySnapshot(true),
        this.loadBrooBoard()
      ]);
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

  brooPostLabel(post: CommunityPost): string {
    if (post.post_type === 'gym_checkin') {
      return 'Gym-Check-in';
    }
    if (post.post_type === 'protein_milestone') {
      return 'Protein-Ziel erreicht';
    }
    if (post.post_type === 'steps_milestone') {
      return 'Schrittziel erreicht';
    }
    return 'Update aus der Gruppe';
  }

  brooPostSummary(post: CommunityPost): string {
    if (post.post_type === 'gym_checkin') {
      return post.note?.trim() || 'War im Gym und hat die Woche weitergeschoben.';
    }

    if (post.post_type === 'steps_milestone') {
      const stepsSummary = post.summary as { steps?: number; target?: number } | null;
      return `${Number(stepsSummary?.steps || 0).toLocaleString('de-CH')} / ${Number(stepsSummary?.target || 0).toLocaleString('de-CH')} Schritte geschafft.`;
    }

    const summary = post.summary as { protein?: number; foods?: string[] } | null;
    const foods = summary?.foods?.slice(0, 2) || [];
    if (foods.length > 0) {
      return `${Number(summary?.protein || 0).toFixed(0)}g Protein mit ${foods.join(' und ')}.`;
    }

    return `${Number(summary?.protein || 0).toFixed(0)}g Protein heute geschafft.`;
  }

  brooPostDayLabel(day: string): string {
    if (day === this.realToday) {
      return 'Heute';
    }

    const yesterday = this.shiftIsoDay(this.realToday, -1);
    if (day === yesterday) {
      return 'Gestern';
    }

    return this.parseIsoDate(day).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }

  private async loadBrooBoard(): Promise<void> {
    this.loadingBrooBoard.set(true);
    try {
      const page = await this.communityFeed.fetchFeedPage(null, 5, { allowCachedFirstPage: false });
      this.brooPosts.set(page.posts);
      this.brooProfiles.set(page.profiles);
      this.brooPhotoSrcMap.set(page.photoSrcMap);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Die letzten Gruppen-Updates konnten nicht geladen werden'));
    } finally {
      this.loadingBrooBoard.set(false);
    }
  }

  private async ensureLibraryLoaded(): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    if (this.ingredients().length > 0 || this.meals().length > 0) {
      return;
    }

    const library = await this.libraryDataService.loadLibrary(user.id, {
      allowStaleOnError: true
    });

    this.ingredients.set(library.ingredients);
    this.meals.set(library.meals);
    this.mealMacros = library.mealMacros;
  }

  private async loadCopySourceEntries(day: string): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.loadingCopySourceEntries.set(true);
    try {
      this.copySourceEntries.set(await this.fetchLogEntriesForDay(user.id, day));
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Einträge vom gewählten Tag konnten nicht geladen werden'));
      this.copySourceEntries.set([]);
    } finally {
      this.loadingCopySourceEntries.set(false);
    }
  }

  private async fetchLogEntriesForDay(userId: string, day: string): Promise<LogEntry[]> {
    const { data, error } = await this.supabaseService.client
      .from('log_entries')
      .select('id,owner_id,group_id,day,entry_type,ref_id,quantity,kcal,protein,carbs,fat,created_at')
      .eq('owner_id', userId)
      .is('group_id', null)
      .eq('day', day)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as LogEntry[];
  }

  private buildCopiedEntryPayload(
    entry: LogEntry,
    userId: string,
    targetDay: string,
    offsetSeconds = 0,
    overrides?: Partial<Pick<LogEntry, 'quantity' | 'kcal' | 'protein' | 'carbs' | 'fat'>>
  ): Omit<LogEntry, 'id'> {
    return {
      owner_id: userId,
      group_id: null,
      day: targetDay,
      entry_type: entry.entry_type,
      ref_id: entry.ref_id,
      quantity: Number((overrides?.quantity ?? entry.quantity).toFixed(2)),
      kcal: Number((overrides?.kcal ?? entry.kcal).toFixed(2)),
      protein: Number((overrides?.protein ?? entry.protein).toFixed(2)),
      carbs: Number((overrides?.carbs ?? entry.carbs).toFixed(2)),
      fat: Number((overrides?.fat ?? entry.fat).toFixed(2)),
      created_at: this.copyEntryTimestamp(entry, targetDay, offsetSeconds)
    };
  }

  private copyEntryTimestamp(entry: LogEntry, targetDay: string, offsetSeconds = 0): string {
    const parsed = new Date(entry.created_at);
    if (!Number.isNaN(parsed.getTime())) {
      const time = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
      return this.combineDayTimeToIso(targetDay, time, offsetSeconds);
    }
    return this.buildFoodLogTimestamp(targetDay, offsetSeconds);
  }

  private getIsoDayRange(start: string, end: string): string[] {
    const range: string[] = [];
    const cursor = this.parseIsoDate(start);
    const endDate = this.parseIsoDate(end);

    while (cursor.getTime() <= endDate.getTime()) {
      range.push(this.formatDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return range;
  }

  private splitAmount(total: number, parts: number): number[] {
    if (parts <= 1) {
      return [Number(total.toFixed(2))];
    }

    const base = Number((total / parts).toFixed(2));
    const values = Array.from({ length: parts }, () => base);
    const consumed = Number((base * (parts - 1)).toFixed(2));
    values[parts - 1] = Number((total - consumed).toFixed(2));
    return values;
  }

  private addToFoodQueue(
    item: QuickItem,
    amount: number,
    totals: MacroTotals,
    mealSlot: MealSlot
  ): void {
    this.foodQueue.update(current => [
      ...current,
      {
        id: this.makeLocalId(),
        itemId: item.id,
        itemType: this.isIngredient(item) ? 'ingredient' : 'meal',
        name: item.name,
        mealSlot,
        amount,
        totals
      }
    ]);
  }

  private scaledMacros(item: QuickItem, amount: number): MacroTotals {
    const base = this.itemMacros(item);
    const baseAmount = this.isIngredient(item) ? 100 : 1;
    const factor = amount / baseAmount;
    return {
      kcal: Number(base.kcal) * factor,
      protein: Number(base.protein) * factor,
      carbs: Number(base.carbs) * factor,
      fat: Number(base.fat) * factor
    };
  }

  private readFavoriteFoodIds(): string[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const raw = window.localStorage.getItem('today.favoriteFoodIds');
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((value): value is string => typeof value === 'string');
    } catch {
      return [];
    }
  }

  private writeFavoriteFoodIds(ids: string[]): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('today.favoriteFoodIds', JSON.stringify(ids));
  }

  private shiftIsoDay(value: string, delta: number): string {
    const date = this.parseIsoDate(value);
    date.setDate(date.getDate() + delta);
    return this.formatDate(date);
  }

  private makeLocalId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private invalidateDayCaches(userId: string): void {
    this.queryCache.invalidatePrefix(`today:${userId}:`);
    this.queryCache.invalidate(this.getProteinMilestoneCacheKey(userId, this.today()));
    this.queryCache.invalidate(this.getStepsMilestoneCacheKey(userId, this.today()));
  }

  private invalidateFoodCaches(userId: string, days: string[]): void {
    this.invalidateSnapshotWeeksForDays(userId, days);

    for (const day of new Set(days.map(value => this.normalizeDateInput(value)).filter((value): value is string => Boolean(value)))) {
      this.queryCache.invalidate(this.getProteinMilestoneCacheKey(userId, day));
    }
  }

  private invalidateGymCaches(userId: string, day: string): void {
    this.invalidateSnapshotWeeksForDays(userId, [day]);
  }

  private invalidateSnapshotWeeksForDays(userId: string, days: string[]): void {
    const normalizedDays = [...new Set(
      days
        .map(value => this.normalizeDateInput(value))
        .filter((value): value is string => Boolean(value))
    )];

    for (const day of normalizedDays) {
      const weekRange = this.getWeekRangeForDay(day);
      for (const snapshotDay of this.getIsoDayRange(weekRange.start, weekRange.end)) {
        this.queryCache.invalidate(this.getTodayCacheKey(userId, snapshotDay, weekRange.start, weekRange.end));
      }
    }
  }

  private getTodayCacheKey(userId: string, day: string, weekStart: string, weekEnd: string): string {
    return `today:${userId}:${day}:${weekStart}:${weekEnd}`;
  }

  private getProteinMilestoneCacheKey(userId: string, day: string): string {
    return `protein-posted:${userId}:${day}`;
  }

  private getStepsMilestoneCacheKey(userId: string, day: string): string {
    return `steps-posted:${userId}:${day}`;
  }

  private async fetchDaySnapshot(userId: string, day: string, weekStart: string, weekEnd: string): Promise<TodaySnapshot> {
    const [
      { data: entryData, error: entryError },
      { data: summaryData, error: summaryError },
      { data: weightData, error: weightError },
      { data: stepData, error: stepError },
      { data: gymPostsData, error: gymPostsError },
      { data: proteinSummaryData, error: proteinSummaryError },
      { data: proteinPostData, error: proteinPostError },
      { data: stepsPostData, error: stepsPostError },
      { data: profileData, error: profileError }
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
        .from('step_logs')
        .select('id,user_id,logged_on,steps,note,created_at')
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
        .lte('day', weekEnd),
      this.supabaseService.client
        .from('community_posts')
        .select('id')
        .eq('user_id', userId)
        .eq('post_type', 'protein_milestone')
        .eq('day', day)
        .limit(1)
        .maybeSingle(),
      this.supabaseService.client
        .from('community_posts')
        .select('id')
        .eq('user_id', userId)
        .eq('post_type', 'steps_milestone')
        .eq('day', day)
        .limit(1)
        .maybeSingle(),
      this.supabaseService.client
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
    ]);

    if (entryError || summaryError || weightError || stepError || gymPostsError || proteinSummaryError || proteinPostError || stepsPostError || profileError) {
      throw entryError || summaryError || weightError || stepError || gymPostsError || proteinSummaryError || proteinPostError || stepsPostError || profileError;
    }

    return {
      entries: (entryData || []) as LogEntry[],
      summary: (summaryData as DailySummary | null) || null,
      weightLogs: (weightData || []) as WeightLog[],
      stepLogs: (stepData || []) as StepLog[],
      gymDaysThisWeek: (gymPostsData || []).map(row => String(row.day)),
      proteinDaysThisWeek: (proteinSummaryData || [])
        .filter(row => Number(row.protein) >= this.proteinGoal)
        .map(row => String(row.day)),
      proteinMilestonePosted: Boolean(proteinPostData?.id),
      stepsMilestonePosted: Boolean(stepsPostData?.id),
      profile: (profileData as Profile | null) || null
    };
  }

  private getCurrentWeekRange(): { start: string; end: string } {
    return this.getWeekRangeForDay(this.today());
  }

  private getWeekRangeForDay(day: string): { start: string; end: string } {
    const current = this.parseIsoDate(day);
    const weekday = current.getDay();
    const daysSinceMonday = (weekday + 6) % 7;
    const startDate = new Date(current);
    startDate.setDate(current.getDate() - daysSinceMonday);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return {
      start: this.formatDate(startDate),
      end: this.formatDate(endDate)
    };
  }

  private getCurrentWeekDayIndex(): number {
    const now = this.parseIsoDate(this.today());
    return (now.getDay() + 6) % 7;
  }

  private toHabitStates(type: 'gym' | 'protein'): HabitState[] {
    const states: HabitState[] = Array.from({ length: 7 }, () => 'empty');
    const week = this.getCurrentWeekRange();
    const days: string[] = [];
    const start = this.parseIsoDate(week.start);

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

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseIsoDate(value: string): Date {
    const normalized = this.normalizeDateInput(value);
    if (!normalized) {
      return new Date();
    }
    const [year, month, day] = normalized.split('-').map(part => Number(part));
    return new Date(year, month - 1, day);
  }

  private normalizeDateInput(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const canonical = trimmed.replace(/[./]/g, '-');
    const match = canonical.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (
      Number.isNaN(date.getTime())
      || date.getFullYear() !== year
      || date.getMonth() + 1 !== month
      || date.getDate() !== day
    ) {
      return null;
    }

    return this.formatDate(date);
  }

  private normalizeTimeInput(value: string): string | null {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!match) {
      return null;
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private combineDayTimeToIso(day: string, time: string, offsetSeconds = 0): string {
    const normalizedDay = this.normalizeDateInput(day) || this.realToday;
    const normalizedTime = this.normalizeTimeInput(time) || '12:00';
    const [year, month, date] = normalizedDay.split('-').map(part => Number(part));
    const [hours, minutes] = normalizedTime.split(':').map(part => Number(part));
    const stamp = new Date(year, month - 1, date, hours, minutes, 0);
    if (offsetSeconds > 0) {
      stamp.setSeconds(stamp.getSeconds() + offsetSeconds);
    }
    return stamp.toISOString();
  }

  private buildFoodLogTimestamp(day: string, offsetSeconds = 0): string {
    const baseTime = day === this.realToday ? this.currentLocalTimeOrFallback() : '12:00';
    return this.combineDayTimeToIso(day, baseTime, offsetSeconds);
  }

  private currentLocalTimeOrFallback(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  private compareIsoDays(a: string, b: string): number {
    const dateA = this.parseIsoDate(a).getTime();
    const dateB = this.parseIsoDate(b).getTime();
    if (dateA === dateB) {
      return 0;
    }
    return dateA < dateB ? -1 : 1;
  }

  closeAmountPicker(): void {
    this.selectedItem.set(null);
    this.editingEntryId.set(null);
    this.amountPickerMode.set('queue');
    this.returnSheetMode.set('food');
    this.selectedItemInitialAmount.set(100);
  }

  private startFoodJourney(source: string): void {
    const current = this.activeFoodJourneyId();
    if (current) {
      return;
    }
    this.activeFoodJourneyId.set(
      this.telemetry.startJourney('food_log', {
        source,
        selected_day: this.today()
      })
    );
  }

  private completeFoodJourney(action: string, context?: Record<string, unknown>): void {
    const current = this.activeFoodJourneyId();
    if (!current) {
      return;
    }
    this.telemetry.completeJourney(current, 'success', {
      action,
      ...context
    });
    this.activeFoodJourneyId.set(null);
  }

  private cancelFoodJourney(reason: string): void {
    const current = this.activeFoodJourneyId();
    if (!current) {
      return;
    }
    this.telemetry.cancelJourney(current, { reason });
    this.activeFoodJourneyId.set(null);
  }

  private failFoodJourney(reason: string): void {
    const current = this.activeFoodJourneyId();
    if (!current) {
      return;
    }
    this.telemetry.failJourney(current, { reason });
    this.activeFoodJourneyId.set(null);
  }

  private startWeightJourney(source: string): void {
    const current = this.activeWeightJourneyId();
    if (current) {
      return;
    }
    this.activeWeightJourneyId.set(
      this.telemetry.startJourney('weight_log', {
        source,
        selected_day: this.today()
      })
    );
  }

  private completeWeightJourney(action: string): void {
    const current = this.activeWeightJourneyId();
    if (!current) {
      return;
    }
    this.telemetry.completeJourney(current, 'success', { action });
    this.activeWeightJourneyId.set(null);
  }

  private cancelWeightJourney(reason: string): void {
    const current = this.activeWeightJourneyId();
    if (!current) {
      return;
    }
    this.telemetry.cancelJourney(current, { reason });
    this.activeWeightJourneyId.set(null);
  }

  private failWeightJourney(reason: string): void {
    const current = this.activeWeightJourneyId();
    if (!current) {
      return;
    }
    this.telemetry.failJourney(current, { reason });
    this.activeWeightJourneyId.set(null);
  }

  private formatWriteError(error: unknown): string {
    return formatAppError(error, 'Eintrag konnte nicht gespeichert werden');
  }
}
