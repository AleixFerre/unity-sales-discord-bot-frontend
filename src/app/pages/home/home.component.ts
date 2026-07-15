import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { ComposerToolbarComponent } from '../../components/composer-toolbar/composer-toolbar.component';
import { EmbedListComponent } from '../../components/embed-list/embed-list.component';
import { EmbedPreviewComponent } from '../../components/embed-preview/embed-preview.component';
import { SaleSettingsComponent } from '../../components/sale-settings/sale-settings.component';
import { UnityListPanelComponent } from '../../components/unity-list-panel/unity-list-panel.component';
import { EmbedComposerService } from '../../services/embed-composer.service';

@Component({
  selector: 'app-home',
  imports: [
    ReactiveFormsModule,
    ComposerToolbarComponent,
    UnityListPanelComponent,
    SaleSettingsComponent,
    EmbedListComponent,
    EmbedPreviewComponent,
  ],
  providers: [EmbedComposerService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  protected readonly composer = inject(EmbedComposerService);
}
