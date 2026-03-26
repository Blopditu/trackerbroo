import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
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
  Weight,
} from 'lucide-angular';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import {
  CommunityPost,
  DailySummary,
  Ingredient,
  LogEntry,
  Meal,
  Profile,
  StepLog,
  WeightLog,
} from '../../core/types';
import {
  AmountPickerSheetComponent,
  AmountPickResult,
  MacroTotals,
} from '../../ui/amount-picker-sheet.component';
import { HeroRingComponent } from '../../ui/minimal/hero-ring.component';
import { MacroBarComponent } from '../../ui/minimal/macro-bar.component';
import { HabitGridComponent, HabitState } from '../../ui/minimal/habit-grid.component';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';
import { formatAppError } from '../../core/error-format';
import { LibraryDataService } from '../../core/library-data.service';
import { QueryCacheService } from '../../core/query-cache.service';
import { InteractionTelemetryService } from '../../core/interaction-telemetry.service';
import {
  CommunityFeedService,
  CommunityProfileDirectoryEntry,
} from '../../core/community-feed.service';

type QuickItem = Ingredient | Meal;
type TodaySectionId = 'logs' | 'habits' | 'trends';

const TODAY_SECTION_ORDER_DEFAULT: TodaySectionId[] = ['logs', 'habits', 'trends'];

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
  gymDaysWindow: string[];
  proteinDaysWindow: string[];
  proteinMilestonePosted: boolean;
  stepsMilestonePosted: boolean;
  profile: Profile | null;
  recentFoodRefs: FoodRecentRef[];
}

type FoodFilter = 'all' | 'favorites' | 'recent';

interface FoodQueueItem {
  id: string;
  itemId: string;
  itemType: 'ingredient' | 'meal';
  name: string;
  amount: number;
  totals: MacroTotals;
}

interface FoodRecentRef {
  itemId: string;
  itemType: 'ingredient' | 'meal';
  lastLoggedAt: string;
}

interface BrooBoardPost {
  post: CommunityPost;
  displayName: string;
  avatarUrl: string | null;
  photoUrl: string | null;
}

@Component({
  selector: 'app-today',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    LucideAngularModule,
    AmountPickerSheetComponent,
    HeroRingComponent,
    MacroBarComponent,
    HabitGridComponent,
    BottomSheetComponent,
  ],
  template: `
    <main class="page today-page">
      @if (errorMessage()) {
        <p class="toast error" role="status" aria-live="polite" aria-atomic="true">
          {{ errorMessage() }}
        </p>
      }

      @if (successMessage()) {
        <p class="toast success" role="status" aria-live="polite" aria-atomic="true">
          {{ successMessage() }}
        </p>
      }

      <section class="broo-board-strip" aria-labelledby="broo-board-title">
        <div class="broo-strip-head">
          <p id="broo-board-title" class="title-font">Broo Board</p>
        </div>

        @if (loadingBrooBoard()) {
          <p class="muted">Der Gruppenrhythmus wird geladen …</p>
        } @else if (brooBoardPosts().length > 0) {
          <div class="board-carousel" aria-label="Letzte Gruppenaktivität">
            @for (item of brooBoardPosts(); track item.post.id) {
              <article class="board-strip-card">
                @if (item.avatarUrl) {
                  <img
                    [src]="item.avatarUrl"
                    alt=""
                    class="board-strip-avatar"
                    loading="lazy"
                    decoding="async"
                  />
                } @else {
                  <div class="board-strip-avatar board-strip-avatar-fallback" aria-hidden="true">
                    {{ brooAvatarLabel(item.displayName) }}
                  </div>
                }

                <div class="board-strip-copy">
                  <div class="board-strip-topline">
                    <strong>{{ item.displayName }}</strong>
                    <span>{{ brooPostDayLabel(item.post.day) }}</span>
                  </div>
                  <p>{{ brooPostSummary(item.post) }}</p>
                </div>
              </article>
            }
          </div>
        } @else {
          <p class="muted">Heute ist das Board noch ruhig. Der erste Check-in setzt den Ton.</p>
        }
      </section>

      <section class="my-day-panel">
        <div class="my-day-head">
          <div class="my-day-head-copy">
            <p class="title-font">Mein Tag</p>
          </div>
        </div>

        <div class="day-nav day-nav-compact day-control-row">
          <button
            type="button"
            class="nav-btn"
            (click)="goPreviousDay()"
            aria-label="Vorheriger Tag"
          >
            <lucide-icon [img]="icons.chevronLeft" aria-hidden="true"></lucide-icon>
          </button>

          <div class="day-control-field">
            <input
              #dayPickerInput
              type="date"
              class="day-input-native"
              [ngModel]="today()"
              (ngModelChange)="onDayPicked($event)"
            />
            <button
              type="button"
              class="day-display-btn"
              (click)="openDayPicker()"
              aria-label="Tag wählen"
            >
              <span class="day-display-value">{{ selectedDayDisplay() }}</span>
              <lucide-icon
                [img]="icons.calendar"
                class="day-control-icon"
                aria-hidden="true"
              ></lucide-icon>
            </button>
          </div>

          <button
            type="button"
            class="nav-btn"
            (click)="goNextDay()"
            [disabled]="!canGoNextDay()"
            aria-label="Nächster Tag"
          >
            <lucide-icon [img]="icons.chevronRight" aria-hidden="true"></lucide-icon>
          </button>
        </div>

        <article class="day-summary-card">
          <div class="day-summary-top">
            <div class="day-ring-slot day-ring-slot-centered">
              <app-hero-ring
                [value]="proteinToday()"
                [target]="proteinGoal"
                [showLeftText]="false"
                accentColor="var(--ui-primary)"
              />
            </div>

            <div class="day-summary-copy">
              <p class="summary-caption">Protein heute</p>
              <p class="summary-status">
                @if (proteinRemaining() > 0) {
                  Noch {{ proteinRemaining() }}g bis zum Ziel
                } @else {
                  Tagesziel erreicht
                }
              </p>
            </div>
          </div>

          <div class="bars summary-bars">
            <app-macro-bar
              label="Protein"
              [value]="proteinToday()"
              [target]="proteinGoal"
              color="var(--ui-primary)"
            />
            <app-macro-bar
              label="Fett"
              [value]="fatToday()"
              [target]="fatGoal"
              color="var(--warning-500)"
            />
            <app-macro-bar
              label="Kohlenhydrate"
              [value]="carbsToday()"
              [target]="carbGoal"
              color="var(--success-500)"
            />
          </div>

          <div class="kcal-row summary-kcal-row">
            <span>Kalorien</span>
            <strong>{{ caloriesToday() }} kcal</strong>
          </div>
        </article>

        <div class="today-stat-grid" [class.single]="!trackStepsEnabled()">
          <article class="today-stat-card">
            <span class="today-stat-label"
              ><lucide-icon [img]="icons.weight" class="icon" aria-hidden="true"></lucide-icon>
              Gewicht</span
            >
            <strong>{{ weightValueLabel() }}</strong>
            <small>{{ weightDeltaLabel() }}</small>
          </article>

          @if (trackStepsEnabled()) {
            <article class="today-stat-card">
              <span class="today-stat-label"
                ><lucide-icon [img]="icons.footsteps" class="icon" aria-hidden="true"></lucide-icon>
                Schritte</span
              >
              <strong>{{ stepsValueLabel() }}</strong>
              <small>{{ stepsGoalLabel() }}</small>
            </article>
          }
        </div>

        @if (canShareProteinMilestone() || canShareStepsMilestone()) {
          <div class="today-milestone-actions" role="group" aria-label="Erfolge teilen">
            @if (canShareProteinMilestone()) {
              <button
                mat-flat-button
                type="button"
                class="today-milestone-btn"
                (click)="shareProteinMilestone()"
              >
                Protein-Ziel im Board teilen
              </button>
            }
            @if (canShareStepsMilestone()) {
              <button
                mat-flat-button
                type="button"
                class="today-milestone-btn"
                (click)="shareStepsMilestone()"
              >
                Schrittziel im Board teilen
              </button>
            }
          </div>
        }
      </section>

      <div class="today-layout-row">
        <button type="button" class="today-layout-btn" (click)="openLayoutSheet()">
          Heute anpassen
        </button>
      </div>

      <div class="today-lower-sections">
        @for (sectionId of orderedTodaySections(); track sectionId) {
          @switch (sectionId) {
            @case ('logs') {
              <section class="section today-section">
                <div class="m3-section-head">
                  <h2>
                    <lucide-icon [img]="icons.clock3" class="icon" aria-hidden="true"></lucide-icon>
                    Log
                  </h2>
                  <span class="m3-section-meta">{{ todayEntries().length }} Einträge</span>
                </div>

                @for (entry of todayEntries(); track entry.id) {
                  <article class="entry-card">
                    <div class="entry-main">
                      <strong class="entry-title">{{
                        entry.entry_type === 'ingredient'
                          ? getIngredientName(entry.ref_id)
                          : getMealName(entry.ref_id)
                      }}</strong>
                      <p class="entry-sub">
                        {{
                          entry.quantity +
                            (entry.entry_type === 'ingredient' ? 'g' : ' Portionen') +
                            ' · P ' +
                            entry.protein.toFixed(1) +
                            'g' +
                            ' · KH ' +
                            entry.carbs.toFixed(1) +
                            'g' +
                            ' · F ' +
                            entry.fat.toFixed(1) +
                            'g' +
                            ' · ' +
                            entry.kcal.toFixed(0) +
                            ' kcal'
                        }}
                      </p>
                    </div>
                    <div class="entry-actions">
                      <button
                        mat-flat-button
                        type="button"
                        class="entry-btn"
                        (click)="openEntryActions(entry)"
                      >
                        Verwalten
                      </button>
                    </div>
                  </article>
                }

                @if (todayEntries().length === 0) {
                  <p class="muted">
                    Für heute ist noch nichts geloggt. Nutze das Plus oder starte direkt über eine
                    Mahlzeit.
                  </p>
                }
              </section>
            }

            @case ('habits') {
              <section class="section today-section">
                <div class="m3-section-head">
                  <h2>
                    <lucide-icon
                      [img]="icons.listChecks"
                      class="icon"
                      aria-hidden="true"
                    ></lucide-icon>
                    Gewohnheiten
                  </h2>
                  <span class="m3-section-meta">Diese Woche</span>
                </div>
                <div class="habit-heatmap-grid">
                  <app-habit-grid
                    label="Gym"
                    windowLabel="Letzte 30 Tage"
                    [states]="gymHabitStates()"
                    [targetPerWeek]="3"
                    accentColor="var(--ui-primary)"
                  />
                  <app-habit-grid
                    label="Protein"
                    windowLabel="Letzte 30 Tage"
                    [states]="proteinHabitStates()"
                    [targetPerWeek]="7"
                    accentColor="color-mix(in srgb, var(--ui-primary) 84%, white)"
                  />
                </div>
              </section>
            }

            @case ('trends') {
              <section class="section today-section trend-compact-section">
                <div class="m3-section-head">
                  <h2>
                    <lucide-icon
                      [img]="icons.chartLine"
                      class="icon"
                      aria-hidden="true"
                    ></lucide-icon>
                    Fortschritt
                  </h2>
                  <span class="m3-section-meta">7 Tage</span>
                </div>

                <div class="sparkline-wrap compact" aria-label="Gewichtstrend">
                  <svg viewBox="0 0 100 28" preserveAspectRatio="none" class="sparkline">
                    <polyline [attr.points]="weightSparklinePoints()" />
                  </svg>
                  <div class="trend-note">
                    Gewicht {{ weeklyTrendLabel() }} in den letzten 7 Tagen.
                  </div>
                </div>

                <div class="trend-inline-list">
                  <div class="trend-inline-row">
                    <span>Gewicht</span>
                    <strong>{{ weightValueLabel() }}</strong>
                    <small>{{ weightDeltaLabel() }}</small>
                  </div>
                  @if (trackStepsEnabled()) {
                    <div class="trend-inline-row">
                      <span>Schritte</span>
                      <strong>{{ stepsValueLabel() }}</strong>
                      <small>{{ stepsGoalLabel() }}</small>
                    </div>
                  }
                </div>
              </section>
            }
          }
        }
      </div>
    </main>

    <app-bottom-sheet [open]="showActionSheet()" [title]="sheetTitle()" (closed)="closeActions()">
      @if (sheetMode() === 'menu') {
        <section class="quick-add-menu">
          <button type="button" class="quick-add-hero" (click)="openFoodQuickLog()">
            <span class="quick-add-hero-copy">
              <span class="quick-add-kicker">Nutrition</span>
              <strong>Essen hinzufügen</strong>
              <small>Suche, Recents und Builder öffnen.</small>
            </span>
            <span class="quick-add-icon food"
              ><lucide-icon [img]="icons.utensils" aria-hidden="true"></lucide-icon
            ></span>
          </button>

          <div class="quick-add-utility-list" role="group" aria-label="Weitere Schnelllog-Aktionen">
            <button type="button" class="quick-add-utility" (click)="setSheetMode('gym')">
              <span class="quick-add-icon gym"
                ><lucide-icon [img]="icons.dumbbell" aria-hidden="true"></lucide-icon
              ></span>
              <span class="quick-add-copy">
                <strong>Gym-Session loggen</strong>
                <small>Training schnell eintragen.</small>
              </span>
            </button>

            <button type="button" class="quick-add-utility" (click)="setSheetMode('weight')">
              <span class="quick-add-icon weight"
                ><lucide-icon [img]="icons.weight" aria-hidden="true"></lucide-icon
              ></span>
              <span class="quick-add-copy">
                <strong>Gewicht loggen</strong>
                <small>Heutigen Messwert sichern.</small>
              </span>
            </button>

            @if (trackStepsEnabled()) {
              <button type="button" class="quick-add-utility" (click)="setSheetMode('steps')">
                <span class="quick-add-icon steps"
                  ><lucide-icon [img]="icons.footsteps" aria-hidden="true"></lucide-icon
                ></span>
                <span class="quick-add-copy">
                  <strong>Schritte hinzufügen</strong>
                  <small>Aktivität ergänzen.</small>
                </span>
              </button>
            } @else {
              <button type="button" class="quick-add-utility" (click)="setSheetMode('copy')">
                <span class="quick-add-icon copy"
                  ><lucide-icon [img]="icons.clock3" aria-hidden="true"></lucide-icon
                ></span>
                <span class="quick-add-copy">
                  <strong>Von gestern kopieren</strong>
                  <small>Einträge direkt übernehmen.</small>
                </span>
              </button>
            }
          </div>
        </section>
      }

      @if (sheetMode() === 'layout') {
        <section class="layout-sheet">
          <p class="sheet-caption">
            Ordne die unteren Heute-Abschnitte so, wie du sie am liebsten siehst.
          </p>

          <div class="layout-list">
            @for (
              section of layoutSectionRows();
              track section.id;
              let first = $first;
              let last = $last
            ) {
              <article class="layout-row">
                <div class="layout-copy">
                  <strong>{{ section.title }}</strong>
                  <small>{{ section.description }}</small>
                </div>

                <div class="layout-controls">
                  <button
                    mat-icon-button
                    type="button"
                    class="round-icon-btn"
                    [disabled]="first"
                    (click)="moveTodaySection(section.id, 'up')"
                    [attr.aria-label]="section.title + ' nach oben'"
                  >
                    <lucide-icon [img]="icons.chevronUp" aria-hidden="true"></lucide-icon>
                  </button>
                  <button
                    mat-icon-button
                    type="button"
                    class="round-icon-btn"
                    [disabled]="last"
                    (click)="moveTodaySection(section.id, 'down')"
                    [attr.aria-label]="section.title + ' nach unten'"
                  >
                    <lucide-icon [img]="icons.chevronDown" aria-hidden="true"></lucide-icon>
                  </button>
                </div>
              </article>
            }
          </div>

          <button
            mat-flat-button
            type="button"
            class="menu-btn apply-log-btn"
            [disabled]="savingTodayLayout()"
            (click)="saveTodaySectionOrder()"
          >
            {{ savingTodayLayout() ? 'Wird gespeichert …' : 'Reihenfolge speichern' }}
          </button>
        </section>
      }

      @if (sheetMode() === 'food') {
        <section class="food-sheet food-hub">
          <label class="food-search-shell" aria-label="Lebensmittel suchen">
            <input
              #foodSearchInput
              class="food-search-input"
              type="search"
              [ngModel]="foodSearch()"
              (ngModelChange)="onFoodSearchInput($event)"
              placeholder="Lebensmittel suchen"
              aria-label="Lebensmittel suchen"
            />
          </label>

          @if (!foodSearch().trim()) {
            <div class="food-hub-actions food-hub-actions-compact">
              <button type="button" class="food-tool-btn" (click)="setSheetMode('copy')">
                <span class="food-tool-kicker">Shortcut</span>
                <strong>Von gestern</strong>
              </button>
              <button type="button" class="food-tool-btn" (click)="setSheetMode('mealprep')">
                <span class="food-tool-kicker">Batch</span>
                <strong>Meal Prep</strong>
              </button>
            </div>
          }

          @if (canOfferIngredientQuickCreate()) {
            <div class="quick-create-block">
              @if (!showIngredientQuickCreate()) {
                <button
                  type="button"
                  class="quick-create-cta"
                  (click)="openIngredientQuickCreate()"
                >
                  Neue Zutat „{{ foodSearch().trim() }}“ anlegen
                </button>
              } @else {
                <form
                  class="quick-create-form"
                  [formGroup]="ingredientQuickCreateForm"
                  (ngSubmit)="saveQuickCreateIngredient()"
                >
                  <label class="quick-create-field quick-create-field-full">
                    <span>Name</span>
                    <input type="text" formControlName="name" placeholder="Name der Zutat" />
                  </label>

                  <div class="quick-create-grid">
                    <label class="quick-create-field">
                      <span>Kcal</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        formControlName="kcal_per_100"
                        placeholder="0"
                      />
                    </label>
                    <label class="quick-create-field">
                      <span>Protein</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        formControlName="protein_per_100"
                        placeholder="0"
                      />
                    </label>
                    <label class="quick-create-field">
                      <span>KH</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        formControlName="carbs_per_100"
                        placeholder="0"
                      />
                    </label>
                    <label class="quick-create-field">
                      <span>Fett</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        formControlName="fat_per_100"
                        placeholder="0"
                      />
                    </label>
                  </div>

                  <div class="quick-create-actions">
                    <button
                      type="button"
                      class="food-tool-btn"
                      (click)="resetIngredientQuickCreate()"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      class="quick-create-cta quick-create-cta-primary"
                      [disabled]="
                        ingredientQuickCreateForm.invalid || savingIngredientQuickCreate()
                      "
                    >
                      {{ savingIngredientQuickCreate() ? 'Wird erstellt …' : 'Zutat anlegen' }}
                    </button>
                  </div>
                </form>
              }
            </div>
          }

          <div class="sheet-subhead">
            <div>
              <p class="sheet-kicker">{{ foodSearch().trim() ? 'Treffer' : 'Zuletzt genutzt' }}</p>
            </div>
            <button type="button" class="sheet-link-btn" (click)="openFoodBuilder('all')">
              Alle Lebensmittel
            </button>
          </div>

          <div class="food-list hub-food-list">
            @for (item of foodHubItems(); track item.id) {
              <article class="food-row">
                <button
                  type="button"
                  class="food-open-btn"
                  (click)="openAmountPicker(item, 'queue')"
                >
                  <span class="food-name">{{ item.name }}</span>
                  <small class="food-macros">{{ quickItemMacroLine(item) }}</small>
                </button>
                <div class="food-row-actions">
                  <button
                    type="button"
                    class="round-icon-btn primary"
                    (click)="addDefaultToQueue(item)"
                    aria-label="Zur Log-Liste hinzufügen"
                  >
                    <lucide-icon [img]="icons.plus" aria-hidden="true"></lucide-icon>
                  </button>
                </div>
              </article>
            }
            @if (foodHubItems().length === 0) {
              <p class="muted">
                {{
                  foodSearch().trim()
                    ? 'Keine Treffer für deine Suche.'
                    : 'Noch keine zuletzt genutzten Lebensmittel.'
                }}
              </p>
            }
          </div>

          @if (foodQueueCount() > 0) {
            <article class="queue-preview-card">
              <div>
                <p class="sheet-kicker">Log-Liste</p>
                <strong>{{ foodQueueCount() }} Einträge bereit</strong>
                <small
                  >P {{ queueTotals().protein.toFixed(0) }} · KH
                  {{ queueTotals().carbs.toFixed(0) }} · F {{ queueTotals().fat.toFixed(0) }} ·
                  {{ queueTotals().kcal.toFixed(0) }} kcal</small
                >
              </div>
              <div class="queue-preview-actions">
                <button type="button" class="food-tool-btn" (click)="openFoodBuilder()">
                  Bearbeiten
                </button>
                <button type="button" class="menu-btn apply-log-btn" (click)="applyFoodQueue()">
                  Loggen
                </button>
              </div>
            </article>
          }
        </section>
      }

      @if (sheetMode() === 'builder') {
        <section class="food-sheet meal-builder-sheet">
          <div class="utility-row">
            <button type="button" class="food-tool-btn" (click)="setSheetMode('food')">
              Zurück zum Hub
            </button>
            <button type="button" class="food-tool-btn" (click)="setSheetMode('mealprep')">
              Meal Prep
            </button>
          </div>

          <label class="food-search-shell" aria-label="Lebensmittel suchen">
            <input
              class="food-search-input"
              type="search"
              [ngModel]="foodSearch()"
              (ngModelChange)="onFoodSearchInput($event)"
              placeholder="Lebensmittel suchen"
              aria-label="Lebensmittel suchen"
            />
          </label>

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

          <div class="filter-toggle compact-filter" role="group" aria-label="Food Filter">
            <button
              type="button"
              class="filter-btn"
              [class.active]="foodFilter() === 'recent'"
              (click)="setFoodFilter('recent')"
            >
              Zuletzt
            </button>
            <button
              type="button"
              class="filter-btn"
              [class.active]="foodFilter() === 'favorites'"
              (click)="setFoodFilter('favorites')"
            >
              Favoriten
            </button>
            <button
              type="button"
              class="filter-btn"
              [class.active]="foodFilter() === 'all'"
              (click)="setFoodFilter('all')"
            >
              Alle
            </button>
          </div>

          @if (canOfferIngredientQuickCreate()) {
            <div class="quick-create-block">
              @if (!showIngredientQuickCreate()) {
                <button
                  type="button"
                  class="quick-create-cta"
                  (click)="openIngredientQuickCreate()"
                >
                  Neue Zutat „{{ foodSearch().trim() }}“ anlegen
                </button>
              } @else {
                <form
                  class="quick-create-form"
                  [formGroup]="ingredientQuickCreateForm"
                  (ngSubmit)="saveQuickCreateIngredient()"
                >
                  <label class="quick-create-field quick-create-field-full">
                    <span>Name</span>
                    <input type="text" formControlName="name" placeholder="Name der Zutat" />
                  </label>

                  <div class="quick-create-grid">
                    <label class="quick-create-field">
                      <span>Kcal</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        formControlName="kcal_per_100"
                        placeholder="0"
                      />
                    </label>
                    <label class="quick-create-field">
                      <span>Protein</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        formControlName="protein_per_100"
                        placeholder="0"
                      />
                    </label>
                    <label class="quick-create-field">
                      <span>KH</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        formControlName="carbs_per_100"
                        placeholder="0"
                      />
                    </label>
                    <label class="quick-create-field">
                      <span>Fett</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        formControlName="fat_per_100"
                        placeholder="0"
                      />
                    </label>
                  </div>

                  <div class="quick-create-actions">
                    <button
                      type="button"
                      class="food-tool-btn"
                      (click)="resetIngredientQuickCreate()"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      class="quick-create-cta quick-create-cta-primary"
                      [disabled]="
                        ingredientQuickCreateForm.invalid || savingIngredientQuickCreate()
                      "
                    >
                      {{ savingIngredientQuickCreate() ? 'Wird erstellt …' : 'Zutat anlegen' }}
                    </button>
                  </div>
                </form>
              }
            </div>
          }

          <div class="food-list">
            @for (item of quickFoodItems(); track item.id) {
              <article class="food-row">
                <button
                  type="button"
                  class="food-open-btn"
                  (click)="openAmountPicker(item, 'queue')"
                >
                  <span class="food-name">{{ item.name }}</span>
                  <small class="food-macros">{{ quickItemMacroLine(item) }}</small>
                </button>
                <div class="food-row-actions">
                  <button
                    type="button"
                    class="round-icon-btn"
                    (click)="toggleFavoriteFood(item.id)"
                    [attr.aria-label]="
                      isFavoriteFood(item.id) ? 'Favorit entfernen' : 'Als Favorit speichern'
                    "
                  >
                    <lucide-icon
                      [img]="icons.star"
                      [class.is-favorite]="isFavoriteFood(item.id)"
                      aria-hidden="true"
                    ></lucide-icon>
                  </button>
                  <button
                    type="button"
                    class="round-icon-btn primary"
                    (click)="addDefaultToQueue(item)"
                    aria-label="Zur Log-Liste hinzufügen"
                  >
                    <lucide-icon [img]="icons.plus" aria-hidden="true"></lucide-icon>
                  </button>
                </div>
              </article>
            }
            @if (quickFoodItems().length === 0) {
              <p class="muted">
                {{
                  foodSearch().trim()
                    ? 'Keine Treffer für deine Suche.'
                    : 'Keine Lebensmittel für diesen Filter.'
                }}
              </p>
            }
          </div>

          <div class="queue-list">
            @if (foodQueueCount() > 0) {
              <div class="queue-head-row">
                <p class="queue-head">Log-Liste ({{ foodQueueCount() }})</p>
                <button
                  type="button"
                  class="food-tool-btn queue-clear-btn"
                  (click)="clearFoodQueue()"
                >
                  Leeren
                </button>
              </div>
            }
            @for (item of foodQueue(); track item.id) {
              <article class="queue-item">
                <div class="queue-main">
                  <strong>{{ item.name }}</strong>
                  <small
                    >P {{ item.totals.protein.toFixed(1) }} · KH
                    {{ item.totals.carbs.toFixed(1) }} · F {{ item.totals.fat.toFixed(1) }} ·
                    {{ item.totals.kcal.toFixed(0) }} kcal</small
                  >
                </div>
                <div class="queue-controls">
                  <mat-form-field
                    class="m3-field queue-amount-field"
                    appearance="outline"
                    subscriptSizing="dynamic"
                  >
                    <mat-label>{{ queueUnitLabel(item) }}</mat-label>
                    <input
                      matInput
                      type="number"
                      min="0.1"
                      step="0.1"
                      [ngModel]="item.amount"
                      (ngModelChange)="onQueueAmountChange(item.id, $event)"
                    />
                  </mat-form-field>
                  <button
                    type="button"
                    class="round-icon-btn"
                    (click)="removeFoodQueueItem(item.id)"
                    aria-label="Aus Log-Liste entfernen"
                  >
                    <lucide-icon [img]="icons.trash" aria-hidden="true"></lucide-icon>
                  </button>
                </div>
              </article>
            }

            @if (foodQueueCount() === 0) {
              <p class="muted">
                Suche ein Lebensmittel und tippe auf +, um es zur Log-Liste hinzuzufügen.
              </p>
            }
          </div>

          @if (foodQueueCount() > 0) {
            <div class="food-footer">
              <div class="queue-total">
                <small
                  >P {{ queueTotals().protein.toFixed(0) }} · KH
                  {{ queueTotals().carbs.toFixed(0) }} · F {{ queueTotals().fat.toFixed(0) }}</small
                >
                <strong>{{ queueTotals().kcal.toFixed(0) }} kcal</strong>
              </div>
              <button
                mat-flat-button
                type="button"
                class="menu-btn apply-log-btn"
                (click)="applyFoodQueue()"
              >
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
            <input
              matInput
              type="date"
              [ngModel]="copySourceDay()"
              (ngModelChange)="onCopySourceDayChange($event)"
            />
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
                  />
                  <span class="selection-copy">
                    <strong>{{ entryName(entry) }}</strong>
                    <small
                      >{{ entry.quantity
                      }}{{ entry.entry_type === 'ingredient' ? 'g' : ' Portionen' }} ·
                      {{ entryMacroSummary(entry) }}</small
                    >
                  </span>
                </label>
              }
            </div>
          } @else {
            <p class="muted">An diesem Tag gibt es keine Einträge zum Übernehmen.</p>
          }

          <button
            mat-flat-button
            type="button"
            class="menu-btn apply-log-btn"
            [disabled]="copySelectedEntryIds().length === 0"
            (click)="applyCopiedEntries()"
          >
            In {{ today() }} übernehmen
          </button>
        </section>
      }

      @if (sheetMode() === 'mealprep') {
        <section class="mealprep-sheet">
          <div class="grid-two">
            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Von</mat-label>
              <input
                matInput
                type="date"
                [ngModel]="mealPrepStartDay()"
                (ngModelChange)="mealPrepStartDay.set($event)"
              />
            </mat-form-field>

            <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
              <mat-label>Bis</mat-label>
              <input
                matInput
                type="date"
                [ngModel]="mealPrepEndDay()"
                (ngModelChange)="mealPrepEndDay.set($event)"
              />
            </mat-form-field>
          </div>

          <p class="range-copy">
            Aufteilen in {{ mealPrepRangeCount() }} Tage ({{ mealPrepStartDay() }} -
            {{ mealPrepEndDay() }})
          </p>
          <p class="warning-copy">
            Aufgeteilte Einträge können nicht wieder zusammengeführt werden.
          </p>

          @if (todayEntries().length > 0) {
            <div class="selection-list">
              @for (entry of todayEntries(); track entry.id) {
                <label class="selection-row">
                  <input
                    type="checkbox"
                    [checked]="mealPrepSelectedEntryIds().includes(entry.id)"
                    (change)="toggleMealPrepEntrySelection(entry.id)"
                  />
                  <span class="selection-copy">
                    <strong>{{ entryName(entry) }}</strong>
                    <small
                      >{{ entry.quantity
                      }}{{ entry.entry_type === 'ingredient' ? 'g' : ' Portionen' }} ·
                      {{ entryMacroSummary(entry) }}</small
                    >
                  </span>
                </label>
              }
            </div>
          } @else {
            <p class="muted">Am aktuell gewählten Tag gibt es keine Einträge zum Aufteilen.</p>
          }

          <button
            mat-flat-button
            type="button"
            class="menu-btn apply-log-btn"
            [disabled]="mealPrepSelectedEntryIds().length === 0 || mealPrepRangeCount() <= 0"
            (click)="applyMealPrepDistribution()"
          >
            Aufteilen
          </button>
        </section>
      }

      @if (sheetMode() === 'weight') {
        <section class="weight-sheet">
          <div class="weight-actions">
            <button mat-flat-button type="button" class="day-chip" (click)="setWeightDateToToday()">
              Heute
            </button>
            <button mat-flat-button type="button" class="day-chip" (click)="setSheetMode('menu')">
              Anderes loggen
            </button>
          </div>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Datum</mat-label>
            <input
              matInput
              id="weight-day-input"
              type="date"
              [attr.max]="realToday"
              [(ngModel)]="weightDateInput"
            />
          </mat-form-field>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Gewicht (kg)</mat-label>
            <input
              matInput
              id="weight-input"
              type="number"
              min="20"
              step="0.1"
              [(ngModel)]="weightInput"
            />
          </mat-form-field>

          <button
            mat-flat-button
            type="button"
            class="menu-btn apply-log-btn"
            (click)="saveWeight()"
          >
            Gewicht speichern
          </button>
        </section>
      }

      @if (sheetMode() === 'steps') {
        <section class="weight-sheet">
          <div class="weight-actions">
            <button mat-flat-button type="button" class="day-chip" (click)="setStepsDateToToday()">
              Heute
            </button>
            <button mat-flat-button type="button" class="day-chip" (click)="setSheetMode('menu')">
              Anderes loggen
            </button>
          </div>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Datum</mat-label>
            <input matInput id="steps-day-input" type="date" [(ngModel)]="stepsDateInput" />
          </mat-form-field>

          <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
            <mat-label>Schritte</mat-label>
            <input
              matInput
              id="steps-input"
              type="number"
              min="0"
              step="1"
              [(ngModel)]="stepsInput"
            />
          </mat-form-field>

          <button
            mat-flat-button
            type="button"
            class="menu-btn apply-log-btn"
            (click)="saveSteps()"
          >
            Schritte speichern
          </button>
        </section>
      }

      @if (sheetMode() === 'gym') {
        <mat-form-field class="m3-field" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Notiz (optional)</mat-label>
          <textarea
            matInput
            id="gym-note-input"
            rows="3"
            [(ngModel)]="gymNote"
            placeholder="Was lief heute gut?"
          ></textarea>
        </mat-form-field>

        <p class="file-label">Foto (optional)</p>
        <div class="file-row">
          <button mat-flat-button type="button" class="menu-btn compact" (click)="pickGymPhoto()">
            Foto auswählen
          </button>
          <span class="file-name">{{ gymPhotoName() || 'Kein Foto ausgewählt' }}</span>
        </div>
        <input
          #gymPhotoInput
          id="gym-photo-input"
          class="sr-only"
          type="file"
          accept="image/*"
          (change)="onGymPhotoSelected($event)"
        />

        <button
          mat-flat-button
          type="button"
          class="menu-btn"
          [disabled]="savingGymPost()"
          (click)="submitGymPost()"
        >
          {{ savingGymPost() ? 'Wird geteilt …' : 'Gym-Check-in teilen' }}
        </button>
      }

      @if (sheetMode() === 'entry') {
        @if (selectedEntryForActions()) {
          <article class="entry-action-card">
            <p class="entry-action-title">{{ entryName(selectedEntryForActions()!) }}</p>
            <p class="entry-action-sub">
              {{ selectedEntryForActions()!.quantity
              }}{{ selectedEntryForActions()!.entry_type === 'ingredient' ? 'g' : ' Portionen' }} •
              {{ selectedEntryForActions()!.kcal.toFixed(0) }} kcal
            </p>
          </article>
          <div class="action-list">
            <button mat-flat-button type="button" class="menu-btn" (click)="editSelectedEntry()">
              Bearbeiten
            </button>
            <button
              mat-flat-button
              type="button"
              class="menu-btn danger-outline"
              (click)="deleteSelectedEntry()"
            >
              Löschen
            </button>
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
  styles: [],
})
export class TodayComponent implements OnInit {
  readonly icons = {
    calendar: Calendar,
    chevronDown: ChevronDown,
    chevronLeft: ChevronLeft,
    chevronRight: ChevronRight,
    chevronUp: ChevronUp,
    weight: Weight,
    chartLine: ChartLine,
    listChecks: ListChecks,
    clock3: Clock3,
    plus: Plus,
    utensils: Utensils,
    dumbbell: Dumbbell,
    footsteps: Footprints,
    star: Star,
    trash: Trash2,
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
  readonly gymDaysWindow = signal<Set<string>>(new Set<string>());
  readonly proteinDaysWindow = signal<Set<string>>(new Set<string>());
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
  readonly savingTodayLayout = signal(false);

  readonly showActionSheet = signal(false);
  readonly sheetMode = signal<
    | 'menu'
    | 'food'
    | 'builder'
    | 'copy'
    | 'mealprep'
    | 'weight'
    | 'steps'
    | 'gym'
    | 'entry'
    | 'layout'
  >('menu');
  readonly foodSearch = signal('');
  readonly recentFoodRefs = signal<FoodRecentRef[]>([]);
  readonly savingGymPost = signal(false);
  readonly savingIngredientQuickCreate = signal(false);
  readonly gymPhotoName = signal<string | null>(null);
  readonly selectedEntryForActions = signal<LogEntry | null>(null);
  readonly todaySectionOrderDraft = signal<TodaySectionId[]>([...TODAY_SECTION_ORDER_DEFAULT]);
  readonly showIngredientQuickCreate = signal(false);
  readonly gymPhotoInput = viewChild<ElementRef<HTMLInputElement>>('gymPhotoInput');
  readonly dayPickerInput = viewChild<ElementRef<HTMLInputElement>>('dayPickerInput');

  readonly realToday = this.formatDate(new Date());
  readonly today = signal(this.realToday);
  readonly selectedDayDisplay = computed(() =>
    this.parseIsoDate(this.today()).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  );
  readonly foodFilter = signal<FoodFilter>('recent');
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
  private readonly formBuilder = inject(FormBuilder);
  private readonly queryCache = inject(QueryCacheService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly telemetry = inject(InteractionTelemetryService);
  private readonly communityFeed = inject(CommunityFeedService);
  readonly ingredientQuickCreateForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required]],
    kcal_per_100: [0, [Validators.required]],
    protein_per_100: [0, [Validators.required]],
    carbs_per_100: [0, [Validators.required]],
    fat_per_100: [0, [Validators.required]],
  });

  readonly proteinToday = computed(() => Math.round(Number(this.summary()?.protein || 0)));
  readonly proteinRemaining = computed(() => Math.max(this.proteinGoal - this.proteinToday(), 0));
  readonly fatToday = computed(() => Math.round(Number(this.summary()?.fat || 0)));
  readonly carbsToday = computed(() => Math.round(Number(this.summary()?.carbs || 0)));
  readonly caloriesToday = computed(() => Math.round(Number(this.summary()?.kcal || 0)));
  readonly proteinMilestonePosted = signal(false);
  readonly stepsMilestonePosted = signal(false);

  readonly todayEntries = computed(() => this.entries());
  readonly recentWeightEntries = computed(() => this.weightLogs().slice(0, 7));
  readonly trendWeightEntries = computed(() => this.weightLogs().slice(0, this.weightTrendDays()));
  readonly brooBoardPosts = computed<BrooBoardPost[]>(() =>
    this.brooPosts().map((post) => ({
      post,
      displayName: this.brooProfiles()[post.user_id]?.display_name || 'Broo',
      avatarUrl: this.brooProfiles()[post.user_id]?.avatar_url || null,
      photoUrl: this.brooPhotoSrcMap()[post.id] || null,
    })),
  );

  readonly orderedTodaySections = computed<TodaySectionId[]>(() =>
    this.normalizeTodaySectionOrder(this.profile()?.today_section_order),
  );

  readonly layoutSectionRows = computed(() =>
    this.todaySectionOrderDraft().map((sectionId) => ({
      id: sectionId,
      title: this.todaySectionTitle(sectionId),
      description: this.todaySectionDescription(sectionId),
    })),
  );

  readonly selectedDayWeight = computed(
    () => this.weightLogs().find((entry) => entry.logged_on === this.today()) || null,
  );
  readonly selectedDaySteps = computed(
    () => this.stepLogs().find((entry) => entry.logged_on === this.today()) || null,
  );
  readonly trackStepsEnabled = computed(() => Boolean(this.profile()?.track_steps));
  readonly stepsGoal = computed(() => Number(this.profile()?.daily_steps_target || 8000));

  readonly previousWeightForDay = computed(() => {
    const day = this.today();
    return this.weightLogs().find((entry) => entry.logged_on < day) || null;
  });

  readonly weightSparklinePoints = computed(() => {
    const points = [...this.trendWeightEntries()].reverse();
    if (points.length === 0) {
      return '0,24 100,24';
    }

    const values = points.map((entry) => Number(entry.weight_kg));
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

  readonly allFoodItems = computed(() =>
    Array.from(
      new Map(
        [...this.ingredients(), ...this.meals()].map((item) => [this.foodKeyForItem(item), item]),
      ).values(),
    ),
  );

  readonly recentFoodKeyOrder = computed(() =>
    this.recentFoodRefs().map((item) => this.foodKey(item.itemType, item.itemId)),
  );

  readonly recentFoodKeyIndex = computed(() =>
    this.recentFoodRefs().reduce<Map<string, number>>((index, item, position) => {
      index.set(this.foodKey(item.itemType, item.itemId), position);
      return index;
    }, new Map<string, number>()),
  );

  readonly recentFoodItems = computed(() => {
    const itemMap = new Map(this.allFoodItems().map((item) => [this.foodKeyForItem(item), item]));
    return this.recentFoodRefs()
      .map((item) => itemMap.get(this.foodKey(item.itemType, item.itemId)) || null)
      .filter((item): item is QuickItem => Boolean(item));
  });

  readonly foodSearchResults = computed(() => {
    const query = this.foodSearch().trim().toLowerCase();
    if (!query) {
      return [];
    }

    const favorites = new Set(this.favoriteFoodIds());
    const recentIndex = this.recentFoodKeyIndex();

    return this.allFoodItems()
      .filter((item) => item.name.toLowerCase().includes(query))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aExact = aName === query ? 1 : 0;
        const bExact = bName === query ? 1 : 0;
        if (aExact !== bExact) {
          return bExact - aExact;
        }

        const aStarts = aName.startsWith(query) ? 1 : 0;
        const bStarts = bName.startsWith(query) ? 1 : 0;
        if (aStarts !== bStarts) {
          return bStarts - aStarts;
        }

        const aFavorite = favorites.has(a.id) ? 1 : 0;
        const bFavorite = favorites.has(b.id) ? 1 : 0;
        if (aFavorite !== bFavorite) {
          return bFavorite - aFavorite;
        }

        const aRecentIndex = recentIndex.get(this.foodKeyForItem(a)) ?? Number.MAX_SAFE_INTEGER;
        const bRecentIndex = recentIndex.get(this.foodKeyForItem(b)) ?? Number.MAX_SAFE_INTEGER;
        if (aRecentIndex !== bRecentIndex) {
          return aRecentIndex - bRecentIndex;
        }

        return a.name.localeCompare(b.name, 'de-DE');
      })
      .slice(0, 24);
  });

  readonly quickFoodItems = computed(() => {
    const query = this.foodSearch().trim();
    if (query.length > 0) {
      return this.foodSearchResults();
    }

    const requestedFilter = this.foodFilter();
    const favorites = new Set(this.favoriteFoodIds());
    const recentKeys = new Set(this.recentFoodKeyOrder());
    const filter: FoodFilter =
      requestedFilter === 'recent' && recentKeys.size === 0
        ? favorites.size > 0
          ? 'favorites'
          : 'all'
        : requestedFilter;

    return this.allFoodItems()
      .filter((item) => {
        const key = this.foodKeyForItem(item);
        if (filter === 'favorites' && !favorites.has(item.id)) {
          return false;
        }
        if (filter === 'recent' && !recentKeys.has(key)) {
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

        const aRecentIndex =
          this.recentFoodKeyIndex().get(this.foodKeyForItem(a)) ?? Number.MAX_SAFE_INTEGER;
        const bRecentIndex =
          this.recentFoodKeyIndex().get(this.foodKeyForItem(b)) ?? Number.MAX_SAFE_INTEGER;
        if (aRecentIndex !== bRecentIndex) {
          return aRecentIndex - bRecentIndex;
        }

        return a.name.localeCompare(b.name, 'de-DE');
      })
      .slice(0, 24);
  });

  readonly favoriteQuickItems = computed(() => {
    const favorites = new Set(this.favoriteFoodIds());
    return this.allFoodItems()
      .filter((item) => favorites.has(item.id))
      .slice(0, 8);
  });

  readonly foodHubItems = computed(() =>
    (this.foodSearch().trim().length > 0 ? this.foodSearchResults() : this.recentFoodItems()).slice(
      0,
      12,
    ),
  );

  readonly canOfferIngredientQuickCreate = computed(() => {
    const query = this.foodSearch().trim();
    if (query.length < 2) {
      return false;
    }

    const normalizedQuery = this.normalizeFoodName(query);
    return !this.allFoodItems().some(
      (item) => this.normalizeFoodName(item.name) === normalizedQuery,
    );
  });

  readonly queueTotals = computed<MacroTotals>(() => {
    return this.foodQueue().reduce<MacroTotals>(
      (acc, item) => ({
        kcal: acc.kcal + item.totals.kcal,
        protein: acc.protein + item.totals.protein,
        carbs: acc.carbs + item.totals.carbs,
        fat: acc.fat + item.totals.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
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
    const dayIndex = states.length - 1;
    if (this.proteinToday() >= this.proteinGoal && dayIndex >= 0 && dayIndex < states.length) {
      states[dayIndex] = 'complete';
    }
    return states;
  });
  readonly canGoNextDay = computed(() => this.today() !== this.realToday);
  readonly foodQueueCount = computed(() => this.foodQueue().length);
  readonly canShareProteinMilestone = computed(
    () => this.proteinToday() >= this.proteinGoal && !this.proteinMilestonePosted(),
  );
  readonly canShareStepsMilestone = computed(
    () =>
      this.trackStepsEnabled() &&
      Number(this.selectedDaySteps()?.steps || 0) >= this.stepsGoal() &&
      !this.stepsMilestonePosted(),
  );
  readonly copySourceDay = signal(this.realToday);
  readonly copySourceEntries = signal<LogEntry[]>([]);
  readonly copySelectedEntryIds = signal<string[]>([]);
  readonly loadingCopySourceEntries = signal(false);
  readonly mealPrepStartDay = signal(this.realToday);
  readonly mealPrepEndDay = signal(this.realToday);
  readonly mealPrepSelectedEntryIds = signal<string[]>([]);
  readonly selectedMealPrepEntries = computed(() =>
    this.todayEntries().filter((entry) => this.mealPrepSelectedEntryIds().includes(entry.id)),
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
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const quickMode = params.get('quick');
      if (!quickMode) {
        return;
      }
      if (quickMode === 'food') {
        this.openFoodQuickLog();
      } else {
        this.openActions();
      }
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { quick: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });
    void this.loadInitialData();
  }

  async loadInitialData(forceRefresh = false): Promise<void> {
    await this.ensureLibraryLoaded();
    await Promise.all([this.loadTodaySnapshot(forceRefresh), this.loadBrooBoard()]);
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
        loader: () => this.fetchDaySnapshot(user.id, day, weekRange.start, weekRange.end),
      });

      this.entries.set(dayResult.value.entries);
      this.summary.set(dayResult.value.summary);
      this.profile.set(this.normalizeTodayProfile(dayResult.value.profile));
      this.weightLogs.set(dayResult.value.weightLogs);
      this.stepLogs.set(dayResult.value.stepLogs);
      this.gymDaysThisWeek.set(new Set(dayResult.value.gymDaysThisWeek));
      this.proteinDaysThisWeek.set(new Set(dayResult.value.proteinDaysThisWeek));
      this.gymDaysWindow.set(new Set(dayResult.value.gymDaysWindow));
      this.proteinDaysWindow.set(new Set(dayResult.value.proteinDaysWindow));
      this.proteinMilestonePosted.set(dayResult.value.proteinMilestonePosted);
      this.stepsMilestonePosted.set(dayResult.value.stepsMilestonePosted);
      this.recentFoodRefs.set(dayResult.value.recentFoodRefs);

      const selectedWeight = this.weightLogs().find((entry) => entry.logged_on === day);
      this.weightInput = Number(selectedWeight?.weight_kg || this.weightInput);
      this.weightDateInput = day;
      const selectedSteps = this.stepLogs().find((entry) => entry.logged_on === day);
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

  openDayPicker(): void {
    const input = this.dayPickerInput()?.nativeElement;
    if (!input) {
      return;
    }

    if ('showPicker' in input && typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.click();
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
    this.resetIngredientQuickCreate();
    this.setSheetMode('food');
  }

  openLayoutSheet(): void {
    this.todaySectionOrderDraft.set([...this.orderedTodaySections()]);
    this.showActionSheet.set(true);
    this.setSheetMode('layout');
  }

  openGymCheckInComposer(): void {
    this.showActionSheet.set(true);
    this.setSheetMode('gym');
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
    this.resetIngredientQuickCreate();
    this.selectedEntryForActions.set(null);
    this.todaySectionOrderDraft.set([...this.orderedTodaySections()]);
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

  setSheetMode(
    mode:
      | 'menu'
      | 'food'
      | 'builder'
      | 'copy'
      | 'mealprep'
      | 'weight'
      | 'steps'
      | 'gym'
      | 'entry'
      | 'layout',
  ): void {
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
      if (mode === 'food') {
        this.foodSearch.set('');
        this.foodFilter.set('recent');
        this.resetIngredientQuickCreate();
      }
    }
    if (mode === 'copy') {
      const defaultSourceDay = this.shiftIsoDay(this.today(), -1);
      this.copySourceDay.set(defaultSourceDay);
      this.copySelectedEntryIds.set([]);
      void this.loadCopySourceEntries(defaultSourceDay);
    }
    if (mode === 'mealprep') {
      this.mealPrepSelectedEntryIds.set(this.todayEntries().map((entry) => entry.id));
      this.mealPrepStartDay.set(this.today());
      this.mealPrepEndDay.set(this.shiftIsoDay(this.today(), 2));
    }
    if (mode === 'weight') {
      this.startWeightJourney('sheet_mode');
      this.weightDateInput = this.today();
      const selected = this.weightLogs().find((entry) => entry.logged_on === this.today());
      if (selected) {
        this.weightInput = Number(selected.weight_kg);
      }
    }
    if (mode === 'steps') {
      this.stepsDateInput = this.today();
      const selected = this.stepLogs().find((entry) => entry.logged_on === this.today());
      this.stepsInput = Number(selected?.steps || this.stepsGoal());
    }
    if (mode === 'layout') {
      this.todaySectionOrderDraft.set([...this.orderedTodaySections()]);
    }
  }

  sheetTitle(): string {
    if (this.sheetMode() === 'layout') return 'Heute anpassen';
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
    if (!value.trim()) {
      this.resetIngredientQuickCreate();
    }
  }

  openIngredientQuickCreate(): void {
    const query = this.foodSearch().trim();
    this.ingredientQuickCreateForm.reset({
      name: query,
      kcal_per_100: 0,
      protein_per_100: 0,
      carbs_per_100: 0,
      fat_per_100: 0,
    });
    this.showIngredientQuickCreate.set(true);
  }

  resetIngredientQuickCreate(): void {
    this.showIngredientQuickCreate.set(false);
    this.savingIngredientQuickCreate.set(false);
    this.ingredientQuickCreateForm.reset({
      name: '',
      kcal_per_100: 0,
      protein_per_100: 0,
      carbs_per_100: 0,
      fat_per_100: 0,
    });
  }

  openFoodBuilder(filter: FoodFilter = this.foodFilter()): void {
    this.foodFilter.set(filter);
    this.setSheetMode('builder');
  }

  async saveQuickCreateIngredient(): Promise<void> {
    const user = this.authService.user();
    if (!user || this.ingredientQuickCreateForm.invalid) {
      this.ingredientQuickCreateForm.markAllAsTouched();
      return;
    }

    const raw = this.ingredientQuickCreateForm.getRawValue();
    this.savingIngredientQuickCreate.set(true);
    this.errorMessage.set(null);

    try {
      const ingredient = await this.libraryDataService.createIngredient(user.id, {
        name: raw.name,
        kcal_per_100: Number(raw.kcal_per_100),
        protein_per_100: Number(raw.protein_per_100),
        carbs_per_100: Number(raw.carbs_per_100),
        fat_per_100: Number(raw.fat_per_100),
      });

      this.ingredients.update((current) => [
        ingredient,
        ...current.filter((item) => item.id !== ingredient.id),
      ]);
      this.foodSearch.set(ingredient.name);
      this.resetIngredientQuickCreate();
      this.successMessage.set('Zutat erstellt.');
      this.openAmountPicker(ingredient, 'queue');
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Zutat konnte nicht erstellt werden'));
    } finally {
      this.savingIngredientQuickCreate.set(false);
    }
  }

  moveTodaySection(sectionId: TodaySectionId, direction: 'up' | 'down'): void {
    this.todaySectionOrderDraft.update((current) => {
      const index = current.indexOf(sectionId);
      if (index < 0) {
        return current;
      }

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  async saveTodaySectionOrder(): Promise<void> {
    const user = this.authService.user();
    if (!user) {
      return;
    }

    this.savingTodayLayout.set(true);
    this.errorMessage.set(null);

    try {
      const nextOrder = this.normalizeTodaySectionOrder(this.todaySectionOrderDraft());
      const { error } = await this.supabaseService.client.from('profiles').upsert(
        {
          user_id: user.id,
          today_section_order: nextOrder,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) {
        throw error;
      }

      this.profile.update((current) =>
        current ? { ...current, today_section_order: nextOrder } : current,
      );
      this.queryCache.invalidatePrefix(`today:${user.id}:`);
      this.successMessage.set('Heute-Layout gespeichert.');
      this.closeActions();
      await this.loadTodaySnapshot(true);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Heute-Layout konnte nicht gespeichert werden'));
    } finally {
      this.savingTodayLayout.set(false);
    }
  }

  isFavoriteFood(itemId: string): boolean {
    return this.favoriteFoodIds().includes(itemId);
  }

  toggleFavoriteFood(itemId: string): void {
    this.favoriteFoodIds.update((current) => {
      const next = current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId];
      this.writeFavoriteFoodIds(next);
      return next;
    });
  }

  addDefaultToQueue(item: QuickItem): void {
    const amount = this.isIngredient(item) ? 100 : 1;
    this.addToFoodQueue(item, amount, this.scaledMacros(item, amount));
  }

  removeFoodQueueItem(queueId: string): void {
    this.foodQueue.update((current) => current.filter((item) => item.id !== queueId));
  }

  clearFoodQueue(): void {
    this.foodQueue.set([]);
  }

  onQueueAmountChange(queueId: string, value: string | number): void {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    this.foodQueue.update((current) =>
      current.map((item) => {
        if (item.id !== queueId) {
          return item;
        }

        const source = this.allFoodItems().find((entry) => entry.id === item.itemId);
        if (!source) {
          return item;
        }

        return {
          ...item,
          amount,
          totals: this.scaledMacros(source, amount),
        };
      }),
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
      created_at: this.buildFoodLogTimestamp(targetDay, index * 5),
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
      if (this.showActionSheet()) {
        this.closeActions();
      }
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
      await this.communityFeed.createStepsMilestonePost(
        user.id,
        this.today(),
        steps,
        this.stepsGoal(),
      );
      this.stepsMilestonePosted.set(true);
      this.successMessage.set('Schrittziel im Board geteilt.');
      if (this.showActionSheet()) {
        this.closeActions();
      }
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
    this.copySelectedEntryIds.update((current) =>
      current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId],
    );
  }

  async applyCopiedEntries(): Promise<void> {
    const user = this.authService.user();
    const targetDay = this.today();
    const sourceDay = this.copySourceDay();
    const selectedEntries = this.copySourceEntries().filter((entry) =>
      this.copySelectedEntryIds().includes(entry.id),
    );

    if (!user || selectedEntries.length === 0) {
      this.errorMessage.set('Wähle mindestens einen Eintrag zum Übernehmen.');
      return;
    }
    if (sourceDay === targetDay) {
      this.errorMessage.set('Quelle und Ziel müssen unterschiedlich sein.');
      return;
    }

    const payload = selectedEntries.map((entry, index) =>
      this.buildCopiedEntryPayload(entry, user.id, targetDay, index * 5),
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
    this.mealPrepSelectedEntryIds.update((current) =>
      current.includes(entryId) ? current.filter((id) => id !== entryId) : [...current, entryId],
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
        this.buildCopiedEntryPayload(entry, user.id, day, entryIndex * 60 + dayIndex * 5, {
          quantity: quantityParts[dayIndex],
          kcal: kcalParts[dayIndex],
          protein: proteinParts[dayIndex],
          carbs: carbsParts[dayIndex],
          fat: fatParts[dayIndex],
        }),
      );
    });

    const { error: insertError } = await this.supabaseService.client
      .from('log_entries')
      .insert(payload);
    if (insertError) {
      this.errorMessage.set(this.formatWriteError(insertError));
      return;
    }

    const { error: deleteError } = await this.supabaseService.client
      .from('log_entries')
      .delete()
      .in(
        'id',
        selectedEntries.map((entry) => entry.id),
      )
      .eq('owner_id', user.id);

    if (deleteError) {
      this.errorMessage.set(
        'Meal Prep wurde angelegt, aber die Originaleinträge konnten nicht entfernt werden. Bitte kurz prüfen.',
      );
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
      this.addToFoodQueue(item, result.amount, result.totals);
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
      fat: Number(result.totals.fat.toFixed(2)),
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
    const item =
      entry.entry_type === 'ingredient'
        ? this.ingredients().find((ingredient) => ingredient.id === entry.ref_id)
        : this.meals().find((meal) => meal.id === entry.ref_id);

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

    const { error } = await this.supabaseService.client.from('step_logs').upsert(
      {
        user_id: user.id,
        logged_on: this.stepsDateInput,
        steps: Math.round(steps),
        note: null,
      },
      { onConflict: 'user_id,logged_on' },
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
    const { error } = await this.supabaseService.client.from('weight_logs').upsert(
      {
        user_id: userId,
        logged_on: day,
        weight_kg: Number(weightKg.toFixed(1)),
        note: null,
      },
      { onConflict: 'user_id,logged_on' },
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
      await this.communityFeed.createGymCheckinPost(
        user.id,
        this.today(),
        this.gymNote,
        this.gymPhoto,
      );

      this.gymNote = '';
      this.gymPhoto = null;
      this.gymPhotoName.set(null);
      this.successMessage.set('Dein Gym-Check-in ist im Board.');
      this.closeActions();
      this.invalidateGymCaches(user.id, this.today());
      await Promise.all([this.loadTodaySnapshot(true), this.loadBrooBoard()]);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Gym-Check-in konnte nicht gepostet werden'));
    } finally {
      this.savingGymPost.set(false);
    }
  }

  getIngredientName(id: string): string {
    return this.ingredients().find((item) => item.id === id)?.name || 'Unbekannt';
  }

  getMealName(id: string): string {
    return this.meals().find((item) => item.id === id)?.name || 'Unbekannt';
  }

  entryName(entry: LogEntry): string {
    return entry.entry_type === 'ingredient'
      ? this.getIngredientName(entry.ref_id)
      : this.getMealName(entry.ref_id);
  }

  brooAvatarLabel(displayName: string): string {
    return displayName.trim().slice(0, 1).toUpperCase() || 'B';
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

  private normalizeTodayProfile(profile: Profile | null): Profile | null {
    if (!profile) {
      return profile;
    }

    return {
      ...profile,
      today_section_order: this.normalizeTodaySectionOrder(profile.today_section_order),
    };
  }

  private normalizeTodaySectionOrder(order: string[] | null | undefined): TodaySectionId[] {
    const values = Array.isArray(order)
      ? order.filter(
          (value): value is TodaySectionId =>
            value === 'logs' || value === 'habits' || value === 'trends',
        )
      : [];

    if (values.length !== TODAY_SECTION_ORDER_DEFAULT.length) {
      return [...TODAY_SECTION_ORDER_DEFAULT];
    }

    const unique = Array.from(new Set(values));
    if (unique.length !== TODAY_SECTION_ORDER_DEFAULT.length) {
      return [...TODAY_SECTION_ORDER_DEFAULT];
    }

    return unique;
  }

  private todaySectionTitle(sectionId: TodaySectionId): string {
    if (sectionId === 'logs') return 'Logs';
    if (sectionId === 'habits') return 'Gewohnheiten';
    return 'Fortschritt';
  }

  private todaySectionDescription(sectionId: TodaySectionId): string {
    if (sectionId === 'logs') return 'Alle heutigen Eintraege in einer flachen Liste.';
    if (sectionId === 'habits') return 'Dein Wochenrhythmus fuer Gym und Protein.';
    return 'Kurzer Blick auf Gewicht und Schritte.';
  }

  private async loadBrooBoard(): Promise<void> {
    this.loadingBrooBoard.set(true);
    try {
      const page = await this.communityFeed.fetchFeedPage(null, 5, { allowCachedFirstPage: false });
      this.brooPosts.set(page.posts);
      this.brooProfiles.set(page.profiles);
      this.brooPhotoSrcMap.set(page.photoSrcMap);
    } catch (error: unknown) {
      this.errorMessage.set(
        formatAppError(error, 'Die letzten Gruppen-Updates konnten nicht geladen werden'),
      );
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
      allowStaleOnError: true,
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
      this.errorMessage.set(
        formatAppError(error, 'Einträge vom gewählten Tag konnten nicht geladen werden'),
      );
      this.copySourceEntries.set([]);
    } finally {
      this.loadingCopySourceEntries.set(false);
    }
  }

  private async fetchLogEntriesForDay(userId: string, day: string): Promise<LogEntry[]> {
    const { data, error } = await this.supabaseService.client
      .from('log_entries')
      .select(
        'id,owner_id,group_id,day,entry_type,ref_id,quantity,kcal,protein,carbs,fat,created_at',
      )
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
    overrides?: Partial<Pick<LogEntry, 'quantity' | 'kcal' | 'protein' | 'carbs' | 'fat'>>,
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
      created_at: this.copyEntryTimestamp(entry, targetDay, offsetSeconds),
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

  private addToFoodQueue(item: QuickItem, amount: number, totals: MacroTotals): void {
    this.foodQueue.update((current) => [
      ...current,
      {
        id: this.makeLocalId(),
        itemId: item.id,
        itemType: this.isIngredient(item) ? 'ingredient' : 'meal',
        name: item.name,
        amount,
        totals,
      },
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
      fat: Number(base.fat) * factor,
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

  private foodKey(itemType: 'ingredient' | 'meal', itemId: string): string {
    return `${itemType}:${itemId}`;
  }

  private foodKeyForItem(item: QuickItem): string {
    return this.foodKey(this.isIngredient(item) ? 'ingredient' : 'meal', item.id);
  }

  private normalizeFoodName(value: string): string {
    return value.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
  }

  private buildHistoricalRecentFoodRefs(
    entries: Pick<LogEntry, 'entry_type' | 'ref_id' | 'created_at'>[],
  ): FoodRecentRef[] {
    const seen = new Set<string>();
    const refs: FoodRecentRef[] = [];

    for (const entry of entries) {
      const key = this.foodKey(entry.entry_type, entry.ref_id);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      refs.push({
        itemId: entry.ref_id,
        itemType: entry.entry_type,
        lastLoggedAt: entry.created_at,
      });
    }

    return refs.slice(0, 24);
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

    for (const day of new Set(
      days
        .map((value) => this.normalizeDateInput(value))
        .filter((value): value is string => Boolean(value)),
    )) {
      this.queryCache.invalidate(this.getProteinMilestoneCacheKey(userId, day));
    }
  }

  private invalidateGymCaches(userId: string, day: string): void {
    this.invalidateSnapshotWeeksForDays(userId, [day]);
  }

  private invalidateSnapshotWeeksForDays(userId: string, days: string[]): void {
    const normalizedDays = [
      ...new Set(
        days
          .map((value) => this.normalizeDateInput(value))
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    for (const day of normalizedDays) {
      const weekRange = this.getWeekRangeForDay(day);
      for (const snapshotDay of this.getIsoDayRange(weekRange.start, weekRange.end)) {
        this.queryCache.invalidate(
          this.getTodayCacheKey(userId, snapshotDay, weekRange.start, weekRange.end),
        );
      }
    }
  }

  private getTodayCacheKey(
    userId: string,
    day: string,
    weekStart: string,
    weekEnd: string,
  ): string {
    return `today:${userId}:${day}:${weekStart}:${weekEnd}`;
  }

  private getProteinMilestoneCacheKey(userId: string, day: string): string {
    return `protein-posted:${userId}:${day}`;
  }

  private getStepsMilestoneCacheKey(userId: string, day: string): string {
    return `steps-posted:${userId}:${day}`;
  }

  private async fetchDaySnapshot(
    userId: string,
    day: string,
    weekStart: string,
    weekEnd: string,
  ): Promise<TodaySnapshot> {
    const habitWindowStart = this.shiftIsoDay(day, -29);
    const [
      { data: entryData, error: entryError },
      { data: summaryData, error: summaryError },
      { data: weightData, error: weightError },
      { data: stepData, error: stepError },
      { data: gymPostsData, error: gymPostsError },
      { data: proteinSummaryData, error: proteinSummaryError },
      { data: gymWindowData, error: gymWindowError },
      { data: proteinWindowData, error: proteinWindowError },
      { data: recentFoodData, error: recentFoodError },
      { data: proteinPostData, error: proteinPostError },
      { data: stepsPostData, error: stepsPostError },
      { data: profileData, error: profileError },
    ] = await Promise.all([
      this.supabaseService.client
        .from('log_entries')
        .select(
          'id,owner_id,group_id,day,entry_type,ref_id,quantity,kcal,protein,carbs,fat,created_at',
        )
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
        .select('day')
        .eq('user_id', userId)
        .eq('post_type', 'gym_checkin')
        .gte('day', habitWindowStart)
        .lte('day', day),
      this.supabaseService.client
        .from('daily_summaries')
        .select('day,protein')
        .eq('owner_id', userId)
        .is('group_id', null)
        .gte('day', habitWindowStart)
        .lte('day', day),
      this.supabaseService.client
        .from('log_entries')
        .select('entry_type,ref_id,created_at')
        .eq('owner_id', userId)
        .is('group_id', null)
        .order('created_at', { ascending: false })
        .limit(120),
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
      this.supabaseService.client.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    if (
      entryError ||
      summaryError ||
      weightError ||
      stepError ||
      gymPostsError ||
      proteinSummaryError ||
      gymWindowError ||
      proteinWindowError ||
      recentFoodError ||
      proteinPostError ||
      stepsPostError ||
      profileError
    ) {
      throw (
        entryError ||
        summaryError ||
        weightError ||
        stepError ||
        gymPostsError ||
        proteinSummaryError ||
        gymWindowError ||
        proteinWindowError ||
        recentFoodError ||
        proteinPostError ||
        stepsPostError ||
        profileError
      );
    }

    return {
      entries: (entryData || []) as LogEntry[],
      summary: (summaryData as DailySummary | null) || null,
      weightLogs: (weightData || []) as WeightLog[],
      stepLogs: (stepData || []) as StepLog[],
      gymDaysThisWeek: (gymPostsData || []).map((row) => String(row.day)),
      proteinDaysThisWeek: (proteinSummaryData || [])
        .filter((row) => Number(row.protein) >= this.proteinGoal)
        .map((row) => String(row.day)),
      gymDaysWindow: (gymWindowData || []).map((row) => String(row.day)),
      proteinDaysWindow: (proteinWindowData || [])
        .filter((row) => Number(row.protein) >= this.proteinGoal)
        .map((row) => String(row.day)),
      recentFoodRefs: this.buildHistoricalRecentFoodRefs(
        (recentFoodData || []) as Pick<LogEntry, 'entry_type' | 'ref_id' | 'created_at'>[],
      ),
      proteinMilestonePosted: Boolean(proteinPostData?.id),
      stepsMilestonePosted: Boolean(stepsPostData?.id),
      profile: (profileData as Profile | null) || null,
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
      end: this.formatDate(endDate),
    };
  }

  private toHabitStates(type: 'gym' | 'protein'): HabitState[] {
    const states: HabitState[] = [];
    const start = this.shiftIsoDay(this.today(), -29);
    const days = this.getIsoDayRange(start, this.today());
    const hits = type === 'gym' ? this.gymDaysWindow() : this.proteinDaysWindow();

    for (const day of days) {
      states.push(hits.has(day) ? 'complete' : 'empty');
    }

    return states;
  }

  private itemMacros(item: QuickItem): MacroTotals {
    if (this.isIngredient(item)) {
      return {
        kcal: Number(item.kcal_per_100),
        protein: Number(item.protein_per_100),
        carbs: Number(item.carbs_per_100),
        fat: Number(item.fat_per_100),
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
    const [year, month, day] = normalized.split('-').map((part) => Number(part));
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
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
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
    const [year, month, date] = normalizedDay.split('-').map((part) => Number(part));
    const [hours, minutes] = normalizedTime.split(':').map((part) => Number(part));
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
        selected_day: this.today(),
      }),
    );
  }

  private completeFoodJourney(action: string, context?: Record<string, unknown>): void {
    const current = this.activeFoodJourneyId();
    if (!current) {
      return;
    }
    this.telemetry.completeJourney(current, 'success', {
      action,
      ...context,
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
        selected_day: this.today(),
      }),
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
