import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, map } from 'rxjs';

import { EmbedConfig, EmbedField, EmbedPayload, MessageType } from '../models/embed.model';
import {
  formatEmbedForPreview,
  formatStrikethroughPrice,
  fromHexColor,
  isCodeField,
  isDateField,
  isPriceField,
  normalizeDateInputValue,
} from '../utils/embed-format';
import { EmbedFormService } from './embed-form.service';
import { AssetStoreData, AssetStoreListData, EmbedService, FabFreeItem } from './embed.service';

export type StatusMessage = { type: 'success' | 'error'; text: string };
export type SaleSettings = { endDate: string; promoCode: string };

export type FieldFormGroup = FormGroup<{
  name: FormControl<string>;
  value: FormControl<string>;
  inline: FormControl<boolean>;
}>;

export type MediaFormGroup = FormGroup<{
  url: FormControl<string>;
}>;

export type EmbedFormGroup = FormGroup<{
  messageType: FormControl<MessageType>;
  title: FormControl<string>;
  color: FormControl<number>;
  url: FormControl<string>;
  fields: FormArray<FieldFormGroup>;
  footer: FormGroup<{ text: FormControl<string> }>;
  thumbnail: MediaFormGroup;
  images: FormArray<MediaFormGroup>;
}>;

export type ComposerForm = FormGroup<{
  token: FormControl<string>;
  embeds: FormArray<EmbedFormGroup>;
}>;

type ComposerSnapshot = {
  token: string;
  embeds: EmbedConfig[];
  groups: EmbedFormGroup[];
};

const TOKEN_STORAGE_KEY = 'unity-sales-bot.token';
/** Discord shows at most 4 images per embed gallery. */
export const MAX_EMBED_IMAGES = 4;
const LIST_IMAGE_COUNT = 3;

/**
 * Page-scoped store for the embed composer: owns the one form instance,
 * every piece of UI state as signals, and all mutations against them.
 */
@Injectable()
export class EmbedComposerService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly embedService = inject(EmbedService);
  private readonly embedFormService = inject(EmbedFormService);

  readonly form: ComposerForm = new FormGroup({
    token: new FormControl(this.readStoredToken(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    embeds: new FormArray<EmbedFormGroup>([
      this.buildEmbedGroup(this.embedFormService.getDefaultsForType('unity')),
    ]),
  });

  readonly formSnapshot = toSignal(this.form.valueChanges.pipe(map(() => this.snapshot())), {
    initialValue: this.snapshot(),
  });

  readonly previewEmbeds = computed(() => this.formSnapshot().embeds.map(formatEmbedForPreview));
  readonly hasToken = computed(() => this.formSnapshot().token.trim().length > 0);

  private readonly formValid = toSignal(
    this.form.statusChanges.pipe(map((status) => status === 'VALID')),
    { initialValue: this.form.valid }
  );

  readonly status = signal<StatusMessage | null>(null);
  readonly isSubmitting = signal(false);
  readonly isScrapingFabFree = signal(false);
  /** Index of the expanded embed card; -1 means all collapsed. */
  readonly expandedIndex = signal(0);
  readonly listPanelOpen = signal(false);

  private readonly scrapingGroupsState = signal<ReadonlySet<EmbedFormGroup>>(new Set());
  /** Embeds with an in-flight store fetch, keyed by group identity so removals can't misattribute spinners. */
  readonly scrapingGroups = this.scrapingGroupsState.asReadonly();

  readonly canSubmit = computed(
    () => this.formValid() && this.formSnapshot().embeds.length > 0 && !this.isSubmitting()
  );

  constructor() {
    this.form.controls.token.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((token) => this.persistToken(token));
  }

  get embedsArray(): FormArray<EmbedFormGroup> {
    return this.form.controls.embeds;
  }

  addEmbed(type: MessageType): void {
    this.embedsArray.push(this.buildEmbedGroup(this.embedFormService.getDefaultsForType(type)));
    this.expandedIndex.set(this.embedsArray.length - 1);
  }

  removeEmbed(index: number): void {
    this.embedsArray.removeAt(index);
    const expanded = this.expandedIndex();
    if (expanded === index) {
      this.expandedIndex.set(-1);
    } else if (expanded > index) {
      this.expandedIndex.set(expanded - 1);
    }
  }

  toggleEmbed(index: number): void {
    this.expandedIndex.update((current) => (current === index ? -1 : index));
  }

  toggleListPanel(): void {
    this.listPanelOpen.update((open) => !open);
  }

  setEmbedColor(group: EmbedFormGroup, hex: string): void {
    if (group.controls.messageType.value !== 'custom') {
      return;
    }
    group.controls.color.setValue(fromHexColor(hex));
  }

  send(): void {
    this.status.set(null);
    if (this.form.invalid || this.embedsArray.length === 0) {
      this.status.set({ type: 'error', text: 'Please fix the missing fields before sending.' });
      return;
    }
    const embeds: EmbedPayload[] = this.embedsArray.getRawValue().map((embed) => {
      const { messageType, ...payload } = formatEmbedForPreview(embed);
      return {
        ...payload,
        images: payload.images.filter((image) => image.url.trim().length > 0),
      };
    });

    this.isSubmitting.set(true);
    this.embedService
      .sendEmbed({ embeds }, this.form.controls.token.value)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: () => this.status.set({ type: 'success', text: 'Embed delivered to the backend.' }),
        error: (error: Error) =>
          this.status.set({ type: 'error', text: error?.message || 'Failed to send the embed.' }),
      });
  }

  scrapeEmbed(group: EmbedFormGroup): void {
    const messageType = group.controls.messageType.value;
    if (messageType === 'custom') {
      return;
    }
    const url = group.controls.url.value.trim();
    if (messageType === 'unity' && this.embedFormService.isUnityListUrl(url)) {
      if (!this.hasToken()) {
        this.status.set({ type: 'error', text: 'Bearer token is required to fetch listing data.' });
        return;
      }
      this.status.set(null);
      this.fetchListInto(group, url);
      return;
    }
    if (!url || !this.embedFormService.isSupportedAssetListingUrl(url, messageType)) {
      this.status.set({
        type: 'error',
        text: 'Enter a valid Unity Asset Store or Fab listing URL before fetching.',
      });
      return;
    }
    if (!this.hasToken()) {
      this.status.set({ type: 'error', text: 'Bearer token is required to fetch listing data.' });
      return;
    }

    this.status.set(null);
    this.markScraping(group, true);
    this.embedService
      .fetchAssetStoreData(url, this.form.controls.token.value)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.markScraping(group, false))
      )
      .subscribe({
        next: (data) => {
          if (!this.embedsArray.controls.includes(group)) {
            return;
          }
          if (!this.hasAssetStoreData(data)) {
            this.status.set({ type: 'error', text: 'No data found for this store listing URL.' });
            return;
          }
          this.applyAssetStoreData(url, data, group);
        },
        error: (error: Error) =>
          this.status.set({ type: 'error', text: error?.message || 'Failed to fetch store data.' }),
      });
  }

  /** Creates one Unity embed for an Asset Store list page and fetches its title + item images. */
  scrapeUnityList(rawUrl: string): boolean {
    const url = rawUrl.trim();
    if (!url || !this.embedFormService.isUnityListUrl(url)) {
      this.status.set({
        type: 'error',
        text: 'Enter a valid Unity Asset Store list URL (assetstore.unity.com/lists/...).',
      });
      return false;
    }
    if (!this.hasToken()) {
      this.status.set({ type: 'error', text: 'Bearer token is required to fetch list data.' });
      return false;
    }

    const defaults = this.embedFormService.getDefaultsForType('unity');
    const group = this.buildEmbedGroup({ ...defaults, fields: [], url });
    this.embedsArray.push(group);
    this.expandedIndex.set(this.embedsArray.length - 1);
    this.status.set(null);
    this.fetchListInto(group, url);
    return true;
  }

  scrapFabFree(): void {
    if (!this.hasToken()) {
      this.status.set({ type: 'error', text: 'Bearer token is required to scrap Fab free items.' });
      return;
    }
    const wouldDiscardWork = this.embedsArray.dirty || this.embedsArray.length > 1;
    if (
      wouldDiscardWork &&
      !window.confirm('This will replace all current embeds with the Fab free items. Continue?')
    ) {
      return;
    }

    this.status.set(null);
    this.isScrapingFabFree.set(true);
    this.embedService
      .fetchFabFree(this.form.controls.token.value)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isScrapingFabFree.set(false))
      )
      .subscribe({
        next: (response) => {
          const items = response?.items ?? [];
          if (items.length === 0) {
            this.status.set({ type: 'error', text: 'No Fab limited-time-free items found.' });
            return;
          }
          this.replaceAllEmbeds(items.map((item) => this.buildFabFreeEmbed(item)));
          this.status.set({
            type: 'success',
            text: `Loaded ${items.length} Fab free ${items.length === 1 ? 'item' : 'items'}.`,
          });
        },
        error: (error: Error) =>
          this.status.set({
            type: 'error',
            text: error?.message || 'Failed to scrap Fab free items.',
          }),
      });
  }

  applySaleSettings(settings: SaleSettings): void {
    const endDate = settings.endDate.trim();
    const promoCode = settings.promoCode.trim();
    if (!endDate && !promoCode) {
      return;
    }
    let updated = 0;
    this.embedsArray.controls.forEach((group) => {
      if (group.controls.messageType.value !== 'unity') {
        return;
      }
      let touched = false;
      group.controls.fields.controls.forEach((field) => {
        const name = field.controls.name.value;
        if (endDate && isDateField(name)) {
          field.controls.value.setValue(endDate);
          field.controls.value.markAsDirty();
          touched = true;
        }
        if (promoCode && isCodeField(name)) {
          field.controls.value.setValue(promoCode);
          field.controls.value.markAsDirty();
          touched = true;
        }
      });
      if (touched) {
        updated += 1;
      }
    });
    this.status.set(
      updated > 0
        ? {
            type: 'success',
            text: `Applied sale settings to ${updated} Unity embed${updated === 1 ? '' : 's'}.`,
          }
        : { type: 'error', text: 'No Unity embeds with Fi/Codi fields to update.' }
    );
  }

  private fetchListInto(group: EmbedFormGroup, url: string): void {
    this.markScraping(group, true);
    this.embedService
      .fetchAssetStoreList(url, this.form.controls.token.value)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.markScraping(group, false))
      )
      .subscribe({
        next: (data: AssetStoreListData) => {
          if (!this.embedsArray.controls.includes(group)) {
            return;
          }
          const imageUrls = (data?.imageUrls ?? [])
            .filter((imageUrl) => Boolean(imageUrl))
            .slice(0, LIST_IMAGE_COUNT);
          if (!data?.title && imageUrls.length === 0) {
            this.status.set({
              type: 'error',
              text: 'No data found for this Asset Store list URL.',
            });
            return;
          }
          if (data.title) {
            group.controls.title.setValue(data.title);
          }
          if (imageUrls.length > 0) {
            this.setImages(group, imageUrls);
          }
        },
        error: (error: Error) =>
          this.status.set({
            type: 'error',
            text: error?.message || 'Failed to fetch the Asset Store list.',
          }),
      });
  }

  private snapshot(): ComposerSnapshot {
    return {
      token: this.form.controls.token.value,
      embeds: this.embedsArray.getRawValue(),
      groups: [...this.embedsArray.controls],
    };
  }

  /** Validators and the thumbnail lock are fixed at creation time — an embed's type never changes. */
  private buildEmbedGroup(config: EmbedConfig): EmbedFormGroup {
    const isCustom = config.messageType === 'custom';
    const urlValidators = isCustom
      ? []
      : [Validators.required, Validators.pattern(/^https?:\/\/.+/i)];
    if (config.messageType === 'unity') {
      urlValidators.push(this.unityStoreUrlValidator());
    }
    const group: EmbedFormGroup = new FormGroup({
      messageType: new FormControl<MessageType>(config.messageType, { nonNullable: true }),
      title: new FormControl(config.title, {
        nonNullable: true,
        validators: isCustom ? [] : [Validators.required],
      }),
      color: new FormControl(config.color, {
        nonNullable: true,
        validators: isCustom
          ? []
          : [Validators.required, Validators.min(0), Validators.max(16777215)],
      }),
      url: new FormControl(config.url, { nonNullable: true, validators: urlValidators }),
      fields: new FormArray(config.fields.map((field) => this.buildFieldGroup(field))),
      footer: new FormGroup({
        text: new FormControl(config.footer.text, {
          nonNullable: true,
          validators: isCustom ? [] : [Validators.required],
        }),
      }),
      thumbnail: this.buildMediaGroup(config.thumbnail.url),
      images: new FormArray(config.images.map((image) => this.buildMediaGroup(image.url))),
    });
    if (!isCustom) {
      group.controls.thumbnail.controls.url.disable({ emitEvent: false });
    }
    return group;
  }

  private buildFieldGroup(field: EmbedField): FieldFormGroup {
    return new FormGroup({
      name: new FormControl(field.name, { nonNullable: true }),
      value: new FormControl(field.value, { nonNullable: true }),
      inline: new FormControl(field.inline, { nonNullable: true }),
    });
  }

  private buildMediaGroup(url: string): MediaFormGroup {
    return new FormGroup({
      url: new FormControl(url, { nonNullable: true }),
    });
  }

  private setImages(group: EmbedFormGroup, urls: string[]): void {
    const images = group.controls.images;
    images.clear({ emitEvent: false });
    (urls.length > 0 ? urls : ['']).forEach((url) =>
      images.push(this.buildMediaGroup(url), { emitEvent: false })
    );
    images.updateValueAndValidity();
  }

  private unityStoreUrlValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value?.toString().trim() ?? '';
      if (!value) {
        return null;
      }
      return this.embedFormService.isUnityAssetStoreUrl(value)
        ? null
        : { storeDomainMismatch: true };
    };
  }

  private replaceAllEmbeds(embeds: EmbedConfig[]): void {
    this.embedsArray.clear({ emitEvent: false });
    embeds.forEach((embed) =>
      this.embedsArray.push(this.buildEmbedGroup(embed), { emitEvent: false })
    );
    this.embedsArray.markAsPristine();
    this.scrapingGroupsState.set(new Set());
    this.expandedIndex.set(embeds.length > 0 ? 0 : -1);
    this.embedsArray.updateValueAndValidity();
  }

  private buildFabFreeEmbed(item: FabFreeItem): EmbedConfig {
    const defaults = this.embedFormService.getDefaultsForType('fab');
    const fields = defaults.fields
      .filter((field) => !isCodeField(field.name))
      .map((field) => {
        if (isPriceField(field.name) && item.price) {
          return { ...field, value: formatStrikethroughPrice(item.price) || field.value };
        }
        if (isDateField(field.name) && item.freeUntil) {
          return { ...field, value: normalizeDateInputValue(field.name, item.freeUntil) };
        }
        return { ...field };
      });
    return {
      ...defaults,
      title: item.title ?? defaults.title,
      url: item.url ?? defaults.url,
      images: [{ url: item.imageUrl ?? '' }],
      fields,
    };
  }

  private applyAssetStoreData(url: string, data: AssetStoreData, group: EmbedFormGroup): void {
    if (group.controls.url.value !== url) {
      group.controls.url.setValue(url);
    }
    if (data.title) {
      group.controls.title.setValue(data.title);
    }
    if (data.imageUrl) {
      this.setImages(group, [data.imageUrl]);
    }
    const defaults = this.embedFormService.getDefaultsForType(group.controls.messageType.value);
    group.controls.thumbnail.controls.url.setValue(defaults.thumbnail.url);
    group.controls.color.setValue(defaults.color);
    if (data.price) {
      this.setFieldValue(group, isPriceField, formatStrikethroughPrice(data.price));
    }
    if (data.promoCode) {
      this.setFieldValue(group, isCodeField, data.promoCode.trim());
    }
  }

  private setFieldValue(
    group: EmbedFormGroup,
    matches: (name: string) => boolean,
    value: string
  ): void {
    if (!value) {
      return;
    }
    const field = group.controls.fields.controls.find((candidate) =>
      matches(candidate.controls.name.value)
    );
    field?.controls.value.setValue(value);
  }

  private hasAssetStoreData(data: AssetStoreData | null | undefined): boolean {
    return Boolean(data && (data.title || data.imageUrl || data.price));
  }

  private markScraping(group: EmbedFormGroup, scraping: boolean): void {
    this.scrapingGroupsState.update((current) => {
      const next = new Set(current);
      if (scraping) {
        next.add(group);
      } else {
        next.delete(group);
      }
      return next;
    });
  }

  private readStoredToken(): string {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  }

  private persistToken(token: string): void {
    try {
      if (token.trim()) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {
      // Storage unavailable (private browsing) — the token just won't persist.
    }
  }
}
