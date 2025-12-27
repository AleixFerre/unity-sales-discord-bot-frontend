import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
    token: new FormControl(''),
    embed: this.formBuilder.group({
      title: new FormControl('Oferta Unity', { nonNullable: true, validators: [Validators.required] }),
      description: new FormControl('Hasta 50% en assets', { nonNullable: true }),
      color: new FormControl(3447003, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0), Validators.max(16777215)],
      }),
      url: new FormControl('https://assetstore.unity.com', { nonNullable: true }),
      fields: this.formBuilder.array([
        this.createField('Precio', '$19.99', true),
        this.createField('Fin', 'Domingo', true),
      ]),
      footer: this.formBuilder.group({
        text: new FormControl('Unity Sales Bot', { nonNullable: true }),
      }),
      thumbnail: this.formBuilder.group({
        url: new FormControl('https://example.com/thumb.png', { nonNullable: true }),
      }),
      image: this.formBuilder.group({
        url: new FormControl('https://example.com/banner.png', { nonNullable: true }),
      }),
    }),
  });

  previewEmbed: EmbedConfig = this.form.getRawValue().embed as EmbedConfig;
  status: StatusMessage = null;
  isSubmitting = false;

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.previewEmbed = value.embed as EmbedConfig;
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

  private createField(name: string, value: string, inline: boolean): FormGroup {
    return this.formBuilder.group({
      name: new FormControl(name, { nonNullable: true }),
      value: new FormControl(value, { nonNullable: true }),
      inline: new FormControl(inline, { nonNullable: true }),
    });
  }
}
