import { computed, inject, Injectable, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { formatAppError } from '../../core/error-format';
import { AuthService } from '../../core/auth.service';
import { InteractionTelemetryService } from '../../core/interaction-telemetry.service';
import {
  ProgressSeriesQuery,
  SavePlanInput,
  TrainingDashboardDay,
  TrainingDashboardWeek,
  TrainingDataService,
  TrainingExecutionExercise,
  TrainingExecutionSession,
  TrainingExecutionSet,
  TrainingGraphDataPoint,
  TrainingPlanOverview,
  TrainingPersonalStats
} from '../../core/training/training-data.service';
import { SupabaseService } from '../../core/supabase.service';
import {
  TrainingExercise,
  TrainingGraphConfig,
  TrainingGraphType,
  TrainingMeasurementType,
  TrainingPlan
} from '../../core/types';
import { addDays, calculateVolume, startOfIsoWeek, toIsoDate } from '../../core/training/training-utils';
import { applyPreviousWorkoutPrefill, carryForwardCompletedSet } from './gym-execution-utils';
import {
  appendBuilderDay,
  appendBuilderExercise,
  BuilderDayDraft,
  syncBuilderDays,
  updateBuilderDayMuscles,
  updateBuilderDayName,
  updateBuilderExercise,
  removeBuilderExerciseAt
} from './gym-builder-helpers';
import { buildWorkoutShareSuggestion } from './gym-community-share';
import {
  areAllSessionExercisesCompleted,
  findNextIncompleteExerciseIndex,
  findSetByClientRef,
  findSetContext,
  replaceExerciseSets,
  updateSetByClientRef
} from './gym-session-state';
import {
  buildProgressDateRange,
  clearProgressSeries,
  shouldHydrateProgress,
  sortWidgetsByPosition
} from './gym-progress-loaders';
import { selectTrackedWorkoutDay, shouldRefreshWorkoutPreview } from './gym-tracker-loaders';
import {
  buildExerciseProgressRows,
  detailChartPoints,
  ExerciseProgressRow,
  graphTitle
} from './gym-view-utils';

type DetailSource = 'widget' | 'progress-10rm' | 'progress-volume';
const initialWorkoutShare = buildWorkoutShareSuggestion(1);

@Injectable()
export class GymFacadeService {
  readonly frequencies = [1, 2, 3, 4, 5, 6, 7];

  readonly selectedDate = signal(toIsoDate(new Date()));
  readonly dashboardWeek = signal<TrainingDashboardWeek | null>(null);
  readonly selectedWorkoutDay = signal<TrainingDashboardDay | null>(null);
  readonly selectedOverview = signal<TrainingPlanOverview | null>(null);
  readonly activeSession = signal<TrainingExecutionSession | null>(null);
  readonly activeExerciseIndex = signal(0);
  readonly previousPerformance = signal<Array<{
    session_date: string;
    set_number: number;
    is_warmup: boolean;
    weight_kg: number | null;
    reps: number | null;
    estimated_10rm: number | null;
  }>>([]);

  readonly plans = signal<TrainingPlan[]>([]);
  readonly exercises = signal<TrainingExercise[]>([]);
  readonly widgets = signal<TrainingGraphConfig[]>([]);
  readonly personalStats = signal<TrainingPersonalStats | null>(null);

  readonly selectedDetailWidget = signal<TrainingGraphConfig | null>(null);
  readonly detailSeries = signal<TrainingGraphDataPoint[]>([]);
  readonly detailFrom = signal(toIsoDate(addDays(new Date(), -365)));
  readonly detailTo = signal(toIsoDate(new Date()));
  readonly detailSource = signal<DetailSource>('widget');
  readonly selectedDetailPointDate = signal<string | null>(null);

  readonly exerciseEquipmentFilter = signal('');
  readonly exerciseMuscleFilter = signal('');
  readonly selectedProgressExerciseId = signal('');
  readonly progressRangeDays = signal<7 | 30>(30);
  readonly tenRmSeries = signal<TrainingGraphDataPoint[]>([]);
  readonly exerciseVolumeSeries = signal<TrainingGraphDataPoint[]>([]);
  readonly progressLoaded = signal(false);
  readonly progressDirty = signal(false);

  readonly workoutShareSuggestion = signal(initialWorkoutShare.suggestion);
  readonly workoutSharePhotoName = signal<string | null>(null);
  readonly workoutShareNote = signal(initialWorkoutShare.note);
  readonly sharingWorkoutPost = signal(false);
  readonly lastCompletedSessionDay = signal<string | null>(null);

  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly setSaveState = signal<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});

  readonly currentExercise = computed<TrainingExecutionExercise | null>(() => {
    const session = this.activeSession();
    if (!session) {
      return null;
    }
    return session.exercises[this.activeExerciseIndex()] || null;
  });

  readonly selectedProgressExercise = computed<TrainingExercise | null>(() => {
    const selectedId = this.selectedProgressExerciseId();
    if (!selectedId) {
      return null;
    }
    return this.exercises().find(exercise => exercise.id === selectedId) || null;
  });

  readonly exerciseEquipmentOptions = computed(() =>
    [...new Set(this.exercises().map(exercise => exercise.equipment))].sort((a, b) => a.localeCompare(b))
  );

  readonly exerciseMuscleOptions = computed(() =>
    [...new Set(this.exercises().flatMap(exercise => [exercise.primary_muscle, ...exercise.secondary_muscles]))].sort(
      (a, b) => a.localeCompare(b)
    )
  );

  readonly activeExerciseFilterCount = computed(() => {
    let count = 0;
    if (this.exerciseEquipmentFilter()) {
      count += 1;
    }
    if (this.exerciseMuscleFilter()) {
      count += 1;
    }
    return count;
  });

  readonly filteredExerciseLibrary = computed(() => {
    const equipment = this.exerciseEquipmentFilter();
    const muscle = this.exerciseMuscleFilter();

    return this.exercises().filter(exercise => {
      if (equipment && exercise.equipment !== equipment) {
        return false;
      }

      if (!muscle) {
        return true;
      }

      if (exercise.primary_muscle === muscle) {
        return true;
      }

      return exercise.secondary_muscles.includes(muscle);
    });
  });

  readonly activePlanStatLabel = computed(() => {
    const activePlan = this.dashboardWeek()?.activePlan;
    if (!activePlan) {
      return 'Kein Plan aktiv';
    }
    return `${activePlan.name} · W${activePlan.weekNumber}`;
  });

  readonly latestBodyweightStatLabel = computed(() => {
    const value = this.personalStats()?.latestBodyweight;
    return value ? `${value} kg` : '--';
  });

  readonly latestTenRmLabel = computed(() => {
    const latest = this.tenRmSeries()[this.tenRmSeries().length - 1];
    if (!latest) {
      return '--';
    }
    return `${Number(latest.point_value).toFixed(1)} kg`;
  });

  readonly latestSessionVolumeLabel = computed(() => {
    const latest = this.exerciseVolumeSeries()[this.exerciseVolumeSeries().length - 1];
    if (!latest) {
      return '--';
    }
    return `${Math.round(Number(latest.point_value))} kg`;
  });

  readonly bestTenRmLabel = computed(() => {
    if (this.tenRmSeries().length === 0) {
      return '--';
    }

    const best = Math.max(...this.tenRmSeries().map(point => Number(point.point_value)));
    return `${best.toFixed(1)} kg`;
  });

  readonly progressSessionRows = computed<ExerciseProgressRow[]>(() =>
    buildExerciseProgressRows(this.tenRmSeries(), this.exerciseVolumeSeries())
  );

  readonly progressSessionCountLabel = computed(() => `${this.progressSessionRows().length}`);
  readonly progressRangeLabel = computed(() => `Letzte ${this.progressRangeDays()} Tage`);

  readonly detailChartPoints = computed(() => detailChartPoints(this.detailSeries()));

  readonly selectedDetailPoint = computed(() => {
    const selectedDate = this.selectedDetailPointDate();
    if (!selectedDate) {
      return null;
    }
    return this.detailChartPoints().find(point => point.date === selectedDate) || null;
  });

  readonly hasDetailContext = computed(() => this.detailSource() !== 'widget' || this.selectedDetailWidget() !== null);

  readonly detailSheetTitle = computed(() => {
    const source = this.detailSource();
    if (source === 'progress-10rm') {
      return 'Erweiterte Analyse: 10RM Verlauf';
    }
    if (source === 'progress-volume') {
      return 'Erweiterte Analyse: Volumen';
    }
    const widget = this.selectedDetailWidget();
    if (!widget) {
      return 'Erweiterte Analyse';
    }
    const exerciseName = this.exercises().find(item => item.id === widget.exercise_id)?.name || null;
    return graphTitle(widget, exerciseName);
  });

  readonly selectedDetailPointSummary = computed(() => {
    const selected = this.selectedDetailPoint();
    if (!selected) {
      return 'Tippe auf einen Punkt für Details.';
    }

    if (this.detailSource() === 'progress-volume') {
      return `${selected.date}: ${Math.round(selected.value)} kg Volumen`;
    }

    if (this.detailSource() === 'progress-10rm') {
      return `${selected.date}: ${selected.value.toFixed(1)} kg 10RM`;
    }

    return `${selected.date}: ${selected.value.toFixed(1)}`;
  });

  readonly currentExerciseSaveHint = computed(() => {
    const exercise = this.currentExercise();
    if (!exercise) {
      return null;
    }

    const states = exercise.sets.map(setRow => this.setSaveState()[setRow.clientRef] || 'idle');
    if (states.includes('error')) {
      return 'Einige Eingaben konnten noch nicht gespeichert werden.';
    }
    if (states.includes('saving')) {
      return 'Eingaben werden gespeichert...';
    }
    return null;
  });

  readonly measurementForm = inject(FormBuilder).nonNullable.group({
    type: 'weight' as TrainingMeasurementType,
    value: 70,
    measuredOn: toIsoDate(new Date())
  });

  readonly planMetaForm = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    daysPerWeek: [4, [Validators.required, Validators.min(1), Validators.max(7)]],
    durationWeeks: [12, [Validators.required, Validators.min(1), Validators.max(52)]],
    startDate: [toIsoDate(new Date()), Validators.required],
    isActive: [true]
  });

  readonly graphForm = inject(FormBuilder).nonNullable.group({
    graphType: ['workout_count' as TrainingGraphType, Validators.required],
    exerciseId: [''],
    muscleGroup: ['']
  });

  readonly builderDays = signal<BuilderDayDraft[]>([]);

  private readonly trainingData = inject(TrainingDataService);
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly telemetry = inject(InteractionTelemetryService);
  private readonly pendingSetSaves = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly pendingSetStateResets = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly inFlightSetSaves = new Map<string, Promise<void>>();
  private readonly attemptedExercisePrefill = new Set<string>();
  private readonly previousPerformanceByExerciseId = new Map<string, Array<{
    session_date: string;
    set_number: number;
    is_warmup: boolean;
    weight_kg: number | null;
    reps: number | null;
    estimated_10rm: number | null;
  }>>();
  private trackerBootstrapped = false;
  private progressRequestId = 0;
  private progressHydrationId = 0;
  private activeGraphJourneyId: string | null = null;
  private workoutSharePhoto: File | null = null;

  init(): void {
    this.syncBuilderDayCount();
    void this.loadTrackerBootstrap();
  }

  destroy(): void {
    for (const timer of this.pendingSetSaves.values()) {
      clearTimeout(timer);
    }
    this.pendingSetSaves.clear();

    for (const timer of this.pendingSetStateResets.values()) {
      clearTimeout(timer);
    }
    this.pendingSetStateResets.clear();
  }

  async activateProgressTab(): Promise<void> {
    if (!shouldHydrateProgress(this.progressLoaded(), this.progressDirty())) {
      return;
    }

    await this.loadProgressData(this.progressDirty());
  }

  async loadTrackerBootstrap(forceRefresh = false): Promise<void> {
    this.errorMessage.set(null);

    try {
      if (this.trainingData.hasPendingSync()) {
        await this.trainingData.flushPendingSync();
      }

      const [dashboard, exercises, plans] = await Promise.all([
        this.trainingData.getDashboardWeek(this.selectedDate(), forceRefresh),
        this.trainingData.getExercises(forceRefresh),
        this.trainingData.getPlans(forceRefresh)
      ]);

      this.dashboardWeek.set(dashboard);
      this.exercises.set(exercises);
      this.plans.set(plans);
      this.trackerBootstrapped = true;

      await this.syncSelectedWorkoutPreview(dashboard, forceRefresh);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Gym Tracker konnte nicht geladen werden'));
    }
  }

  async loadDashboardWeek(forceRefresh = false): Promise<void> {
    this.errorMessage.set(null);

    try {
      const dashboard = await this.trainingData.getDashboardWeek(this.selectedDate(), forceRefresh);
      this.dashboardWeek.set(dashboard);
      await this.syncSelectedWorkoutPreview(dashboard, forceRefresh);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Gym Tracker konnte nicht geladen werden'));
    }
  }

  async loadProgressData(forceRefresh = false): Promise<void> {
    this.errorMessage.set(null);
    this.startGraphJourney(forceRefresh ? 'progress_refresh' : 'progress_load');
    const hydrationId = ++this.progressHydrationId;

    try {
      const needsExercises = this.exercises().length === 0 || forceRefresh;
      const [widgets, personalStats, exercises] = await Promise.all([
        this.trainingData.getProgressWidgets(forceRefresh),
        this.trainingData.getPersonalStats(forceRefresh),
        needsExercises ? this.trainingData.getExercises(forceRefresh) : Promise.resolve(this.exercises())
      ]);

      if (hydrationId !== this.progressHydrationId) {
        return;
      }

      if (needsExercises) {
        this.exercises.set(exercises);
      }

      if (!this.selectedProgressExerciseId() && exercises.length > 0) {
        this.selectedProgressExerciseId.set(exercises[0].id);
      }

      this.personalStats.set(personalStats);
      this.widgets.set(sortWidgetsByPosition(widgets));
      await this.loadSelectedExerciseProgress(forceRefresh);

      if (hydrationId !== this.progressHydrationId) {
        return;
      }

      this.progressLoaded.set(true);
      this.progressDirty.set(false);
    } catch (error: unknown) {
      if (this.activeGraphJourneyId) {
        this.telemetry.failJourney(this.activeGraphJourneyId, { surface: 'gym', reason: 'progress_load_failed' });
        this.activeGraphJourneyId = null;
      }
      this.errorMessage.set(formatAppError(error, 'Progress Daten konnten nicht geladen werden'));
    }
  }

  async openWorkoutPreview(
    workout: TrainingDashboardDay,
    options?: { forceSessionRefresh?: boolean }
  ): Promise<void> {
    this.selectedWorkoutDay.set(workout);

    try {
      const reuseOverview = this.selectedOverview()?.dayId === workout.dayId && !options?.forceSessionRefresh;
      if (!reuseOverview) {
        this.selectedOverview.set(await this.trainingData.getPlanOverview(workout.dayId));
      }

      if (workout.currentSessionClientRef) {
        const currentSession = this.activeSession();
        if (currentSession?.sessionClientRef !== workout.currentSessionClientRef || options?.forceSessionRefresh) {
          if (this.trainingData.hasPendingSync()) {
            await this.trainingData.flushPendingSync();
          }

          const activeSession = await this.trainingData.getSessionByClientRef(workout.currentSessionClientRef);
          if (activeSession && activeSession.status === 'in_progress') {
            this.applyActiveSession(activeSession);
          }
        }
      } else if (this.activeSession()) {
        this.activeSession.set(null);
        this.previousPerformance.set([]);
        this.resetExecutionPrefillState();
        this.resetPreviousPerformanceCache();
      }
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Workout Vorschau konnte nicht geladen werden'));
    }
  }

  async startWorkout(): Promise<void> {
    const overview = this.selectedOverview();
    if (!overview) {
      return;
    }

    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      if (this.trainingData.hasPendingSync()) {
        await this.trainingData.flushPendingSync();
      }

      const session = await this.trainingData.startSession(overview.dayId, this.selectedDate());
      this.applyActiveSession(session);
      this.successMessage.set('Workout gestartet.');
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Workout konnte nicht gestartet werden'));
    }
  }

  setActiveExercise(index: number): void {
    this.activeExerciseIndex.set(index);
    void this.refreshPreviousPerformance();
  }

  goToPreviousExercise(): void {
    const previous = Math.max(0, this.activeExerciseIndex() - 1);
    if (previous === this.activeExerciseIndex()) {
      return;
    }
    this.setActiveExercise(previous);
  }

  goToNextExercise(): void {
    const session = this.activeSession();
    if (!session) {
      return;
    }

    const next = Math.min(session.exercises.length - 1, this.activeExerciseIndex() + 1);
    if (next === this.activeExerciseIndex()) {
      return;
    }
    this.setActiveExercise(next);
  }

  async refreshPreviousPerformance(forceRefresh = false): Promise<void> {
    const exercise = this.currentExercise();
    const sessionClientRef = this.activeSession()?.sessionClientRef || null;
    if (!exercise) {
      this.previousPerformance.set([]);
      return;
    }

    const cached = !forceRefresh ? this.previousPerformanceByExerciseId.get(exercise.exerciseId) : undefined;
    if (cached) {
      this.previousPerformance.set(cached);
      this.applyCurrentExerciseHistoryPrefill();
      return;
    }

    try {
      const previous = await this.trainingData.getPreviousPerformance(exercise.exerciseId, this.selectedDate(), forceRefresh);
      const currentSession = this.activeSession();
      const currentExercise = this.currentExercise();
      if (!currentSession || currentSession.sessionClientRef !== sessionClientRef) {
        return;
      }
      if (!currentExercise || currentExercise.sessionExerciseId !== exercise.sessionExerciseId) {
        return;
      }
      this.previousPerformanceByExerciseId.set(exercise.exerciseId, previous);
      this.previousPerformance.set(previous);
      this.applyCurrentExerciseHistoryPrefill();
    } catch {
      const currentSession = this.activeSession();
      const currentExercise = this.currentExercise();
      if (!currentSession || currentSession.sessionClientRef !== sessionClientRef) {
        return;
      }
      if (!currentExercise || currentExercise.sessionExerciseId !== exercise.sessionExerciseId) {
        return;
      }
      this.previousPerformance.set([]);
    }
  }

  onSetInput(setRow: TrainingExecutionSet, field: 'weight' | 'reps', rawValue: string): void {
    const numericValue = rawValue.trim() === '' ? null : Number(rawValue);

    this.updateSet(setRow.clientRef, draft => {
      if (field === 'weight') {
        draft.weightKg = numericValue;
      } else {
        draft.reps = numericValue;
      }

      draft.volume = calculateVolume(draft.weightKg, draft.reps);
    });

    this.scheduleSetSave(setRow.clientRef);
  }

  async toggleSetComplete(setRow: TrainingExecutionSet): Promise<void> {
    const exercise = this.currentExercise();
    if (!exercise || !this.activeSession()) {
      return;
    }

    const nextCompleted = !setRow.isCompleted;

    this.updateSet(setRow.clientRef, draft => {
      draft.isCompleted = nextCompleted;
      draft.volume = calculateVolume(draft.weightKg, draft.reps);
    });

    const currentSet = findSetByClientRef(this.activeSession(), setRow.clientRef);
    if (!currentSet) {
      return;
    }

    await this.persistSetLog(currentSet.clientRef);

    if (!nextCompleted) {
      return;
    }

    const carriedSetClientRef = this.carryForwardToNextBlankSet(currentSet.clientRef);
    if (carriedSetClientRef) {
      this.scheduleSetSave(carriedSetClientRef);
    }

    const updatedExercise = this.currentExercise();
    if (!updatedExercise) {
      return;
    }

    if (!updatedExercise.sets.every(item => item.isCompleted)) {
      return;
    }

    const updatedSession = this.activeSession();
    if (!updatedSession) {
      return;
    }

    const nextOpenIndex = findNextIncompleteExerciseIndex(updatedSession, this.activeExerciseIndex() + 1);
    if (nextOpenIndex >= 0) {
      this.setActiveExercise(nextOpenIndex);
      this.successMessage.set(`"${updatedExercise.name}" abgeschlossen. Weiter zur nächsten Übung.`);
      return;
    }

    const fallbackOpenIndex = findNextIncompleteExerciseIndex(updatedSession, 0);
    if (fallbackOpenIndex >= 0 && fallbackOpenIndex !== this.activeExerciseIndex()) {
      this.setActiveExercise(fallbackOpenIndex);
      this.successMessage.set(`"${updatedExercise.name}" abgeschlossen. Weiter zur nächsten offenen Übung.`);
      return;
    }

    if (areAllSessionExercisesCompleted(updatedSession)) {
      this.successMessage.set('Alle Übungen abgeschlossen. Workout jetzt beenden.');
    }
  }

  async finishWorkout(progressVisible = false): Promise<boolean> {
    const session = this.activeSession();
    if (!session) {
      return false;
    }

    this.errorMessage.set(null);

    try {
      await this.flushPendingSetSaves();
      await this.trainingData.completeSession(session.sessionClientRef);
      this.lastCompletedSessionDay.set(session.sessionDate);
      try {
        await this.prepareWorkoutShareSuggestion(session.sessionDate);
      } catch {
        this.workoutShareSuggestion.set(initialWorkoutShare.suggestion);
        this.workoutShareNote.set(initialWorkoutShare.note);
      }

      this.successMessage.set('Workout abgeschlossen.');
      this.activeSession.set(null);
      this.previousPerformance.set([]);
      this.resetExecutionPrefillState();
      this.resetPreviousPerformanceCache();
      await this.loadDashboardWeek(true);
      await this.refreshProgressAfterMutation(progressVisible);
      return true;
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Workout konnte nicht abgeschlossen werden'));
      return false;
    }
  }

  async savePlan(): Promise<boolean> {
    if (this.planMetaForm.invalid || this.builderDays().length === 0) {
      return false;
    }

    const value = this.planMetaForm.getRawValue();
    const payload: SavePlanInput = {
      name: value.name,
      daysPerWeek: Number(value.daysPerWeek),
      durationWeeks: Number(value.durationWeeks),
      startDate: value.startDate,
      isActive: Boolean(value.isActive),
      days: this.builderDays().map(day => ({
        name: day.name,
        targetMuscles: day.targetMuscles
          .split(',')
          .map(item => item.trim().toLowerCase())
          .filter(Boolean),
        exercises: day.exercises
      }))
    };

    try {
      await this.trainingData.savePlan(payload);
      this.successMessage.set('Plan gespeichert.');
      await this.loadTrackerBootstrap(true);
      return true;
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Plan konnte nicht gespeichert werden'));
      return false;
    }
  }

  async activatePlan(planId: string): Promise<void> {
    try {
      await this.trainingData.activatePlan(planId);
      this.successMessage.set('Plan aktiviert.');
      await this.loadTrackerBootstrap(true);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Plan konnte nicht aktiviert werden'));
    }
  }

  async saveMeasurement(progressVisible = false): Promise<void> {
    if (this.measurementForm.invalid) {
      return;
    }

    const value = this.measurementForm.getRawValue();

    try {
      await this.trainingData.upsertMeasurement({
        type: value.type,
        value: Number(value.value),
        measuredOn: value.measuredOn
      });

      this.successMessage.set('Measurement gespeichert.');
      await this.refreshProgressAfterMutation(progressVisible);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Measurement konnte nicht gespeichert werden'));
    }
  }

  async addGraphWidget(progressVisible = false): Promise<boolean> {
    if (this.graphForm.invalid) {
      return false;
    }

    const value = this.graphForm.getRawValue();
    const configs: Array<{
      id?: string;
      graph_type: TrainingGraphType;
      exercise_id: string | null;
      muscle_group: string | null;
      position: number;
      settings: Record<string, unknown>;
    }> = [...this.widgets()].map(item => ({
      id: item.id.startsWith('local-') ? undefined : item.id,
      graph_type: item.graph_type,
      exercise_id: item.exercise_id,
      muscle_group: item.muscle_group,
      position: item.position,
      settings: item.settings
    }));

    configs.push({
      graph_type: value.graphType,
      exercise_id: value.graphType === 'exercise_10rm' ? value.exerciseId || null : null,
      muscle_group: value.graphType === 'muscle_volume' ? value.muscleGroup || null : null,
      position: configs.length + 1,
      settings: {}
    });

    try {
      await this.trainingData.saveProgressWidgets(configs);
      this.graphForm.patchValue({ graphType: 'workout_count', exerciseId: '', muscleGroup: '' });
      this.successMessage.set('Graph hinzugefügt.');
      await this.refreshProgressAfterMutation(progressVisible);
      return true;
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Graph konnte nicht gespeichert werden'));
      return false;
    }
  }

  async openProgressDetail(kind: '10rm' | 'volume'): Promise<void> {
    this.detailSource.set(kind === '10rm' ? 'progress-10rm' : 'progress-volume');
    this.selectedDetailWidget.set(null);
    this.detailFrom.set(toIsoDate(addDays(new Date(), -180)));
    this.detailTo.set(toIsoDate(new Date()));
    this.completeGraphJourney(kind === '10rm' ? 'open_progress_10rm' : 'open_progress_volume');
    await this.reloadDetailSeries();
  }

  async openGraphDetail(widget: TrainingGraphConfig): Promise<void> {
    this.detailSource.set('widget');
    this.selectedDetailWidget.set(widget);
    this.detailFrom.set(toIsoDate(addDays(new Date(), -730)));
    this.detailTo.set(toIsoDate(new Date()));
    this.completeGraphJourney('open_widget_detail');
    await this.reloadDetailSeries();
  }

  onDetailDateChange(value: string, type: 'from' | 'to'): void {
    if (type === 'from') {
      this.detailFrom.set(value);
    } else {
      this.detailTo.set(value);
    }
  }

  async reloadDetailSeries(): Promise<void> {
    const source = this.detailSource();
    try {
      let series: TrainingGraphDataPoint[] = [];
      if (source === 'widget') {
        const widget = this.selectedDetailWidget();
        if (!widget) {
          this.detailSeries.set([]);
          this.selectedDetailPointDate.set(null);
          return;
        }
        series = await this.trainingData.getProgressSeries(this.widgetToSeriesQuery(widget, this.detailFrom(), this.detailTo()));
      } else if (source === 'progress-10rm') {
        const exerciseId = this.selectedProgressExerciseId();
        if (!exerciseId) {
          this.detailSeries.set([]);
          this.selectedDetailPointDate.set(null);
          return;
        }
        series = await this.trainingData.getProgressSeries({
          graphType: 'exercise_10rm',
          exerciseId,
          from: this.detailFrom(),
          to: this.detailTo()
        });
      } else {
        const exerciseId = this.selectedProgressExerciseId();
        if (!exerciseId) {
          this.detailSeries.set([]);
          this.selectedDetailPointDate.set(null);
          return;
        }
        series = await this.trainingData.getExerciseVolumeSeries(exerciseId, this.detailFrom(), this.detailTo(), true);
      }

      this.detailSeries.set(series);
      this.selectedDetailPointDate.set(series[series.length - 1]?.point_date || null);
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Detail-Graph konnte nicht geladen werden'));
    }
  }

  setDetailRangeDays(days: 30 | 90 | 365): void {
    const end = new Date();
    const start = addDays(end, -(days - 1));
    this.detailFrom.set(toIsoDate(start));
    this.detailTo.set(toIsoDate(end));
    void this.reloadDetailSeries();
  }

  selectDetailPointDate(pointDate: string): void {
    this.selectedDetailPointDate.set(pointDate);
  }

  clearDetailSelection(): void {
    this.selectedDetailPointDate.set(null);
  }

  goPrevWeek(): void {
    const next = addDays(new Date(`${this.selectedDate()}T00:00:00`), -7);
    this.setSelectedDate(toIsoDate(next));
    void this.loadDashboardWeek(true);
  }

  goNextWeek(): void {
    const next = addDays(new Date(`${this.selectedDate()}T00:00:00`), 7);
    this.setSelectedDate(toIsoDate(next));
    void this.loadDashboardWeek(true);
  }

  onSelectDate(dayIso: string): void {
    const weekStart = toIsoDate(startOfIsoWeek(new Date(`${dayIso}T00:00:00`)));
    this.setSelectedDate(dayIso);
    if (weekStart !== this.dashboardWeek()?.weekStart) {
      void this.loadDashboardWeek(true);
    }
  }

  onProgressExerciseChange(value: string): void {
    this.selectedProgressExerciseId.set(value);
    void this.loadSelectedExerciseProgress(true);
  }

  setProgressRangeDays(days: 7 | 30): void {
    if (days === this.progressRangeDays()) {
      return;
    }
    this.progressRangeDays.set(days);
    void this.loadSelectedExerciseProgress(true);
  }

  onExerciseEquipmentFilterChange(value: string): void {
    this.exerciseEquipmentFilter.set(value);
  }

  onExerciseMuscleFilterChange(value: string): void {
    this.exerciseMuscleFilter.set(value);
  }

  resetExerciseFilters(): void {
    this.exerciseEquipmentFilter.set('');
    this.exerciseMuscleFilter.set('');
  }

  setWorkoutSharePhoto(file: File | null): void {
    this.workoutSharePhoto = file;
    this.workoutSharePhotoName.set(file?.name || null);
  }

  setWorkoutShareNote(note: string): void {
    this.workoutShareNote.set(note);
  }

  async submitSessionCommunityPost(): Promise<boolean> {
    const user = this.authService.user();
    if (!user) {
      return false;
    }

    this.sharingWorkoutPost.set(true);
    this.errorMessage.set(null);

    try {
      let photoPath: string | null = null;
      if (this.workoutSharePhoto) {
        photoPath = await this.uploadGymImage(this.workoutSharePhoto, user.id);
      }

      const postDay = this.lastCompletedSessionDay() || toIsoDate(new Date());
      const { error } = await this.supabaseService.client
        .from('community_posts')
        .upsert(
          {
            user_id: user.id,
            post_type: 'gym_checkin',
            day: postDay,
            note: this.workoutShareNote().trim() || this.workoutShareSuggestion(),
            summary: {
              session_day: postDay,
              weekly_progress: this.workoutShareSuggestion()
            },
            photo_url: photoPath
          },
          { onConflict: 'user_id,day,post_type' }
        );

      if (error) {
        throw error;
      }

      this.successMessage.set('Gym-Post erstellt.');
      this.resetWorkoutShareState();
      return true;
    } catch (error: unknown) {
      this.errorMessage.set(formatAppError(error, 'Community-Post konnte nicht erstellt werden'));
      return false;
    } finally {
      this.sharingWorkoutPost.set(false);
    }
  }

  resetWorkoutShareState(): void {
    this.workoutSharePhoto = null;
    this.workoutSharePhotoName.set(null);
    const initialShare = buildWorkoutShareSuggestion(1);
    this.workoutShareSuggestion.set(initialShare.suggestion);
    this.workoutShareNote.set(initialShare.note);
    this.lastCompletedSessionDay.set(null);
  }

  syncBuilderDayCount(): void {
    const targetDays = Number(this.planMetaForm.controls.daysPerWeek.value || 1);
    const fallbackExerciseId = this.exercises()[0]?.id || '';
    this.builderDays.set(syncBuilderDays(this.builderDays(), targetDays, fallbackExerciseId));
  }

  setBuilderDayName(dayIndex: number, value: string): void {
    this.builderDays.update(days => updateBuilderDayName(days, dayIndex, value));
  }

  setBuilderDayMuscles(dayIndex: number, value: string): void {
    this.builderDays.update(days => updateBuilderDayMuscles(days, dayIndex, value));
  }

  setBuilderExercise(
    dayIndex: number,
    exerciseIndex: number,
    field: 'exerciseId' | 'sets' | 'targetReps',
    value: string
  ): void {
    this.builderDays.update(days => updateBuilderExercise(days, dayIndex, exerciseIndex, field, value));
  }

  addBuilderExercise(dayIndex: number): void {
    const fallbackExerciseId = this.exercises()[0]?.id || '';
    if (!fallbackExerciseId) {
      this.errorMessage.set('Keine Übungen vorhanden. Bitte erst eine Übung anlegen.');
      return;
    }

    this.builderDays.update(days => appendBuilderExercise(days, dayIndex, fallbackExerciseId));
  }

  removeBuilderExercise(dayIndex: number, exerciseIndex: number): void {
    this.builderDays.update(days => removeBuilderExerciseAt(days, dayIndex, exerciseIndex));
  }

  addBuilderDay(): void {
    if (this.builderDays().length >= 7) {
      return;
    }

    const fallbackExerciseId = this.exercises()[0]?.id || '';
    this.builderDays.update(days => appendBuilderDay(days, fallbackExerciseId));
  }

  detailPointLabel(pointDate: string, value: number): string {
    return `${pointDate}: ${Number(value).toFixed(1)}`;
  }

  clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  private setSelectedDate(dayIso: string): void {
    if (dayIso === this.selectedDate()) {
      return;
    }
    this.selectedDate.set(dayIso);
    this.resetPreviousPerformanceCache();
  }

  private async syncSelectedWorkoutPreview(
    dashboard: TrainingDashboardWeek,
    forceSessionRefresh = false
  ): Promise<void> {
    const selectedDayId = this.selectedWorkoutDay()?.dayId || null;
    const nextWorkout = selectTrackedWorkoutDay(dashboard, selectedDayId);

    this.selectedWorkoutDay.set(nextWorkout);

    if (!nextWorkout) {
      this.selectedOverview.set(null);
      return;
    }

    const shouldRefresh = shouldRefreshWorkoutPreview({
      currentOverviewDayId: this.selectedOverview()?.dayId || null,
      nextWorkoutDayId: nextWorkout.dayId,
      currentSessionClientRef: nextWorkout.currentSessionClientRef,
      forceSessionRefresh
    });
    if (!shouldRefresh) {
      return;
    }

    await this.openWorkoutPreview(nextWorkout, { forceSessionRefresh });
  }

  private applyActiveSession(session: TrainingExecutionSession): void {
    this.resetExecutionPrefillState();
    this.resetPreviousPerformanceCache();
    this.activeSession.set(session);
    const nextOpenIndex = findNextIncompleteExerciseIndex(session, 0);
    this.activeExerciseIndex.set(nextOpenIndex >= 0 ? nextOpenIndex : 0);
    void this.refreshPreviousPerformance();
  }

  private async refreshProgressAfterMutation(progressVisible: boolean): Promise<void> {
    this.progressDirty.set(true);
    if (progressVisible) {
      await this.loadProgressData(true);
    }
  }

  private startGraphJourney(source: string): void {
    if (this.activeGraphJourneyId) {
      return;
    }
    this.activeGraphJourneyId = this.telemetry.startJourney('graph_check', {
      surface: 'gym',
      source
    });
  }

  private completeGraphJourney(action: string): void {
    if (!this.activeGraphJourneyId) {
      return;
    }
    this.telemetry.completeJourney(this.activeGraphJourneyId, 'success', {
      surface: 'gym',
      action
    });
    this.activeGraphJourneyId = null;
  }

  private async loadSelectedExerciseProgress(forceRefresh = false): Promise<void> {
    const exerciseId = this.selectedProgressExerciseId();
    if (!exerciseId) {
      const emptySeries = clearProgressSeries();
      this.tenRmSeries.set(emptySeries.tenRmSeries);
      this.exerciseVolumeSeries.set(emptySeries.exerciseVolumeSeries);
      return;
    }

    const requestId = ++this.progressRequestId;
    const { from, to } = buildProgressDateRange(this.progressRangeDays());

    const [tenRm, volume] = await Promise.all([
      this.trainingData.getProgressSeries({
        graphType: 'exercise_10rm',
        exerciseId,
        from,
        to
      }),
      this.trainingData.getExerciseVolumeSeries(exerciseId, from, to, forceRefresh).catch(() => [] as TrainingGraphDataPoint[])
    ]);

    if (requestId !== this.progressRequestId) {
      return;
    }

    this.tenRmSeries.set(tenRm);
    this.exerciseVolumeSeries.set(volume);
  }

  private async prepareWorkoutShareSuggestion(sessionDay: string): Promise<void> {
    const sessionDate = new Date(`${sessionDay}T00:00:00`);
    const weekStartDate = startOfIsoWeek(sessionDate);
    const weekStart = toIsoDate(weekStartDate);
    const weekEnd = toIsoDate(addDays(weekStartDate, 6));
    const completedThisWeek = await this.trainingData.getCompletedWorkoutCountForRange(weekStart, weekEnd);
    const share = buildWorkoutShareSuggestion(completedThisWeek);
    this.workoutShareSuggestion.set(share.suggestion);
    this.workoutShareNote.set(share.note);
  }

  private async uploadGymImage(file: File, userId: string): Promise<string> {
    const extension = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${Date.now()}.${extension}`;
    const { error } = await this.supabaseService.client.storage
      .from('gym-checkins')
      .upload(path, file, { upsert: true });

    if (error) {
      throw error;
    }

    return path;
  }

  private widgetToSeriesQuery(widget: TrainingGraphConfig, from?: string, to?: string): ProgressSeriesQuery {
    return {
      graphType: widget.graph_type,
      from,
      to,
      exerciseId: widget.exercise_id,
      muscleGroup: widget.muscle_group
    };
  }

  private applyCurrentExerciseHistoryPrefill(): void {
    const session = this.activeSession();
    const exercise = this.currentExercise();
    if (!session || !exercise) {
      return;
    }

    const prefillKey = this.executionPrefillKey(session.sessionClientRef, exercise.sessionExerciseId);
    if (this.attemptedExercisePrefill.has(prefillKey)) {
      return;
    }

    const { nextSets, changed } = applyPreviousWorkoutPrefill(exercise.sets, this.previousPerformance());
    this.attemptedExercisePrefill.add(prefillKey);

    if (!changed) {
      return;
    }

    this.activeSession.update(current => {
      if (!current) {
        return current;
      }

      return replaceExerciseSets(
        current,
        exercise.sessionExerciseId,
        nextSets.map(setRow => ({
          ...setRow,
          volume: calculateVolume(setRow.weightKg, setRow.reps)
        }))
      );
    });
  }

  private carryForwardToNextBlankSet(completedClientRef: string): string | null {
    const exercise = this.currentExercise();
    if (!exercise) {
      return null;
    }

    const { nextSets, carriedSetClientRef } = carryForwardCompletedSet(exercise.sets, completedClientRef);
    if (!carriedSetClientRef) {
      return null;
    }

    this.activeSession.update(current => {
      if (!current) {
        return current;
      }

      return replaceExerciseSets(
        current,
        exercise.sessionExerciseId,
        nextSets.map(setRow => ({
          ...setRow,
          volume: calculateVolume(setRow.weightKg, setRow.reps)
        }))
      );
    });

    return carriedSetClientRef;
  }

  private scheduleSetSave(clientRef: string): void {
    const pending = this.pendingSetSaves.get(clientRef);
    if (pending) {
      clearTimeout(pending);
    }

    this.markSetSaveState(clientRef, 'saving');

    const timer = setTimeout(() => {
      this.pendingSetSaves.delete(clientRef);
      void this.persistSetLog(clientRef);
    }, 420);

    this.pendingSetSaves.set(clientRef, timer);
  }

  private async persistSetLog(clientRef: string): Promise<void> {
    const session = this.activeSession();
    const context = findSetContext(session, clientRef);
    if (!session || !context) {
      return;
    }

    const task = (async () => {
      this.markSetSaveState(clientRef, 'saving');
      await this.trainingData.upsertSetLog({
        sessionClientRef: session.sessionClientRef,
        exerciseSortOrder: context.exercise.sortOrder,
        setNumber: context.setRow.setNumber,
        isWarmup: context.setRow.isWarmup,
        weightKg: context.setRow.weightKg,
        reps: context.setRow.reps,
        durationSeconds: context.setRow.durationSeconds,
        isCompleted: context.setRow.isCompleted,
        clientRef: context.setRow.clientRef
      });

      this.markSetSaveState(clientRef, 'saved');
      const existing = this.pendingSetStateResets.get(clientRef);
      if (existing) {
        clearTimeout(existing);
      }

      const resetTimer = setTimeout(() => {
        this.pendingSetStateResets.delete(clientRef);
        this.markSetSaveState(clientRef, 'idle');
      }, 1200);
      this.pendingSetStateResets.set(clientRef, resetTimer);
    })();

    this.inFlightSetSaves.set(clientRef, task);
    try {
      await task;
    } catch {
      this.markSetSaveState(clientRef, 'error');
    } finally {
      if (this.inFlightSetSaves.get(clientRef) === task) {
        this.inFlightSetSaves.delete(clientRef);
      }
    }
  }

  private async flushPendingSetSaves(): Promise<void> {
    const saves: Promise<void>[] = [];

    for (const [clientRef, timer] of this.pendingSetSaves.entries()) {
      clearTimeout(timer);
      this.pendingSetSaves.delete(clientRef);
      saves.push(this.persistSetLog(clientRef));
    }

    saves.push(...this.inFlightSetSaves.values());
    if (saves.length === 0) {
      return;
    }

    await Promise.allSettled(saves);
  }

  private markSetSaveState(clientRef: string, state: 'idle' | 'saving' | 'saved' | 'error'): void {
    this.setSaveState.update(current => {
      if (state === 'idle') {
        const { [clientRef]: removed, ...rest } = current;
        void removed;
        return rest;
      }
      return { ...current, [clientRef]: state };
    });
  }

  private executionPrefillKey(sessionClientRef: string, sessionExerciseId: string): string {
    return `${sessionClientRef}:${sessionExerciseId}`;
  }

  private resetExecutionPrefillState(): void {
    this.attemptedExercisePrefill.clear();
  }

  private resetPreviousPerformanceCache(): void {
    this.previousPerformanceByExerciseId.clear();
    this.previousPerformance.set([]);
  }

  private updateSet(clientRef: string, updater: (setRow: TrainingExecutionSet) => void): void {
    this.activeSession.update(current => {
      if (!current) {
        return current;
      }

      return updateSetByClientRef(current, clientRef, setRow => {
        const next = { ...setRow };
        updater(next);
        return next;
      });
    });
  }
}
