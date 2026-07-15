import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { MessageType } from '../../models/embed.model';
import {
  EmbedFormGroup,
  FieldFormGroup,
  MAX_EMBED_IMAGES,
  MediaFormGroup,
} from '../../services/embed-composer.service';
import { isCodeField, isDateField } from '../../utils/embed-format';

@Component({
  selector: 'app-embed-builder',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './embed-builder.component.html',
  styleUrl: './embed-builder.component.scss',
})
export class EmbedBuilderComponent {
  readonly embedForm = input.required<EmbedFormGroup>();
  readonly messageType = input.required<MessageType>();
  readonly colorHex = input('#000000');
  readonly isScraping = input(false);
  readonly hasToken = input(false);
  readonly isStoreUrlValid = input(true);
  readonly storeUrlMismatch = input(false);
  readonly colorChange = output<string>();
  readonly assetStoreScrape = output<void>();

  protected readonly isCustom = computed(() => this.messageType() === 'custom');
  protected readonly storeLabel = computed(() =>
    this.messageType() === 'unity' ? 'Unity Asset Store' : 'Fab'
  );
  protected readonly fetchButtonLabel = computed(() =>
    this.messageType() === 'unity' ? 'Fetch from Asset Store' : 'Fetch from Fab'
  );
  protected readonly urlPlaceholder = computed(() => {
    switch (this.messageType()) {
      case 'unity':
        return 'https://assetstore.unity.com/packages/...';
      case 'fab':
        return 'https://www.fab.com/listings/...';
      default:
        return 'https://example.com';
    }
  });

  protected readonly maxImages = MAX_EMBED_IMAGES;

  protected get fieldsArray(): FormArray<FieldFormGroup> {
    return this.embedForm().controls.fields;
  }

  protected get imagesArray(): FormArray<MediaFormGroup> {
    return this.embedForm().controls.images;
  }

  protected addImage(): void {
    if (this.imagesArray.length >= MAX_EMBED_IMAGES) {
      return;
    }
    this.imagesArray.push(
      new FormGroup({
        url: new FormControl('', { nonNullable: true }),
      })
    );
  }

  protected removeImage(index: number): void {
    this.imagesArray.removeAt(index);
  }

  protected addField(): void {
    this.fieldsArray.push(
      new FormGroup({
        name: new FormControl('', { nonNullable: true }),
        value: new FormControl('', { nonNullable: true }),
        inline: new FormControl(true, { nonNullable: true }),
      })
    );
  }

  protected removeField(index: number): void {
    this.fieldsArray.removeAt(index);
  }

  protected isDateName(field: FieldFormGroup): boolean {
    return isDateField(field.controls.name.value);
  }

  protected namePlaceholder(index: number): string {
    return index === 0 ? 'Preu' : index === 1 ? 'Fi' : index === 2 ? 'Codi' : 'Field name';
  }

  protected valuePlaceholder(field: FieldFormGroup): string {
    return isCodeField(field.controls.name.value) ? 'CODEGOESHERE' : '$19.99';
  }
}
