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
  Copy,
  Dumbbell,
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
import { DailySummary, Ingredient, LogEntry, Meal, WeightLog } from '../../core/types';
import { AmountPickerSheetComponent, AmountPickResult, MacroTotals } from '../../ui/amount-picker-sheet.component';
import { HeroRingComponent } from '../../ui/minimal/hero-ring.component';
import { MacroBarComponent } from '../../ui/minimal/macro-bar.component';
import { HabitGridComponent, HabitState } from '../../ui/minimal/habit-grid.component';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';
import { formatAppError } from '../../core/error-format';
import { LibraryDataService } from '../../core/library-data.service';
import { QueryCacheService } from '../../core/query-cache.service';
import { InteractionTelemetryService } from '../../core/interaction-telemetry.service';

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

type FoodFilter = 'quick' | 'all' | 'favorites' | 'recent';
type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

interface FoodQueueItem {
  id: string;
  itemId: string;
  itemType: 'ingredient' | 'meal';
  name: string;
  mealSlot: MealSlot;
  mealTime: string;
  amount: number;
  totals: MacroTotals;
}

interface FoodDayPreview {
  day: string;
  entryCount: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface InstantLogState {
  entryId: string;
  name: string;
  day: string;
}

type FoodStage = 'search' | 'queue' | 'confirm';

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

      <section class="panel hero">
        <p class="date-label"><lucide-icon [img]="icons.calendar" class="icon" aria-hidden="true"></lucide-icon> {{ todayLabel() }}</p>

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
              [attr.max]="realToday"
              (ngModelChange)="onDayPicked($event)"
            >
          </mat-form-field>
          <button mat-icon-button type="button" class="nav-btn" (click)="goNextDay()" [disabled]="!canGoNextDay()" aria-label="Nächster Tag">
            <lucide-icon [img]="icons.chevronRight" aria-hidden="true"></lucide-icon>
          </button>
        </div>

        <div class="hero-actions">
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

        <div class="weight-quick" role="group" aria-label="Schnelles Gewichtloggen">
          <button mat-flat-button type="button" class="day-chip compact-chip" (click)="adjustInlineWeight(-0.1)">-0.1</button>
          <mat-form-field class="m3-field weight-quick-input" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Heute (kg)</mat-label>
            <input
              matInput
              type="number"
              min="20"
              step="0.1"
              [ngModel]="inlineWeightInput()"
              (ngModelChange)="onInlineWeightInput($event)"
            >
          </mat-form-field>
          <button mat-flat-button type="button" class="day-chip compact-chip" (click)="adjustInlineWeight(0.1)">+0.1</button>
          <button mat-flat-button type="button" class="entry-btn inline-save-btn" [disabled]="savingInlineWeight()" (click)="saveInlineWeight()">
            {{ savingInlineWeight() ? '...' : 'Loggen' }}
          </button>
        </div>
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
              <p class="entry-meta">{{ entryTimeLabel(entry.created_at) }}</p>
            </div>
            <div class="entry-actions">
              <button mat-flat-button type="button" class="entry-btn" (click)="openEntryActions(entry)">Mehr</button>
            </div>
          </article>
        }
      @if (todayEntries().length === 0) {
          <p class="muted">Für {{ today() }} noch keine Einträge.</p>
        }
      </section>

      <button mat-fab extended class="app-fab today-fab" type="button" (click)="openActions()" aria-label="Eintrag hinzufügen">
        <lucide-icon [img]="icons.plus" class="fab-icon" aria-hidden="true"></lucide-icon>
        Eintrag hinzufügen
      </button>
    </main>

    <app-bottom-sheet [open]="showActionSheet()" [title]="sheetTitle()" (closed)="closeActions()">
      @if (sheetMode() === 'menu') {
        <div class="action-list">
          <button mat-flat-button type="button" class="menu-btn" (click)="setSheetMode('food')"><lucide-icon [img]="icons.utensils" class="icon" aria-hidden="true"></lucide-icon> Essen hinzufügen</button>
          <button mat-flat-button type="button" class="menu-btn" (click)="setSheetMode('weight')"><lucide-icon [img]="icons.weight" class="icon" aria-hidden="true"></lucide-icon> Gewicht eintragen</button>
          <button mat-flat-button type="button" class="menu-btn" (click)="setSheetMode('gym')"><lucide-icon [img]="icons.dumbbell" class="icon" aria-hidden="true"></lucide-icon> Gym erledigt</button>
        </div>
      }

      @if (sheetMode() === 'food') {
        <section class="food-sheet">
          <div class="quick-primary-row">
            <button mat-flat-button type="button" class="menu-btn compact quick-primary-btn" (click)="copyEntriesToTargetDay()">
              <lucide-icon [img]="icons.copy" class="icon" aria-hidden="true"></lucide-icon>
              Tag kopieren
            </button>
            <button mat-flat-button type="button" class="menu-btn compact quick-secondary-btn" (click)="setSheetMode('weight')">
              <lucide-icon [img]="icons.weight" class="icon" aria-hidden="true"></lucide-icon>
              Gewicht
            </button>
          </div>

          <div class="stage-toggle" role="group" aria-label="Food Logging Schritte">
            <button mat-flat-button type="button" class="stage-btn" [class.active]="foodStage() === 'search'" (click)="setFoodStage('search')">1. Suche</button>
            <button mat-flat-button type="button" class="stage-btn" [class.active]="foodStage() === 'queue'" (click)="setFoodStage('queue')">2. Log-Liste</button>
            <button mat-flat-button type="button" class="stage-btn" [class.active]="foodStage() === 'confirm'" (click)="setFoodStage('confirm')">3. Bestätigen</button>
          </div>

          @if (foodStage() === 'search') {
            <mat-form-field class="m3-field food-search-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Lebensmittel suchen</mat-label>
              <input
                #foodSearchInput
                matInput
                type="search"
                [ngModel]="foodSearch()"
                (ngModelChange)="foodSearch.set($event)"
                placeholder="Lebensmittel suchen"
                aria-label="Lebensmittel suchen"
              >
            </mat-form-field>

            @if (favoriteQuickItems().length > 0) {
              <div class="favorite-row" role="group" aria-label="Favoriten">
                @for (item of favoriteQuickItems(); track item.id) {
                  <button mat-flat-button type="button" class="favorite-chip" (click)="addDefaultToQueue(item)">
                    {{ item.name }}
                  </button>
                }
              </div>
            }

            <div class="filter-toggle" role="group" aria-label="Food Filter">
              <button
                mat-flat-button
                type="button"
                class="filter-btn"
                [class.active]="foodFilter() === 'quick'"
                (click)="setFoodFilter('quick')"
              >
                Schnell
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
                [class.active]="foodFilter() === 'recent'"
                (click)="setFoodFilter('recent')"
              >
                Zuletzt
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
                    <button
                      mat-flat-button
                      type="button"
                      class="day-chip"
                      style="width:auto; min-height:36px; padding-inline:12px;"
                      (click)="quickLogFood(item)"
                      aria-label="Sofort mit Standardmenge loggen"
                    >
                      Sofort
                    </button>
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

            @if (lastInstantLog()) {
              <article class="food-day-preview">
                <strong>{{ lastInstantLog()!.name }} geloggt für {{ lastInstantLog()!.day }}</strong>
                <button
                  mat-flat-button
                  type="button"
                  class="day-chip"
                  style="width:auto; min-height:34px; justify-self:start; padding-inline:12px;"
                  [disabled]="undoingInstantLog()"
                  (click)="undoInstantLog()"
                >
                  {{ undoingInstantLog() ? '...' : 'Rückgängig' }}
                </button>
              </article>
            }

            @if (foodQueueCount() > 0) {
              <button mat-flat-button type="button" class="menu-btn compact stage-next-btn" (click)="setFoodStage('queue')">
                Zur Log-Liste ({{ foodQueueCount() }})
              </button>
            }
          }

          @if (foodStage() === 'queue' || foodStage() === 'confirm') {
            <div class="slot-row" role="group" aria-label="Mahlzeiten-Slot">
              <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'breakfast'" (click)="setMealSlot('breakfast')">Frühstück</button>
              <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'lunch'" (click)="setMealSlot('lunch')">Mittag</button>
              <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'dinner'" (click)="setMealSlot('dinner')">Abend</button>
              <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'snack'" (click)="setMealSlot('snack')">Snack</button>
              <button mat-flat-button type="button" class="slot-chip" [class.active]="selectedMealSlot() === 'other'" (click)="setMealSlot('other')">Sonstiges</button>
            </div>

            <mat-form-field class="m3-field time-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Zeit</mat-label>
              <input matInput type="time" [ngModel]="selectedMealTime()" (ngModelChange)="onMealTimeChange($event)">
            </mat-form-field>
          }

          @if (foodStage() === 'confirm') {
            <div class="food-day-grid">
              <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                <mat-label>Zieltag</mat-label>
                <input matInput type="date" [ngModel]="foodTargetDay()" (ngModelChange)="onFoodTargetDayChange($event)">
              </mat-form-field>

              <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
                <mat-label>Kopieren von</mat-label>
                <input matInput type="date" [ngModel]="copySourceDay()" (ngModelChange)="onCopySourceDayChange($event)">
              </mat-form-field>
            </div>

            @if (isFoodTargetFuture()) {
              <p class="muted">Du loggst für einen zukünftigen Tag: {{ foodTargetDay() }}.</p>
            }

            @if (loadingFoodTargetPreview()) {
              <p class="muted">Tagesstatus wird geladen...</p>
            } @else if (foodTargetPreview()) {
              <article class="food-day-preview">
                <strong>{{ foodTargetPreview()!.day }}</strong>
                <span>{{ foodTargetPreview()!.entryCount }} Einträge · {{ foodTargetPreview()!.kcal.toFixed(0) }} kcal</span>
                <small>P {{ foodTargetPreview()!.protein.toFixed(0) }} · KH {{ foodTargetPreview()!.carbs.toFixed(0) }} · F {{ foodTargetPreview()!.fat.toFixed(0) }}</small>
              </article>
            }

            <div class="day-quick-row">
              <button mat-flat-button type="button" class="day-chip" (click)="setFoodTargetByOffset(-1)">-1 Tag</button>
              <button mat-flat-button type="button" class="day-chip" (click)="setFoodTargetByOffset(1)">+1 Tag</button>
              <button mat-flat-button type="button" class="day-chip" (click)="setFoodTargetByOffset(7)">+7 Tage</button>
            </div>
          }

          @if (foodStage() !== 'search') {
            <div class="queue-list">
              @if (foodQueueCount() > 0) {
                <p class="queue-head">Log-Liste ({{ foodQueueCount() }})</p>
              }
              @for (item of foodQueue(); track item.id) {
                <article class="queue-item">
                  <div class="queue-main">
                    <strong>{{ item.name }}</strong>
                    <small>{{ mealSlotLabel(item.mealSlot) }} · {{ item.mealTime }}</small>
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
                <p class="muted">Deine Log-Liste ist leer. Füge im Schritt "Suche" Lebensmittel hinzu.</p>
              }
            </div>
          }

          @if (foodStage() === 'queue' && foodQueueCount() > 0) {
            <div class="stage-footer-row">
              <button mat-flat-button type="button" class="menu-btn compact stage-next-btn" (click)="setFoodStage('search')">Zur Suche</button>
              <button mat-flat-button type="button" class="menu-btn compact stage-next-btn primary-stage" (click)="setFoodStage('confirm')">Weiter zu Bestätigen</button>
            </div>
          }

          @if (foodStage() === 'confirm') {
            <div class="food-footer">
              <div class="queue-total">
                <small>P {{ queueTotals().protein.toFixed(0) }} · KH {{ queueTotals().carbs.toFixed(0) }} · F {{ queueTotals().fat.toFixed(0) }}</small>
                <strong>{{ queueTotals().kcal.toFixed(0) }} kcal</strong>
              </div>
              <button mat-flat-button type="button" class="menu-btn apply-log-btn" [disabled]="foodQueueCount() === 0" (click)="applyFoodQueue()">
                Log-Liste loggen ({{ foodQueueCount() }})
              </button>
            </div>
          }
        </section>
      }

      @if (sheetMode() === 'weight') {
        <section class="weight-sheet">
          <div class="weight-actions">
            <button mat-flat-button type="button" class="day-chip" (click)="setWeightDateToToday()">Heute</button>
            <button mat-flat-button type="button" class="day-chip" (click)="setSheetMode('food')">Zu Essen</button>
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

      @if (sheetMode() === 'gym') {
        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Notiz (optional)</mat-label>
          <textarea matInput id="gym-note-input" rows="3" [(ngModel)]="gymNote" placeholder="Was lief heute gut?"></textarea>
        </mat-form-field>

        <p class="file-label">Foto (optional)</p>
        <div class="file-row">
          <button mat-flat-button type="button" class="menu-btn compact" (click)="pickGymPhoto()">Foto auswählen</button>
          <span class="file-name">{{ gymPhotoName() || 'Kein Foto gewählt' }}</span>
        </div>
        <input #gymPhotoInput id="gym-photo-input" class="sr-only" type="file" accept="image/*" (change)="onGymPhotoSelected($event)">

        <button mat-flat-button type="button" class="menu-btn" [disabled]="savingGymPost()" (click)="submitGymPost()">
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
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      align-items: center;
      justify-items: end;
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

    .today-fab {
      z-index: 31;
      width: auto;
      min-width: max-content;
      height: var(--touch-target);
      border-radius: 999px;
      padding-inline: 18px;
      gap: 8px;
    }

    .action-list {
      display: grid;
      gap: 8px;
    }

    .food-sheet {
      display: grid;
      gap: 12px;
      padding-bottom: max(8px, env(safe-area-inset-bottom));
    }

    .quick-primary-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
    }

    .quick-primary-btn {
      background: var(--m3-sys-color-primary);
      border-color: transparent;
      color: var(--m3-sys-color-on-primary);
      justify-content: center;
    }

    .quick-secondary-btn {
      background: var(--m3-sys-color-surface-container-highest);
      color: var(--m3-sys-color-on-surface);
      justify-content: center;
      min-width: 118px;
    }

    .food-day-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .day-quick-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .day-chip {
      min-height: 38px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface);
      font-size: 13px;
      font-weight: 700;
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
      background: var(--m3-sys-color-primary);
      color: var(--m3-sys-color-on-primary);
      border-color: transparent;
    }

    .food-search-field .mat-mdc-form-field-subscript-wrapper,
    .time-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .food-day-preview {
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container-low);
      padding: 10px 12px;
      display: grid;
      gap: 2px;
      animation: sheet-item-enter var(--motion-duration-medium) var(--motion-easing-decelerate) both;
    }

    .food-day-preview strong {
      color: var(--m3-sys-color-on-surface);
      font-size: 14px;
      font-weight: 700;
    }

    .food-day-preview span,
    .food-day-preview small {
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 12px;
      font-weight: 600;
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
      min-height: 36px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-secondary-container);
      color: var(--m3-sys-color-on-secondary-container);
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      padding: 0 14px;
    }

    .filter-toggle {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }

    .filter-btn {
      min-height: var(--touch-target-compact);
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 999px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface-variant);
      font-size: 13px;
      font-weight: 700;
      justify-content: center;
      width: 100%;
    }

    .filter-btn.active {
      background: var(--m3-sys-color-primary);
      color: var(--m3-sys-color-on-primary);
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
      animation: sheet-item-enter var(--motion-duration-medium) var(--motion-easing-decelerate) both;
      transition:
        transform var(--motion-duration-short) var(--motion-easing-standard),
        border-color var(--motion-duration-short) var(--motion-easing-standard);
    }

    .food-row:active {
      transform: translateY(1px);
    }

    .food-open-btn {
      min-height: 42px;
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
      width: 40px;
      height: 40px;
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
      background: var(--m3-sys-color-primary);
      color: var(--m3-sys-color-on-primary);
      border-color: transparent;
    }

    .round-icon-btn lucide-icon.is-favorite {
      color: var(--m3-sys-color-primary);
      fill: var(--m3-sys-color-primary);
    }

    .menu-btn {
      min-height: 44px;
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container-high);
      color: var(--m3-sys-color-on-surface);
      font-size: 15px;
      font-weight: 600;
      text-align: left;
      padding: 6px 12px;
      display: grid;
      gap: 2px;
      align-content: center;
    }

    .action-list .menu-btn {
      min-height: var(--touch-target-compact);
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
      min-height: 40px;
      padding: 0 14px;
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

    .queue-head {
      margin: 0;
      color: var(--m3-sys-color-on-surface);
      font-size: 13px;
      font-weight: 700;
    }

    .queue-item {
      border: 1px solid var(--m3-sys-color-outline-variant);
      border-radius: 16px;
      background: var(--m3-sys-color-surface-container-low);
      padding: 8px;
      display: grid;
      gap: 8px;
      animation: sheet-item-enter var(--motion-duration-medium) var(--motion-easing-decelerate) both;
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
      min-height: 44px;
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

    @keyframes sheet-item-enter {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 440px) {
      .food-day-grid {
        grid-template-columns: 1fr;
      }

      .quick-primary-row {
        grid-template-columns: 1fr;
      }

      .quick-secondary-btn {
        min-width: 0;
      }

      .filter-toggle {
        grid-template-columns: repeat(2, minmax(0, 1fr));
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
    copy: Copy,
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
  readonly foodTargetDay = signal(this.realToday);
  readonly copySourceDay = signal(this.formatDate(new Date(Date.now() - 24 * 60 * 60 * 1000)));
  readonly foodFilter = signal<FoodFilter>('quick');
  readonly foodStage = signal<FoodStage>('search');
  readonly selectedMealSlot = signal<MealSlot>('snack');
  readonly selectedMealTime = signal('12:00');
  readonly foodQueue = signal<FoodQueueItem[]>([]);
  readonly favoriteFoodIds = signal<string[]>([]);
  readonly amountPickerMode = signal<'queue' | 'edit'>('queue');
  readonly foodTargetPreview = signal<FoodDayPreview | null>(null);
  readonly loadingFoodTargetPreview = signal(false);
  readonly weightTrendDays = signal<7 | 30>(7);
  readonly inlineWeightInput = signal(70);
  readonly savingInlineWeight = signal(false);
  readonly lastInstantLog = signal<InstantLogState | null>(null);
  readonly undoingInstantLog = signal(false);
  readonly activeFoodJourneyId = signal<string | null>(null);
  readonly activeWeightJourneyId = signal<string | null>(null);
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly telemetry = inject(InteractionTelemetryService);

  readonly todayLabel = computed(() =>
    this.parseIsoDate(this.today()).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })
  );
  readonly proteinToday = computed(() => Math.round(Number(this.summary()?.protein || 0)));
  readonly fatToday = computed(() => Math.round(Number(this.summary()?.fat || 0)));
  readonly carbsToday = computed(() => Math.round(Number(this.summary()?.carbs || 0)));
  readonly caloriesToday = computed(() => Math.round(Number(this.summary()?.kcal || 0)));

  readonly todayEntries = computed(() => this.entries());
  readonly recentWeightEntries = computed(() => this.weightLogs().slice(0, 7));
  readonly trendWeightEntries = computed(() => this.weightLogs().slice(0, this.weightTrendDays()));

  readonly selectedDayWeight = computed(() =>
    this.weightLogs().find(entry => entry.logged_on === this.today()) || null
  );

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
    const filter = this.foodFilter();
    const favorites = new Set(this.favoriteFoodIds());
    const recentIds = new Set(this.entries().map(entry => entry.ref_id));
    const showQuickOnly = filter === 'quick' && (favorites.size > 0 || recentIds.size > 0);

    return this.allFoodItems()
      .filter(item => {
        if (query && !item.name.toLowerCase().includes(query)) {
          return false;
        }
        if (showQuickOnly && !favorites.has(item.id) && !recentIds.has(item.id)) {
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
  readonly canGoNextDay = computed(() => this.compareIsoDays(this.today(), this.realToday) < 0);
  readonly isFoodTargetFuture = computed(() => this.compareIsoDays(this.foodTargetDay(), this.realToday) > 0);
  readonly foodQueueCount = computed(() => this.foodQueue().length);

  ngOnInit(): void {
    this.favoriteFoodIds.set(this.readFavoriteFoodIds());
    this.foodTargetDay.set(this.today());
    this.copySourceDay.set(this.shiftIsoDay(this.today(), -1));
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        if (params.get('quick') !== 'food') {
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
      this.inlineWeightInput.set(Number(selectedWeight?.weight_kg || this.weightInput));
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
    const date = this.parseIsoDate(this.today());
    date.setDate(date.getDate() - 1);
    this.today.set(this.formatDate(date));
    void this.loadData();
  }

  goNextDay(): void {
    const current = this.parseIsoDate(this.today());
    current.setDate(current.getDate() + 1);
    const nextDay = this.formatDate(current);
    if (this.compareIsoDays(nextDay, this.realToday) > 0) {
      return;
    }
    this.today.set(nextDay);
    void this.loadData();
  }

  onDayPicked(value: string): void {
    const normalized = this.normalizeDateInput(value);
    if (!normalized) {
      return;
    }
    this.today.set(this.compareIsoDays(normalized, this.realToday) > 0 ? this.realToday : normalized);
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

  openActions(): void {
    this.setSheetMode('food');
    this.showActionSheet.set(true);
  }

  closeActions(): void {
    const mode = this.sheetMode();
    if (mode === 'food') {
      this.cancelFoodJourney('sheet_closed');
    } else if (mode === 'weight') {
      this.cancelWeightJourney('sheet_closed');
    }

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
    const currentMode = this.sheetMode();
    if (currentMode === 'food' && mode !== 'food') {
      this.cancelFoodJourney('mode_switch');
    }
    if (currentMode === 'weight' && mode !== 'weight') {
      this.cancelWeightJourney('mode_switch');
    }

    this.sheetMode.set(mode);
    if (mode === 'food') {
      this.startFoodJourney('sheet_mode');
      this.foodStage.set(this.foodQueueCount() > 0 ? 'queue' : 'search');
      if (this.foodQueueCount() === 0) {
        this.foodTargetDay.set(this.today());
        this.copySourceDay.set(this.shiftIsoDay(this.today(), -1));
        this.selectedMealTime.set(this.currentTimeHHmm());
        this.selectedMealSlot.set('snack');
      }
      this.foodSearch.set('');
      void this.loadFoodTargetPreview();
    }
    if (mode === 'weight') {
      this.startWeightJourney('sheet_mode');
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

  openAmountPicker(item: QuickItem, mode: 'queue' | 'edit' = 'queue'): void {
    this.amountPickerMode.set(mode);
    if (mode === 'queue') {
      this.editingEntryId.set(null);
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

  setFoodStage(stage: FoodStage): void {
    if (stage !== 'search' && this.foodQueueCount() === 0) {
      this.foodStage.set('search');
      return;
    }
    this.foodStage.set(stage);
  }

  setWeightTrendDays(days: 7 | 30): void {
    this.weightTrendDays.set(days);
  }

  onInlineWeightInput(value: string | number): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    this.inlineWeightInput.set(Number(parsed.toFixed(1)));
  }

  adjustInlineWeight(delta: number): void {
    const current = this.inlineWeightInput();
    const next = Math.max(20, Number((current + delta).toFixed(1)));
    this.inlineWeightInput.set(next);
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

  setFoodTargetByOffset(days: number): void {
    const target = this.shiftIsoDay(this.foodTargetDay(), days);
    this.foodTargetDay.set(target);
    this.copySourceDay.set(this.shiftIsoDay(target, -1));
    void this.loadFoodTargetPreview();
  }

  onMealTimeChange(value: string): void {
    const normalized = this.normalizeTimeInput(value);
    if (normalized) {
      this.selectedMealTime.set(normalized);
    }
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
    this.addToFoodQueue(item, amount, this.scaledMacros(item, amount), this.selectedMealSlot(), this.selectedMealTime());
    this.foodStage.set('queue');
  }

  async quickLogFood(item: QuickItem): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const targetDay = this.foodTargetDay();
    const amount = this.isIngredient(item) ? 100 : 1;
    const totals = this.scaledMacros(item, amount);
    const payload = {
      owner_id: user.id,
      group_id: null as string | null,
      day: targetDay,
      entry_type: this.isIngredient(item) ? 'ingredient' : 'meal',
      ref_id: item.id,
      quantity: Number(amount.toFixed(2)),
      kcal: Number(totals.kcal.toFixed(2)),
      protein: Number(totals.protein.toFixed(2)),
      carbs: Number(totals.carbs.toFixed(2)),
      fat: Number(totals.fat.toFixed(2)),
      created_at: this.combineDayTimeToIso(targetDay, this.selectedMealTime())
    };

    const { data, error } = await this.supabaseService.client
      .from('log_entries')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      this.failFoodJourney('quick_log_error');
      this.errorMessage.set(formatAppError(error, 'Sofort-Log fehlgeschlagen'));
      return;
    }

    this.lastInstantLog.set({
      entryId: String((data as { id: string }).id),
      name: item.name,
      day: targetDay
    });
    this.successMessage.set(`${item.name} sofort geloggt.`);
    this.completeFoodJourney('quick_log');
    this.invalidateDayCaches(user.id);
    await this.loadFoodTargetPreview();
    if (targetDay === this.today()) {
      await this.loadData(true);
    }
  }

  async undoInstantLog(): Promise<void> {
    const user = this.authService.user();
    const last = this.lastInstantLog();
    if (!user || !last) {
      return;
    }

    this.undoingInstantLog.set(true);
    const { error } = await this.supabaseService.client
      .from('log_entries')
      .delete()
      .eq('id', last.entryId)
      .eq('owner_id', user.id);

    this.undoingInstantLog.set(false);
    if (error) {
      this.errorMessage.set(formatAppError(error, 'Rückgängig fehlgeschlagen'));
      return;
    }

    this.successMessage.set(`${last.name} wurde entfernt.`);
    this.lastInstantLog.set(null);
    this.invalidateDayCaches(user.id);
    await this.loadFoodTargetPreview();
    if (last.day === this.today()) {
      await this.loadData(true);
    }
  }

  removeFoodQueueItem(queueId: string): void {
    this.foodQueue.update(current => {
      const next = current.filter(item => item.id !== queueId);
      if (next.length === 0 && this.foodStage() !== 'search') {
        this.foodStage.set('search');
      }
      return next;
    });
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

  onFoodTargetDayChange(value: string): void {
    const normalized = this.normalizeDateInput(value);
    if (!normalized) {
      return;
    }
    this.foodTargetDay.set(normalized);
    this.copySourceDay.set(this.shiftIsoDay(normalized, -1));
    void this.loadFoodTargetPreview();
  }

  onCopySourceDayChange(value: string): void {
    const normalized = this.normalizeDateInput(value);
    if (!normalized) {
      return;
    }
    this.copySourceDay.set(normalized);
  }

  async applyFoodQueue(): Promise<void> {
    const user = this.authService.user();
    const queue = this.foodQueue();
    if (!user || queue.length === 0) {
      return;
    }

    const targetDay = this.foodTargetDay();
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
      created_at: this.combineDayTimeToIso(targetDay, item.mealTime, index * 5)
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
    this.foodStage.set('search');
    this.invalidateDayCaches(user.id);
    await this.loadFoodTargetPreview();
    if (targetDay === this.today()) {
      await this.loadData(true);
    }
  }

  async copyEntriesToTargetDay(): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const sourceDay = this.copySourceDay();
    const targetDay = this.foodTargetDay();

    if (this.compareIsoDays(sourceDay, targetDay) === 0) {
      this.errorMessage.set('Quelle und Zieltag müssen unterschiedlich sein.');
      return;
    }

    const { data: sourceEntries, error: sourceError } = await this.supabaseService.client
      .from('log_entries')
      .select('entry_type,ref_id,quantity,kcal,protein,carbs,fat')
      .eq('owner_id', user.id)
      .is('group_id', null)
      .eq('day', sourceDay);

    if (sourceError) {
      this.errorMessage.set(formatAppError(sourceError, 'Einträge konnten nicht kopiert werden'));
      return;
    }

    if (!sourceEntries || sourceEntries.length === 0) {
      this.errorMessage.set(`Am ${sourceDay} gibt es keine Einträge zum Kopieren.`);
      return;
    }

    const payload = sourceEntries.map((entry, index) => ({
      owner_id: user.id,
      group_id: null as string | null,
      day: targetDay,
      entry_type: entry.entry_type,
      ref_id: entry.ref_id,
      quantity: Number(entry.quantity),
      kcal: Number(entry.kcal),
      protein: Number(entry.protein),
      carbs: Number(entry.carbs),
      fat: Number(entry.fat),
      created_at: this.combineDayTimeToIso(targetDay, this.selectedMealTime(), index * 5)
    }));

    const { error: insertError } = await this.supabaseService.client.from('log_entries').insert(payload);
    if (insertError) {
      this.errorMessage.set(formatAppError(insertError, 'Kopieren fehlgeschlagen'));
      return;
    }

    this.successMessage.set(`${payload.length} Einträge von ${sourceDay} nach ${targetDay} kopiert.`);
    this.invalidateDayCaches(user.id);
    await this.loadFoodTargetPreview();
    if (targetDay === this.today()) {
      await this.loadData(true);
    }
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
      this.addToFoodQueue(item, result.amount, result.totals, this.selectedMealSlot(), this.selectedMealTime());
      this.successMessage.set(`${item.name} zur Log-Liste hinzugefügt.`);
      this.closeAmountPicker();
      this.sheetMode.set('food');
      this.foodStage.set('queue');
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
    this.invalidateDayCaches(user.id);
    await this.loadData(true);
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
    await this.loadData(true);
  }

  async saveInlineWeight(): Promise<void> {
    const user = this.authService.user();
    const value = this.inlineWeightInput();
    if (!user || value <= 0) {
      this.errorMessage.set('Bitte gib ein gültiges Gewicht ein.');
      return;
    }

    this.startWeightJourney('inline');
    this.savingInlineWeight.set(true);
    const saved = await this.upsertWeight(user.id, this.today(), value);
    this.savingInlineWeight.set(false);
    if (!saved) {
      this.failWeightJourney('inline_save_error');
      return;
    }

    this.successMessage.set('Gewicht für heute gespeichert.');
    this.completeWeightJourney('inline_save');
    this.invalidateDayCaches(user.id);
    await this.loadData(true);
  }

  setWeightDateToToday(): void {
    this.weightDateInput = this.realToday;
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

  entryTimeLabel(isoTimestamp: string): string {
    const parsed = new Date(isoTimestamp);
    if (Number.isNaN(parsed.getTime())) {
      return '--:--';
    }
    return parsed.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  private async loadFoodTargetPreview(): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    const day = this.foodTargetDay();
    this.loadingFoodTargetPreview.set(true);
    try {
      const [
        { data: summaryData, error: summaryError },
        { count, error: countError }
      ] = await Promise.all([
        this.supabaseService.client
          .from('daily_summaries')
          .select('kcal,protein,carbs,fat')
          .eq('owner_id', user.id)
          .is('group_id', null)
          .eq('day', day)
          .maybeSingle(),
        this.supabaseService.client
          .from('log_entries')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', user.id)
          .is('group_id', null)
          .eq('day', day)
      ]);

      if (summaryError || countError) {
        throw summaryError || countError;
      }

      this.foodTargetPreview.set({
        day,
        entryCount: Number(count || 0),
        kcal: Number(summaryData?.kcal || 0),
        protein: Number(summaryData?.protein || 0),
        carbs: Number(summaryData?.carbs || 0),
        fat: Number(summaryData?.fat || 0)
      });
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Tagesvorschau konnte nicht geladen werden'));
      this.foodTargetPreview.set(null);
    } finally {
      this.loadingFoodTargetPreview.set(false);
    }
  }

  private addToFoodQueue(
    item: QuickItem,
    amount: number,
    totals: MacroTotals,
    mealSlot: MealSlot,
    mealTime: string
  ): void {
    this.foodQueue.update(current => [
      ...current,
      {
        id: this.makeLocalId(),
        itemId: item.id,
        itemType: this.isIngredient(item) ? 'ingredient' : 'meal',
        name: item.name,
        mealSlot,
        mealTime,
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

  private currentTimeHHmm(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
    const now = this.parseIsoDate(this.today());
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
        selected_day: this.foodTargetDay()
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
