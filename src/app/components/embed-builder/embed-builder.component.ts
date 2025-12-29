import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { MessageType } from '../../models/embed.model';
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
  @Input() messageType: MessageType | null = null;
  @Output() colorChange = new EventEmitter<string>();
  @Output() assetStoreScrape = new EventEmitter<void>();
  @Output() bulkJsonOpen = new EventEmitter<void>();
  @Output() bulkJsonCopy = new EventEmitter<void>();
  @Output() messageTypeSelect = new EventEmitter<MessageType>();

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

  get isCustomThumbnail(): boolean {
    return this.messageType === 'custom';
  }

  get storeLabel(): string {
    if (this.messageType === 'unity') {
      return 'Unity Asset Store';
    }
    if (this.messageType === 'fab') {
      return 'Fab';
    }
    return 'selected store';
  }

  get fetchButtonLabel(): string {
    if (this.messageType === 'unity') {
      return 'Fetch from Asset Store';
    }
    if (this.messageType === 'fab') {
      return 'Fetch from Fab';
    }
    return 'Fetch';
  }

  addField(): void {
    this.fieldsArray.push(
      new FormGroup({
        name: new FormControl(''),
        value: new FormControl(''),
        inline: new FormControl(true),
      })
    );
  }

  removeField(index: number): void {
    this.fieldsArray.removeAt(index);
  }
}
