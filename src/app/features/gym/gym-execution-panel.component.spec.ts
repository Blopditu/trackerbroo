import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { GymExecutionPanelComponent } from './gym-execution-panel.component';

describe('GymExecutionPanelComponent', () => {
  let fixture: ComponentFixture<GymExecutionPanelComponent>;
  let component: GymExecutionPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GymExecutionPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GymExecutionPanelComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('session', {
      sessionId: 'session-1',
      sessionClientRef: 'session-client-1',
      sessionDate: '2026-03-12',
      startedAt: '2026-03-12T08:00:00.000Z',
      planDayId: 'day-1',
      status: 'in_progress',
      exercises: [
        {
          sessionExerciseId: 'session-ex-1',
          exerciseId: 'exercise-1',
          sortOrder: 1,
          name: 'Bench Press',
          equipment: 'barbell',
          images: [],
          targetReps: 8,
          targetSeconds: null,
          plannedSets: 3,
          primaryMuscle: 'chest',
          secondaryMuscles: ['triceps'],
          sets: [
            {
              id: 'set-1',
              setNumber: 1,
              isWarmup: false,
              weightKg: 20,
              reps: 8,
              durationSeconds: null,
              estimated10Rm: null,
              volume: 160,
              isCompleted: false,
              clientRef: 'set-client-1',
            },
          ],
        },
      ],
    });
    fixture.componentRef.setInput('activeExerciseIndex', 0);
    fixture.componentRef.setInput(
      'currentExercise',
      fixture.componentInstance.session()!.exercises[0],
    );
    fixture.componentRef.setInput('previousPerformance', []);
    fixture.componentRef.setInput('currentExerciseSaveHint', null);
    fixture.detectChanges();
  });

  it('emits parsed set input updates', () => {
    const emitSpy = vi.spyOn(component.setInput, 'emit');

    const input = fixture.debugElement.queryAll(By.css('input'))[0]
      .nativeElement as HTMLInputElement;
    input.value = '22.5';
    input.dispatchEvent(new Event('input'));

    expect(emitSpy).toHaveBeenCalledWith({
      setRow: expect.objectContaining({ clientRef: 'set-client-1' }),
      field: 'weight',
      value: '22.5',
    });
  });

  it('emits completion toggles for the active set', () => {
    const emitSpy = vi.spyOn(component.toggleSetComplete, 'emit');

    const button = fixture.debugElement.query(By.css('.active-set-actions .action-btn'))
      .nativeElement as HTMLButtonElement;
    button.click();

    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ clientRef: 'set-client-1' }));
  });
});
