import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { FAB_THUMBNAIL_URL, UNITY_THUMBNAIL_URL } from '../../constants/store-thumbnails';
import { EmbedComposerService } from '../../services/embed-composer.service';

@Component({
  selector: 'app-composer-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './composer-toolbar.component.html',
  styleUrl: './composer-toolbar.component.scss',
})
export class ComposerToolbarComponent {
  protected readonly composer = inject(EmbedComposerService);

  protected readonly unityIconUrl = UNITY_THUMBNAIL_URL;
  protected readonly fabIconUrl = FAB_THUMBNAIL_URL;
}
