import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { EmbedConfig } from '../../models/embed.model';
import { formatFieldValueHtml, toHexColor } from '../../utils/embed-format';

@Component({
  selector: 'app-embed-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './embed-preview.component.html',
  styleUrl: './embed-preview.component.scss',
})
export class EmbedPreviewComponent {
  readonly embed = input.required<EmbedConfig>();

  protected readonly accentColor = computed(() => toHexColor(this.embed().color));
  protected readonly imageUrls = computed(() =>
    this.embed()
      .images.map((image) => image.url.trim())
      .filter((url) => url.length > 0)
  );

  protected formatFieldValue(value: string | null | undefined): string {
    return formatFieldValueHtml(value);
  }
}
