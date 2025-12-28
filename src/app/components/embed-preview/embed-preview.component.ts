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

  formatFieldValue(value: string | null | undefined): string {
    const escaped = this.escapeHtml(value ?? '');
    return escaped.replace(/~~(.*?)~~/g, '<span class="strike">$1</span>');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
