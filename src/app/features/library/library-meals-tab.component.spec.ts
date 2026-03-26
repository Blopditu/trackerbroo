import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { LibraryMealsTabComponent } from './library-meals-tab.component';

describe('LibraryMealsTabComponent', () => {
  let fixture: ComponentFixture<LibraryMealsTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibraryMealsTabComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LibraryMealsTabComponent);
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('meals', [
      {
        id: 'meal-1',
        name: 'Skyr Bowl',
        costLabel: '2.50 EUR',
        macros: { kcal: 430, protein: 35, carbs: 42, fat: 8 },
      },
    ]);
    fixture.componentRef.setInput('totalCount', 1);
    fixture.componentRef.setInput('hasMore', false);
    fixture.detectChanges();
  });

  it('renders meals from inputs only and emits open actions', () => {
    const emitSpy = vi.spyOn(fixture.componentInstance.openActions, 'emit');
    const cardText = fixture.nativeElement.textContent as string;

    expect(cardText).toContain('Skyr Bowl');
    expect(cardText).toContain('2.50 EUR');

    const button = fixture.debugElement.query(By.css('.library-edit-btn'))
      .nativeElement as HTMLButtonElement;
    button.click();

    expect(emitSpy).toHaveBeenCalledWith('meal-1');
  });
});
