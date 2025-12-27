import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-embed-builder',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './embed-builder.component.html',
  styleUrl: './embed-builder.component.scss',
})
export class EmbedBuilderComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input() colorHex = '#000000';
  @Input() isScraping = false;
  @Output() colorChange = new EventEmitter<string>();
  @Output() assetStoreScrape = new EventEmitter<void>();

  get embedGroup(): FormGroup {
    return this.form.get('embed') as FormGroup;
  }

  get fieldsArray(): FormArray {
    return this.embedGroup.get('fields') as FormArray;
  }

  get hasToken(): boolean {
    const token = this.form?.get('token')?.value;
    return typeof token === 'string' && token.trim().length > 0;
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
