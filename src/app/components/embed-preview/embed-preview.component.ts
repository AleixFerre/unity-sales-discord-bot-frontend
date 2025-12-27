import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { EmbedConfig } from '../../models/embed.model';

@Component({
  selector: 'app-embed-preview',
  imports: [CommonModule],
  templateUrl: './embed-preview.component.html',
  styleUrl: './embed-preview.component.scss',
})
export class EmbedPreviewComponent {
  @Input({ required: true }) embed!: EmbedConfig;

  get accentColor(): string {
    const color = this.embed?.color ?? 0;
    return `#${color.toString(16).padStart(6, '0')}`;
  }
}
