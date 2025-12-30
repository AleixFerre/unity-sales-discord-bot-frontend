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

  previewEmbeds: EmbedConfig[] = this.getFormattedEmbeds();
  status: StatusMessage = null;
  isSubmitting = false;
  isBulkModalOpen = false;
  bulkJsonControl = new FormControl('', { nonNullable: true });
  bulkJsonError: string | null = null;
  private readonly scrapingEmbeds = new Set<number>();
  expandedEmbedIndex = 0;

  constructor() {
    this.connectForm();
  }

  private buildForm(defaults: EmbedConfig[] = [this.buildBlankEmbed()], tokenValue = ''): FormGroup {
    return this.formBuilder.group({
      token: new FormControl(tokenValue, { validators: [Validators.required] }),
      embeds: this.formBuilder.array(defaults.map((embed) => this.buildEmbedGroup(embed))),
    });
  }

  private buildEmbedGroup(embed: EmbedConfig): FormGroup {
    return this.formBuilder.group({
      messageType: new FormControl<MessageType | null>(embed.messageType ?? null, {
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
    this.embedsArray.controls.forEach((control) => {
      const embedGroup = control as FormGroup;
      const messageType = this.getMessageTypeControl(embedGroup).value;
      this.updateUrlValidators(embedGroup, messageType);
      this.updateThumbnailState(embedGroup, messageType);
    });
    this.syncPreview();
  }

  get embedsArray(): FormArray {
    return this.form.get('embeds') as FormArray;
  }

  get hasToken(): boolean {
    const token = this.form?.get('token')?.value;
    return typeof token === 'string' && token.trim().length > 0;
  }

  isScraping(index: number): boolean {
    return this.scrapingEmbeds.has(index);
  }

  getEmbedGroup(index: number): FormGroup {
    return this.embedsArray.at(index) as FormGroup;
  }

  getMessageTypeControl(embedGroup: FormGroup): FormControl<MessageType | null> {
    return embedGroup.get('messageType') as FormControl<MessageType | null>;
  }

  getFieldsArray(embedGroup: FormGroup): FormArray {
    return embedGroup.get('fields') as FormArray;
  }

  getMessageType(index: number): MessageType | null {
    return this.getMessageTypeControl(this.getEmbedGroup(index)).value;
  }

  getColorHex(index: number): string {
    const color = this.getEmbedGroup(index).get('color')?.value as number | null | undefined;
    return this.toHexColor(color);
  }

  addEmbed(): void {
    const baseType = this.getMessageType(0);
    const embed = baseType ? this.embedFormService.getDefaultsForType(baseType) : this.buildBlankEmbed();
    this.embedsArray.push(this.buildEmbedGroup(embed));
    this.updateUrlValidators(this.getEmbedGroup(this.embedsArray.length - 1), baseType);
    this.updateThumbnailState(this.getEmbedGroup(this.embedsArray.length - 1), baseType);
    this.expandedEmbedIndex = this.embedsArray.length - 1;
    this.changeDetectorRef.markForCheck();
  }

  removeEmbed(index: number): void {
    if (this.embedsArray.length <= 1) {
      return;
    }
    this.embedsArray.removeAt(index);
    this.scrapingEmbeds.clear();
    if (this.expandedEmbedIndex >= this.embedsArray.length) {
      this.expandedEmbedIndex = Math.max(0, this.embedsArray.length - 1);
    }
    this.syncPreview();
  }

  toggleEmbed(index: number): void {
    this.expandedEmbedIndex = this.expandedEmbedIndex === index ? -1 : index;
  }

  handleMessageTypeSelection(index: number, type: MessageType): void {
    const embedGroup = this.getEmbedGroup(index);
    const messageTypeControl = this.getMessageTypeControl(embedGroup);
    if (messageTypeControl.value === type) {
      return;
    }
    if (embedGroup.dirty) {
      const confirmed = window.confirm(
        'Changing the message type will reset the form content. Are you sure?'
      );
      if (!confirmed) {
        return;
      }
    }
    this.resetEmbedForType(index, type);
  }

  handleColorChange(index: number, hex: string): void {
    const embedGroup = this.getEmbedGroup(index);
    if (this.getMessageTypeControl(embedGroup).value !== 'custom') {
      return;
    }
    const numericColor = this.fromHexColor(hex);
    const colorControl = embedGroup.get('color');
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

    const embeds = this.getFormattedEmbeds();
    const payload: EmbedRequest =
      embeds.length === 1 ? { embed: embeds[0] } : { embeds };
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

  handleAssetStoreScrape(index: number): void {
    const embedGroup = this.getEmbedGroup(index);
    const messageType = this.getMessageTypeControl(embedGroup).value;
    if (!messageType || messageType === 'custom') {
      this.status = {
        type: 'error',
        text: 'Select Unity or Fab before fetching store data.',
      };
      this.changeDetectorRef.markForCheck();
      return;
    }
    const url = embedGroup.get('url')?.value?.trim();
    if (!url || !this.embedFormService.isSupportedAssetListingUrl(url, messageType)) {
      this.status = {
        type: 'error',
        text: 'Enter a valid Unity Asset Store or Fab listing URL before fetching.',
      };
      this.changeDetectorRef.markForCheck();
      return;
    }

    this.status = null;
    this.scrapingEmbeds.add(index);
    this.changeDetectorRef.markForCheck();
    const token = this.form.getRawValue().token ?? '';
    this.embedService
      .fetchAssetStoreData(url, token)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.scrapingEmbeds.delete(index);
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
          this.applyAssetStoreData(url, data, embedGroup);
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
    const embeds = this.getFormattedEmbeds();
    if (embeds.length === 0) {
      this.status = { type: 'error', text: 'Add an embed before copying JSON.' };
      this.changeDetectorRef.markForCheck();
      return;
    }
    const payload: EmbedRequest =
      embeds.length === 1 ? { embed: embeds[0] } : { embeds };
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

    const embedList = (parsed as Record<string, unknown>)['embeds'];
    if (Array.isArray(embedList)) {
      const nextGroups: FormGroup[] = [];
      const topLevelType = this.parseMessageType((parsed as Record<string, unknown>)['messageType']);
      for (let index = 0; index < embedList.length; index += 1) {
        const entry = embedList[index];
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          this.bulkJsonError = 'Each entry in embeds must be an object.';
          this.changeDetectorRef.markForCheck();
          return;
        }
        const embedPayload =
          this.embedFormService.extractEmbedPayloadFromRecord(entry as Record<string, unknown>) ?? {};
        const fallbackType =
          embedPayload.messageType ??
          topLevelType ??
          this.getMessageType(index) ??
          this.getMessageType(0);
        if (!fallbackType) {
          this.bulkJsonError = 'Each embed needs a messageType to apply bulk updates.';
          this.changeDetectorRef.markForCheck();
          return;
        }
        const defaults = this.embedFormService.getDefaultsForType(fallbackType);
        const merged = this.mergeEmbedPayload(defaults, embedPayload);
        merged.messageType = fallbackType;
        nextGroups.push(this.buildEmbedGroup(merged));
      }

      if (nextGroups.length === 0) {
        this.bulkJsonError = 'Provide at least one embed in the embeds array.';
        this.changeDetectorRef.markForCheck();
        return;
      }

      const tokenValue = this.form.get('token')?.value ?? '';
      this.form = this.buildForm(nextGroups.map((group) => group.getRawValue() as EmbedConfig), tokenValue);
      this.scrapingEmbeds.clear();
      this.connectForm();
      this.status = { type: 'success', text: 'Bulk updates applied to the embeds.' };
      this.isBulkModalOpen = false;
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

    const targetEmbed = this.getEmbedGroup(0);
    const selectedType = this.getMessageTypeControl(targetEmbed).value;
    const incomingType = embedPayload?.messageType ?? assetPayload.messageType ?? null;
    let effectiveType = selectedType;
    if (incomingType) {
      if (incomingType !== selectedType) {
        if (targetEmbed.dirty) {
          const confirmed = window.confirm(
            'Applying this JSON will reset the form content for the new message type. Continue?'
          );
          if (!confirmed) {
            return;
          }
        }
        this.resetEmbedForType(0, incomingType);
      }
      effectiveType = incomingType;
    } else if (!selectedType) {
      this.bulkJsonError = 'Select a message type or include messageType in the JSON payload.';
      this.changeDetectorRef.markForCheck();
      return;
    }

    const urlFromPayload = (embedPayload?.url ?? assetPayload.url)?.trim();
    const currentUrl = targetEmbed.get('url')?.value?.toString().trim() ?? '';
    if (effectiveType === 'custom') {
      if (urlFromPayload) {
        targetEmbed.get('url')?.setValue(urlFromPayload);
      }
      if (embedPayload) {
        this.applyEmbedPayload(embedPayload, targetEmbed);
      }
      this.applyAssetPayload(assetPayload, embedPayload, targetEmbed);
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
        this.applyEmbedPayload(embedPayload, targetEmbed);
      }
      this.applyAssetPayload(assetPayload, embedPayload, targetEmbed);
    }
    if (currentUrl && urlFromPayload && currentUrl !== urlFromPayload) {
      targetEmbed.get('url')?.setValue(urlFromPayload);
    }
    this.status = { type: 'success', text: 'Bulk updates applied to the first embed.' };
    this.isBulkModalOpen = false;
    this.changeDetectorRef.markForCheck();
  }

  private resetEmbedForType(index: number, type: MessageType): void {
    const defaults = this.embedFormService.getDefaultsForType(type);
    const embedGroup = this.buildEmbedGroup(defaults);
    this.embedsArray.setControl(index, embedGroup);
    this.updateUrlValidators(embedGroup, type);
    this.updateThumbnailState(embedGroup, type);
    this.syncPreview();
  }

  private mergeEmbedPayload(base: EmbedConfig, payload: BulkEmbedPayload): EmbedConfig {
    return {
      ...base,
      messageType: payload.messageType ?? base.messageType,
      title: payload.title ?? base.title,
      color: payload.color ?? base.color,
      url: payload.url ?? base.url,
      fields: payload.fields ?? base.fields,
      footer: payload.footer ? { text: payload.footer.text ?? base.footer.text } : base.footer,
      thumbnail: payload.thumbnail ? { url: payload.thumbnail.url ?? base.thumbnail.url } : base.thumbnail,
      image: payload.image ? { url: payload.image.url ?? base.image.url } : base.image,
    };
  }

  private parseMessageType(value: unknown): MessageType | null {
    if (value === 'unity' || value === 'fab' || value === 'custom') {
      return value;
    }
    return null;
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

  private updateUrlValidators(embedGroup: FormGroup, messageType: MessageType | null): void {
    const urlControl = embedGroup.get('url');
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

  private updateThumbnailState(embedGroup: FormGroup, messageType: MessageType | null): void {
    const thumbnailControl = embedGroup.get('thumbnail.url');
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

  private applyAssetStoreData(url: string, data: AssetStoreDataWithPromo, embedGroup: FormGroup): void {
    if (embedGroup.get('url')?.value !== url) {
      embedGroup.get('url')?.setValue(url);
    }
    if (data.title) {
      embedGroup.get('title')?.setValue(data.title);
    }
    if (data.imageUrl) {
      embedGroup.get('image.url')?.setValue(data.imageUrl);
    }
    const messageType = this.getMessageTypeControl(embedGroup).value;
    if (messageType) {
      const defaults = this.embedFormService.getDefaultsForType(messageType);
      embedGroup.get('thumbnail.url')?.setValue(defaults.thumbnail.url);
      embedGroup.get('color')?.setValue(defaults.color);
    }
    if (data.price) {
      this.applyDiscountPrice(data.price, this.getFieldsArray(embedGroup));
    }
    if (data.promoCode) {
      this.applyPromoCode(data.promoCode, this.getFieldsArray(embedGroup));
    }
  }

  private applyAssetStoreDataWithoutUrl(
    data: AssetStoreDataWithPromo,
    embedGroup: FormGroup
  ): void {
    if (data.title) {
      embedGroup.get('title')?.setValue(data.title);
    }
    if (data.imageUrl) {
      embedGroup.get('image.url')?.setValue(data.imageUrl);
    }
    if (data.price) {
      this.applyDiscountPrice(data.price, this.getFieldsArray(embedGroup));
    }
    if (data.promoCode) {
      this.applyPromoCode(data.promoCode, this.getFieldsArray(embedGroup));
    }
  }

  private applyAssetPayload(
    payload: AssetStoreDataWithPromo & { url?: string },
    embedPayload: BulkEmbedPayload | undefined,
    embedGroup: FormGroup
  ): void {
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
      this.applyDiscountPrice(payload.price, this.getFieldsArray(embedGroup));
    }
    if (payload.promoCode) {
      this.applyPromoCode(payload.promoCode, this.getFieldsArray(embedGroup));
    }
  }

  private applyEmbedPayload(payload: BulkEmbedPayload, embedGroup: FormGroup): void {
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
      const fieldsArray = this.getFieldsArray(embedGroup);
      fieldsArray.clear();
      payload.fields.forEach((field) => {
        const normalizedValue = this.normalizeDateInputValue(field.name, field.value);
        fieldsArray.push(this.createField(field.name, normalizedValue, field.inline));
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

  private applyPromoCode(code: string, fieldsArray: FormArray): void {
    const normalized = code.trim();
    if (!normalized) {
      return;
    }
    const field = fieldsArray.controls.find((control) => {
      const nameValue = control.get('name')?.value?.toString().trim().toLowerCase();
      return nameValue === 'código' || nameValue === 'codigo' || nameValue === 'code';
    });
    field?.get('value')?.setValue(normalized);
  }

  private applyDiscountPrice(price: string, fieldsArray: FormArray): void {
    const formatted = this.formatPrice(price);
    if (!formatted) {
      return;
    }
    const field = fieldsArray.controls.find((control) => {
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
    this.previewEmbeds = this.getFormattedEmbeds();
    this.changeDetectorRef.markForCheck();
  }

  private getFormattedEmbeds(): EmbedConfig[] {
    const rawEmbeds = this.embedsArray.getRawValue() as EmbedConfig[];
    return rawEmbeds.map((embed) => this.formatEmbedDates(embed));
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
