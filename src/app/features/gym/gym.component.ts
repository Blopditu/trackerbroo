import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ArrowLeft, BarChart3, Dumbbell, Ellipsis, LucideAngularModule, Timer, User } from 'lucide-angular';
import { AppChromeService } from '../../core/app-chrome.service';
import { BottomSheetComponent } from '../../ui/minimal/bottom-sheet.component';
import { GymFacadeService } from './gym-facade.service';
import { GymExecutionPanelComponent, GymSetInputChange } from './gym-execution-panel.component';
import { GymGraphDetailSheetComponent } from './gym-graph-detail-sheet.component';
import { GymPlanBuilderSheetComponent } from './gym-plan-builder-sheet.component';
import { GymProgressTabComponent } from './gym-progress-tab.component';
import { GymSessionHubSheetComponent } from './gym-session-hub-sheet.component';
import { GymSessionShareSheetComponent } from './gym-session-share-sheet.component';
import { GymTrackerTabComponent } from './gym-tracker-tab.component';

@Component({
  selector: 'app-gym',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [GymFacadeService],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LucideAngularModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    BottomSheetComponent,
    GymTrackerTabComponent,
    GymExecutionPanelComponent,
    GymProgressTabComponent,
    GymSessionHubSheetComponent,
    GymPlanBuilderSheetComponent,
    GymGraphDetailSheetComponent,
    GymSessionShareSheetComponent
  ],
  templateUrl: './gym.component.html',
  styleUrl: './gym.component.css'
})
export class GymComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly facade = inject(GymFacadeService);
  private readonly chromeService = inject(AppChromeService);

  readonly activeTab = this.facade.activeTab;
  readonly activeSheet = signal<'none' | 'hub' | 'builder' | 'graphs' | 'graph-detail' | 'session-share' | 'session-exit'>('none');
  readonly sessionHubTab = signal<'plans' | 'exercises' | 'help'>('plans');
  readonly workoutSurfaceMode = signal<'workout' | 'history'>('workout');
  readonly workoutHeaderTitle = computed(() => this.facade.selectedOverview()?.dayName || 'Workout Session');
  readonly workoutHeaderMeta = computed(() => this.facade.currentExercise()?.name || 'Aktive Session');

  readonly dumbbellIcon = Dumbbell;
  readonly barChartIcon = BarChart3;
  readonly userIcon = User;
  readonly workoutIcon = Timer;
  readonly backIcon = ArrowLeft;
  readonly moreIcon = Ellipsis;

  constructor() {
    effect(() => {
      const sessionActive = Boolean(this.facade.activeSession());
      this.chromeService.setSuppressed(sessionActive);
      if (!sessionActive) {
        this.workoutSurfaceMode.set('workout');
      }
    });
  }

  ngOnInit(): void {
    void this.facade.activate();
  }

  ngAfterViewInit(): void {
    this.scheduleScrollRestore();
  }

  ngOnDestroy(): void {
    this.chromeService.setSuppressed(false);
    this.facade.deactivate(this.readScrollY());
  }

  async onHeroTabChange(value: 'tracker' | 'progress'): Promise<void> {
    if (value === 'progress') {
      await this.facade.activateProgressTab();
      return;
    }
    this.facade.activeTab.set('tracker');
  }

  openSessionHub(tab: 'plans' | 'exercises' | 'help'): void {
    this.sessionHubTab.set(tab);
    this.activeSheet.set('hub');
  }

  startPlanBuilder(): void {
    this.facade.syncBuilderDayCount();
    this.activeSheet.set('builder');
  }

  sessionHubTitle(): string {
    const tab = this.sessionHubTab();
    if (tab === 'plans') {
      return 'Session-Hub: Pläne';
    }
    if (tab === 'exercises') {
      return 'Session-Hub: Übungen';
    }
    return 'Session Hub: Hilfe';
  }

  closeSheet(): void {
    if (this.activeSheet() === 'session-share') {
      this.facade.resetWorkoutShareState();
    }
    if (this.activeSheet() === 'graph-detail') {
      this.facade.clearDetailSelection();
    }
    this.activeSheet.set('none');
  }

  onSetInput(change: GymSetInputChange): void {
    this.facade.onSetInput(change.setRow, change.field, change.value);
  }

  async onFinishWorkout(): Promise<void> {
    const completed = await this.facade.finishWorkout(false);
    if (completed) {
      this.activeSheet.set('session-share');
    }
  }

  openSessionExitSheet(): void {
    this.activeSheet.set('session-exit');
  }

  setWorkoutSurfaceMode(mode: 'workout' | 'history'): void {
    this.workoutSurfaceMode.set(mode);
  }

  async onSavePlan(): Promise<void> {
    const saved = await this.facade.savePlan();
    if (saved) {
      this.sessionHubTab.set('plans');
      this.activeSheet.set('hub');
    }
  }

  async onAddGraphWidget(): Promise<void> {
    const added = await this.facade.addGraphWidget(this.activeTab() === 'progress');
    if (added) {
      this.activeSheet.set('none');
    }
  }

  async openProgressDetail(kind: '10rm' | 'volume'): Promise<void> {
    this.activeSheet.set('graph-detail');
    await this.facade.openProgressDetail(kind);
  }

  async submitSessionCommunityPost(): Promise<void> {
    const shared = await this.facade.submitSessionCommunityPost();
    if (shared) {
      this.activeSheet.set('none');
    }
  }

  skipSessionShare(): void {
    this.facade.resetWorkoutShareState();
    this.activeSheet.set('none');
  }

  private scheduleScrollRestore(): void {
    if (typeof window === 'undefined') {
      return;
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top: this.facade.scrollY(), left: 0, behavior: 'auto' });
    });
  }

  private readScrollY(): number {
    if (typeof window === 'undefined') {
      return 0;
    }

    return window.scrollY || window.pageYOffset || 0;
  }
}
