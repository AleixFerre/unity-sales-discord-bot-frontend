import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Subject, finalize, takeUntil } from 'rxjs';

import { EmbedBuilderComponent } from '../../components/embed-builder/embed-builder.component';
import { EmbedPreviewComponent } from '../../components/embed-preview/embed-preview.component';
import { EmbedConfig, EmbedRequest, MessageType } from '../../models/embed.model';
import {
  AssetStoreDataWithPromo,
  BulkEmbedPayload,
  EmbedFormService,
} from '../../services/embed-form.service';
import { AssetStoreData, EmbedService } from '../../services/embed.service';

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

@Component({
  selector: 'app-home',
  imports: [CommonModule, ReactiveFormsModule, EmbedBuilderComponent, EmbedPreviewComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly embedService = inject(EmbedService);
  private readonly embedFormService = inject(EmbedFormService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly formRefresh$ = new Subject<void>();

  form = this.buildForm();

  previewEmbed: EmbedConfig = this.form.getRawValue().embed as EmbedConfig;
  colorHex = this.toHexColor(this.previewEmbed.color);
  status: StatusMessage = null;
  isSubmitting = false;
  isScraping = false;
  isBulkModalOpen = false;
  bulkJsonControl = new FormControl('', { nonNullable: true });
  bulkJsonError: string | null = null;

  constructor() {
    this.connectForm();
  }

  private buildForm(defaults?: EmbedConfig, tokenValue = ''): FormGroup {
    const embed = defaults ?? this.buildBlankEmbed();
    return this.formBuilder.group({
      token: new FormControl(tokenValue, { validators: [Validators.required] }),
      embed: this.formBuilder.group({
        messageType: new FormControl<MessageType | null>(defaults?.messageType ?? null, {
          validators: [Validators.required],
        }),
        title: new FormControl(embed.title, {
          nonNullable: true,
          validators: [Validators.required],
        }),
        color: new FormControl(embed.color, {
          nonNullable: true,
          validators: [Validators.required, Validators.min(0), Validators.max(16777215)],
        }),
        url: new FormControl(embed.url, {
          nonNullable: true,
          validators: [Validators.required, Validators.pattern(/^https?:\/\/.+/i)],
        }),
        fields: this.buildFieldsArray(embed.fields),
        footer: this.formBuilder.group({
          text: new FormControl(embed.footer.text, {
            nonNullable: true,
            validators: [Validators.required],
          }),
        }),
        thumbnail: this.formBuilder.group({
          url: new FormControl(embed.thumbnail.url, { nonNullable: true }),
        }),
        image: this.formBuilder.group({
          url: new FormControl(embed.image.url, { nonNullable: true }),
        }),
      }),
    });
  }

  private buildBlankEmbed(): EmbedConfig {
    return {
      title: '',
      color: 0,
      url: '',
      fields: [],
      footer: { text: '' },
      thumbnail: { url: '' },
      image: { url: '' },
    };
  }

  private connectForm(): void {
    this.formRefresh$.next();
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.formRefresh$))
      .subscribe(() => {
        this.syncPreview();
      });
    this.messageTypeControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), takeUntil(this.formRefresh$))
      .subscribe((messageType) => {
        this.updateUrlValidators(messageType);
        this.updateThumbnailState(messageType);
      });
    const messageType = this.messageTypeControl.value;
    this.updateUrlValidators(messageType);
    this.updateThumbnailState(messageType);
    this.syncPreview();
  }

  get fieldsArray(): FormArray {
    return this.form.get('embed.fields') as FormArray;
  }

  get messageTypeControl(): FormControl<MessageType | null> {
    return this.form.get('embed.messageType') as FormControl<MessageType | null>;
  }

  handleMessageTypeSelection(type: MessageType): void {
    if (this.messageTypeControl.value === type) {
      return;
    }
    if (this.form.dirty) {
      const confirmed = window.confirm(
        'Changing the message type will reset the form content. Are you sure?'
      );
      if (!confirmed) {
        return;
      }
    }
    this.resetFormForType(type);
  }

  handleColorChange(hex: string): void {
    if (this.messageTypeControl.value !== 'custom') {
      return;
    }
    const numericColor = this.fromHexColor(hex);
    const colorControl = this.form.get('embed.color');
    if (colorControl) {
      colorControl.setValue(numericColor);
    }
  }

  handleSend(): void {
    this.status = null;
    if (this.form.invalid) {
      this.status = { type: 'error', text: 'Please fix the missing fields before sending.' };
      this.changeDetectorRef.markForCheck();
      return;
    }

    const payload: EmbedRequest = {
      embed: this.formatEmbedDates(this.form.getRawValue().embed as EmbedConfig),
    };
    const token = this.form.getRawValue().token ?? '';

    this.isSubmitting = true;
    this.changeDetectorRef.markForCheck();
    this.embedService
      .sendEmbed(payload, token)
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.status = { type: 'success', text: 'Embed delivered to the backend.' };
          this.changeDetectorRef.markForCheck();
        },
        error: (error: Error) => {
          this.status = { type: 'error', text: error?.message || 'Failed to send the embed.' };
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  handleAssetStoreScrape(): void {
    const messageType = this.messageTypeControl.value;
    if (!messageType || messageType === 'custom') {
      this.status = {
        type: 'error',
        text: 'Select Unity or Fab before fetching store data.',
      };
      this.changeDetectorRef.markForCheck();
      return;
    }
    const url = this.form.get('embed.url')?.value?.trim();
    if (!url || !this.embedFormService.isSupportedAssetListingUrl(url, messageType)) {
      this.status = {
        type: 'error',
        text: 'Enter a valid Unity Asset Store or Fab listing URL before fetching.',
      };
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.status = null;
    this.isScraping = true;
    this.changeDetectorRef.markForCheck();
    const token = this.form.getRawValue().token ?? '';
    this.embedService
      .fetchAssetStoreData(url, token)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.isScraping = false;
          this.changeDetectorRef.markForCheck();
        })
      )
      .subscribe({
        next: (data) => {
          if (!this.hasAssetStoreData(data)) {
            this.status = { type: 'error', text: 'No data found for this store listing URL.' };
            this.changeDetectorRef.markForCheck();
            return;
          }
          this.applyAssetStoreData(url, data);
        },
        error: (error: Error) => {
          this.status = {
            type: 'error',
            text: error?.message || 'Failed to fetch store data.',
          };
          this.changeDetectorRef.markForCheck();
        },
      });
  }

  handleCopyJson(): void {
    const messageType = this.messageTypeControl.value;
    if (!messageType) {
      this.status = { type: 'error', text: 'Select a message type before copying JSON.' };
      this.changeDetectorRef.markForCheck();
      return;
    }
    const payload: EmbedRequest = {
      embed: this.formatEmbedDates(this.form.getRawValue().embed as EmbedConfig),
    };
    const json = JSON.stringify(payload, null, 2);
    this.copyToClipboard(json)
      .then(() => {
        this.status = { type: 'success', text: 'JSON payload copied to clipboard.' };
        this.changeDetectorRef.markForCheck();
      })
      .catch(() => {
        this.status = { type: 'error', text: 'Failed to copy JSON payload.' };
        this.changeDetectorRef.markForCheck();
      });
  }

  openBulkJsonModal(): void {
    this.bulkJsonControl.setValue('');
    this.bulkJsonError = null;
    this.isBulkModalOpen = true;
    this.changeDetectorRef.markForCheck();
  }

  closeBulkJsonModal(): void {
    this.isBulkModalOpen = false;
    this.changeDetectorRef.markForCheck();
  }

  applyBulkJson(): void {
    this.bulkJsonError = null;
    const raw = this.bulkJsonControl.value.trim();
    if (!raw) {
      this.bulkJsonError = 'Paste the JSON payload you want to apply.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.bulkJsonError = 'Invalid JSON. Make sure the payload is valid JSON.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      this.bulkJsonError = 'JSON payload must be an object with fields to update.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    const payload = this.embedFormService.extractBulkPayload(parsed as Record<string, unknown>);
    const assetPayload = payload.asset;
    const embedPayload = payload.embed;
    if (!this.hasAssetPayloadUpdates(assetPayload) && !this.hasEmbedPayloadUpdates(embedPayload)) {
      this.bulkJsonError =
        'JSON payload has no supported fields. Use embed.* fields or top-level title, imageUrl, price, promoCode, url, or messageType.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    const incomingType = embedPayload?.messageType ?? assetPayload.messageType ?? null;
    const selectedType = this.messageTypeControl.value;
    let effectiveType = selectedType;
    if (incomingType) {
      if (incomingType !== selectedType) {
        if (this.form.dirty) {
          const confirmed = window.confirm(
            'Applying this JSON will reset the form content for the new message type. Continue?'
          );
          if (!confirmed) {
            return;
          }
        }
        this.resetFormForType(incomingType);
      }
      effectiveType = incomingType;
    } else if (!selectedType) {
      this.bulkJsonError = 'Select a message type or include messageType in the JSON payload.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    const urlFromPayload = (embedPayload?.url ?? assetPayload.url)?.trim();
    const currentUrl = this.form.get('embed.url')?.value?.toString().trim() ?? '';
    if (effectiveType === 'custom') {
      if (urlFromPayload) {
        this.form.get('embed.url')?.setValue(urlFromPayload);
      }
      if (embedPayload) {
        this.applyEmbedPayload(embedPayload);
      }
      this.applyAssetPayload(assetPayload, embedPayload);
    } else {
      if (!effectiveType) {
        return;
      }
      if (urlFromPayload) {
        if (!this.embedFormService.isSupportedAssetUrl(urlFromPayload, effectiveType)) {
          this.bulkJsonError = 'Provide a valid store URL for the selected message type.';
          this.changeDetectorRef.markForCheck();
          return;
        }
      }
      if (embedPayload) {
        this.applyEmbedPayload(embedPayload);
      }
      this.applyAssetPayload(assetPayload, embedPayload);
    }
    this.status = { type: 'success', text: 'Bulk updates applied to the form.' };
    this.isBulkModalOpen = false;
    this.changeDetectorRef.markForCheck();
  }

  private resetFormForType(type: MessageType): void {
    const defaults = this.embedFormService.getDefaultsForType(type);
    const tokenValue = this.form.get('token')?.value ?? '';
    this.form = this.buildForm(defaults, tokenValue);
    this.connectForm();
  }

  private copyToClipboard(text: string): Promise<void> {
    if (navigator?.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) {
          resolve();
        } else {
          reject(new Error('Copy failed.'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  private updateUrlValidators(messageType: MessageType | null): void {
    const urlControl = this.form.get('embed.url');
    if (!urlControl) {
      return;
    }
    const validators = [Validators.required, Validators.pattern(/^https?:\/\/.+/i)];
    if (messageType === 'unity' || messageType === 'fab') {
      validators.push(this.storeUrlValidator(messageType));
    }
    urlControl.setValidators(validators);
    urlControl.updateValueAndValidity({ emitEvent: false });
  }

  private storeUrlValidator(type: MessageType) {
    return (control: AbstractControl) => {
      const value = control.value?.toString().trim() ?? '';
      if (!value) {
        return null;
      }
      return this.embedFormService.isSupportedAssetUrl(value, type)
        ? null
        : { storeMismatch: true };
    };
  }

  private updateThumbnailState(messageType: MessageType | null): void {
    const thumbnailControl = this.form.get('embed.thumbnail.url');
    if (!thumbnailControl) {
      return;
    }
    if (messageType === 'custom') {
      thumbnailControl.enable({ emitEvent: false });
    } else {
      thumbnailControl.disable({ emitEvent: false });
    }
  }

  private createField(name: string, value: string, inline: boolean): FormGroup {
    return this.formBuilder.group({
      name: new FormControl(name, { nonNullable: true }),
      value: new FormControl(value, { nonNullable: true }),
      inline: new FormControl(inline, { nonNullable: true }),
    });
  }

  private applyAssetStoreData(url: string, data: AssetStoreDataWithPromo): void {
    const embedGroup = this.form.get('embed') as FormGroup;
    if (embedGroup.get('url')?.value !== url) {
      embedGroup.get('url')?.setValue(url);
    }
    if (data.title) {
      embedGroup.get('title')?.setValue(data.title);
    }
    if (data.imageUrl) {
      embedGroup.get('image.url')?.setValue(data.imageUrl);
    }
    const messageType = this.messageTypeControl.value;
    if (messageType) {
      const defaults = this.embedFormService.getDefaultsForType(messageType);
      embedGroup.get('thumbnail.url')?.setValue(defaults.thumbnail.url);
      embedGroup.get('color')?.setValue(defaults.color);
    }
    if (data.price) {
      this.applyDiscountPrice(data.price);
    }
    if (data.promoCode) {
      this.applyPromoCode(data.promoCode);
    }
  }

  private applyAssetStoreDataWithoutUrl(data: AssetStoreDataWithPromo): void {
    const embedGroup = this.form.get('embed') as FormGroup;
    if (data.title) {
      embedGroup.get('title')?.setValue(data.title);
    }
    if (data.imageUrl) {
      embedGroup.get('image.url')?.setValue(data.imageUrl);
    }
    if (data.price) {
      this.applyDiscountPrice(data.price);
    }
    if (data.promoCode) {
      this.applyPromoCode(data.promoCode);
    }
  }

  private applyAssetPayload(
    payload: AssetStoreDataWithPromo & { url?: string },
    embedPayload?: BulkEmbedPayload
  ): void {
    const embedGroup = this.form.get('embed') as FormGroup;
    if (payload.url && embedPayload?.url === undefined) {
      embedGroup.get('url')?.setValue(payload.url);
    }
    if (payload.title && embedPayload?.title === undefined) {
      embedGroup.get('title')?.setValue(payload.title);
    }
    if (payload.imageUrl && embedPayload?.image?.url === undefined) {
      embedGroup.get('image.url')?.setValue(payload.imageUrl);
    }
    if (payload.price) {
      this.applyDiscountPrice(payload.price);
    }
    if (payload.promoCode) {
      this.applyPromoCode(payload.promoCode);
    }
  }

  private applyEmbedPayload(payload: BulkEmbedPayload): void {
    const embedGroup = this.form.get('embed') as FormGroup;
    if (payload.title !== undefined) {
      embedGroup.get('title')?.setValue(payload.title);
    }
    if (payload.color !== undefined) {
      embedGroup.get('color')?.setValue(payload.color);
    }
    if (payload.url !== undefined) {
      embedGroup.get('url')?.setValue(payload.url);
    }
    if (payload.fields !== undefined) {
      this.fieldsArray.clear();
      payload.fields.forEach((field) => {
        const normalizedValue = this.normalizeDateInputValue(field.name, field.value);
        this.fieldsArray.push(this.createField(field.name, normalizedValue, field.inline));
      });
    }
    if (payload.footer?.text !== undefined) {
      embedGroup.get('footer.text')?.setValue(payload.footer.text);
    }
    if (payload.thumbnail?.url !== undefined) {
      embedGroup.get('thumbnail.url')?.setValue(payload.thumbnail.url);
    }
    if (payload.image?.url !== undefined) {
      embedGroup.get('image.url')?.setValue(payload.image.url);
    }
  }

  private hasAssetStoreData(data: AssetStoreData | null | undefined): boolean {
    if (!data) {
      return false;
    }
    return Boolean(data.title || data.imageUrl || data.price);
  }

  private applyPromoCode(code: string): void {
    const normalized = code.trim();
    if (!normalized) {
      return;
    }
    const field = this.fieldsArray.controls.find((control) => {
      const nameValue = control.get('name')?.value?.toString().trim().toLowerCase();
      return nameValue === 'código' || nameValue === 'codigo' || nameValue === 'code';
    });
    field?.get('value')?.setValue(normalized);
  }

  private applyDiscountPrice(price: string): void {
    const formatted = this.formatPrice(price);
    if (!formatted) {
      return;
    }
    const field = this.fieldsArray.controls.find((control) => {
      return control.get('name')?.value?.toString().trim().toLowerCase() === 'preu';
    });
    field?.get('value')?.setValue(`~~${formatted}~~ GRATIS`);
  }

  private hasAssetPayloadUpdates(
    payload: AssetStoreDataWithPromo & { url?: string; messageType?: MessageType }
  ): boolean {
    return Boolean(
      payload.title ||
        payload.imageUrl ||
        payload.price ||
        payload.promoCode ||
        payload.url ||
        payload.messageType
    );
  }

  private hasEmbedPayloadUpdates(payload?: BulkEmbedPayload): boolean {
    if (!payload) {
      return false;
    }
    return (
      payload.messageType !== undefined ||
      payload.title !== undefined ||
      payload.color !== undefined ||
      payload.url !== undefined ||
      payload.fields !== undefined ||
      payload.footer !== undefined ||
      payload.thumbnail !== undefined ||
      payload.image !== undefined
    );
  }

  private syncPreview(): void {
    const rawValue = this.form.getRawValue();
    this.previewEmbed = this.formatEmbedDates(rawValue.embed as EmbedConfig);
    this.colorHex = this.toHexColor(this.previewEmbed.color);
    this.changeDetectorRef.markForCheck();
  }

  private buildFieldsArray(fields: { name: string; value: string; inline: boolean }[]): FormArray {
    return this.formBuilder.array(
      fields.map((field) => this.createField(field.name, field.value, field.inline))
    );
  }

  private toHexColor(color: number | null | undefined): string {
    const safeColor = typeof color === 'number' ? color : 0;
    return `#${safeColor.toString(16).padStart(6, '0')}`;
  }

  private fromHexColor(hex: string): number {
    const normalized = hex.replace('#', '');
    const parsed = Number.parseInt(normalized, 16);
    if (Number.isNaN(parsed)) {
      return 0;
    }
    return parsed;
  }

  private formatPrice(price: string): string {
    const trimmed = price.trim();
    if (!trimmed) {
      return '';
    }
    const normalized = trimmed.replace(/[$€£]/g, '').trim();
    return normalized ? `€${normalized}` : '';
  }

  private formatEmbedDates(embed: EmbedConfig): EmbedConfig {
    const fields = embed.fields.map((field) => {
      if (this.isDateField(field.name)) {
        return { ...field, value: this.formatDateValue(field.value) };
      }
      return field;
    });
    return { ...embed, fields };
  }

  private isDateField(name: string): boolean {
    return name.trim().toLowerCase() === 'fi';
  }

  private formatDateValue(value: string | null | undefined): string {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
      return '';
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (!match) {
      return trimmed;
    }
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  private normalizeDateInputValue(name: string, value: string): string {
    if (!this.isDateField(name)) {
      return value;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
    if (!match) {
      return trimmed;
    }
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
}
