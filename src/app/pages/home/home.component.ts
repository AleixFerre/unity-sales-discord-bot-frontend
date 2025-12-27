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
import { EmbedConfig, EmbedRequest } from '../../models/embed.model';
import { EmbedService } from '../../services/embed.service';

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
  private readonly formBuilder = inject(FormBuilder);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  readonly form = this.formBuilder.group({
    token: new FormControl('', { validators: [Validators.required] }),
    embed: this.formBuilder.group({
      title: new FormControl('Procedural UI by DTT', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      description: new FormControl('Build sleek, dynamic interfaces that adapt automatically', {
        nonNullable: true,
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
        this.createField('Descuento', '100%', true),
        this.createField('Fin', '12/01/2026', true),
        this.createField('Código', 'GIFTFROMDTT', true),
      ]),
      footer: this.formBuilder.group({
        text: new FormControl('Unity Sales Bot', {
          nonNullable: true,
          validators: [Validators.required],
        }),
      }),
      thumbnail: this.formBuilder.group({
        url: new FormControl(
          'https://cdn.discordapp.com/app-icons/1454213455593865428/4564252e658bed263baf2d8e8287beea.png?size=256',
          { nonNullable: true }
        ),
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

  private createField(name: string, value: string, inline: boolean): FormGroup {
    return this.formBuilder.group({
      name: new FormControl(name, { nonNullable: true }),
      value: new FormControl(value, { nonNullable: true }),
      inline: new FormControl(inline, { nonNullable: true }),
    });
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
}
