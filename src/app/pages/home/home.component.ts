import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';

import { EmbedBuilderComponent } from '../../components/embed-builder/embed-builder.component';
import { EmbedPreviewComponent } from '../../components/embed-preview/embed-preview.component';
import { getStoreAccentColor, getStoreThumbnailUrl } from '../../constants/store-thumbnails';
import { EmbedConfig, EmbedRequest } from '../../models/embed.model';
import { AssetStoreData, EmbedService } from '../../services/embed.service';

type StatusMessage = { type: 'success' | 'error'; text: string } | null;
type AssetStoreDataWithPromo = AssetStoreData & {
  promoCode?: string;
};

@Component({
  selector: 'app-home',
  imports: [CommonModule, ReactiveFormsModule, EmbedBuilderComponent, EmbedPreviewComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly embedService = inject(EmbedService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  readonly form = this.formBuilder.group({
    token: new FormControl('', { validators: [Validators.required] }),
    embed: this.formBuilder.group({
      title: new FormControl('Procedural UI by DTT', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      color: new FormControl(3447003, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0), Validators.max(16777215)],
      }),
      url: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^https?:\/\/.+/i)],
      }),
      fields: this.formBuilder.array([
        this.createField('Preu', '100%', true),
        this.createField('Fi', '12/01/2026', true),
        this.createField('Codi', 'CODE', true),
      ]),
      footer: this.formBuilder.group({
        text: new FormControl('GameDev Sales Bot © ' + new Date().getFullYear(), {
          nonNullable: true,
          validators: [Validators.required],
        }),
      }),
      thumbnail: this.formBuilder.group({
        url: new FormControl('', { nonNullable: true }),
      }),
      image: this.formBuilder.group({
        url: new FormControl(
          'https://images.ctfassets.net/t8hl2pirfi15/6KUJSzoCavXnQR6dWd808s/0597eb92c829bb565c2dfcf7a0d3c240/4ac69868-a3bb-4be9-8f96-0fab6dd6260b.webp',
          { nonNullable: true }
        ),
      }),
    }),
  });

  previewEmbed: EmbedConfig = this.form.getRawValue().embed as EmbedConfig;
  colorHex = this.toHexColor(this.previewEmbed.color);
  status: StatusMessage = null;
  isSubmitting = false;
  isScraping = false;

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.previewEmbed = value.embed as EmbedConfig;
      this.colorHex = this.toHexColor(this.previewEmbed.color);
      this.changeDetectorRef.markForCheck();
    });
  }

  get fieldsArray(): FormArray {
    return this.form.get('embed.fields') as FormArray;
  }

  handleSend(): void {
    this.status = null;
    if (this.form.invalid) {
      this.status = { type: 'error', text: 'Please fix the missing fields before sending.' };
      this.changeDetectorRef.markForCheck();
      return;
    }

    const payload: EmbedRequest = { embed: this.form.getRawValue().embed as EmbedConfig };
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

  handleColorChange(hex: string): void {
    const numericColor = this.fromHexColor(hex);
    const colorControl = this.form.get('embed.color');
    if (colorControl) {
      colorControl.setValue(numericColor);
    }
  }

  handleAssetStoreScrape(): void {
    const url = this.form.get('embed.url')?.value?.trim();
    if (!url || !this.isSupportedAssetUrl(url)) {
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
    const thumbnailUrl = getStoreThumbnailUrl(url);
    embedGroup.get('thumbnail.url')?.setValue(thumbnailUrl ?? '');
    const accentColor = getStoreAccentColor(url);
    if (typeof accentColor === 'number') {
      embedGroup.get('color')?.setValue(accentColor);
    }
    if (data.price) {
      this.applyDiscountPrice(data.price);
    }
    if (data.promoCode) {
      this.applyPromoCode(data.promoCode);
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

  private isSupportedAssetUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'assetstore.unity.com') {
        return parsed.pathname.startsWith('/packages/');
      }
      if (parsed.hostname === 'www.fab.com' || parsed.hostname === 'fab.com') {
        return parsed.pathname.startsWith('/listings/');
      }
      return false;
    } catch {
      return false;
    }
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
}
