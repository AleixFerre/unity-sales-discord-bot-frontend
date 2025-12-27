import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-embed-builder',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './embed-builder.component.html',
  styleUrl: './embed-builder.component.scss',
})
export class EmbedBuilderComponent {
  @Input({ required: true }) form!: FormGroup;

  get embedGroup(): FormGroup {
    return this.form.get('embed') as FormGroup;
  }

  get fieldsArray(): FormArray {
    return this.embedGroup.get('fields') as FormArray;
  }

  addField(): void {
    this.fieldsArray.push(
      new FormGroup({
        name: new FormControl(''),
        value: new FormControl(''),
        inline: new FormControl(false),
      })
    );
  }

  removeField(index: number): void {
    this.fieldsArray.removeAt(index);
  }
}
