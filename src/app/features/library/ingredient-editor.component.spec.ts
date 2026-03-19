import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { IngredientEditorComponent } from './ingredient-editor.component';
import { createIngredientForm } from './library-editor-form-factory';

describe('IngredientEditorComponent', () => {
  let fixture: ComponentFixture<IngredientEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IngredientEditorComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(IngredientEditorComponent);
    const form = createIngredientForm(TestBed.inject(FormBuilder));

    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('editing', false);
    fixture.componentRef.setInput('macroPasteText', '');
    fixture.componentRef.setInput('macroPasteMessage', null);
    fixture.componentRef.setInput('detailsExpanded', false);
    fixture.componentRef.setInput('baseIngredientOptions', []);
    fixture.componentRef.setInput('marketSuggestions', []);
    fixture.detectChanges();
  });

  it('keeps the name field first and macro paste near the top of the flow', () => {
    const textInputs = fixture.debugElement.queryAll(By.css('input[matinput], textarea[matinput]'));
    const firstInput = textInputs[0].nativeElement as HTMLInputElement;
    const macroPaste = fixture.debugElement.query(By.css('#ing-macro-paste'));

    expect(firstInput.id).toBe('ing-name');
    expect(macroPaste).toBeTruthy();
  });
});
