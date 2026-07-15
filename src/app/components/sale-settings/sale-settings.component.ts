import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { EmbedComposerService } from '../../services/embed-composer.service';

@Component({
  selector: 'app-sale-settings',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sale-settings.component.html',
  styleUrl: './sale-settings.component.scss',
})
export class SaleSettingsComponent {
  private readonly composer = inject(EmbedComposerService);

  protected readonly endDateControl = new FormControl('', { nonNullable: true });
  protected readonly promoCodeControl = new FormControl('', { nonNullable: true });

  protected apply(): void {
    this.composer.applySaleSettings({
      endDate: this.endDateControl.value,
      promoCode: this.promoCodeControl.value,
    });
  }
}
