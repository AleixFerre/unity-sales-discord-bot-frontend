import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { EmbedComposerService } from '../../services/embed-composer.service';

@Component({
  selector: 'app-composer-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './composer-toolbar.component.html',
  styleUrl: './composer-toolbar.component.scss',
})
export class ComposerToolbarComponent {
  protected readonly composer = inject(EmbedComposerService);
}
