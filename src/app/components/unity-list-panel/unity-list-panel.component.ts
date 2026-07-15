import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { EmbedComposerService } from '../../services/embed-composer.service';

@Component({
  selector: 'app-unity-list-panel',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unity-list-panel.component.html',
})
export class UnityListPanelComponent {
  protected readonly composer = inject(EmbedComposerService);
  protected readonly urlControl = new FormControl('', { nonNullable: true });

  protected submit(): void {
    if (this.composer.scrapeUnityList(this.urlControl.value)) {
      this.urlControl.setValue('');
    }
  }
}
