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
  @Input({ required: true }) embedForm!: FormGroup;
  @Input() colorHex = '#000000';
  @Input() isScraping = false;
  @Input() hasToken = false;
  @Input() messageType: MessageType | null = null;
  @Output() colorChange = new EventEmitter<string>();
  @Output() assetStoreScrape = new EventEmitter<void>();
  @Output() messageTypeSelect = new EventEmitter<MessageType>();

  get embedGroup(): FormGroup {
    return this.embedForm;
  }

  get fieldsArray(): FormArray {
    return this.embedGroup.get('fields') as FormArray;
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

  get urlPlaceholder(): string {
    if (this.messageType === 'fab') {
      return 'https://www.fab.com/listings/...';
    }
    if (this.messageType === 'unity') {
      return 'https://assetstore.unity.com/packages/...';
    }
    return 'https://example.com';
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
