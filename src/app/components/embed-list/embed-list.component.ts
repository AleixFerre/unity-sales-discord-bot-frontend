import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { MessageType } from '../../models/embed.model';
import { EmbedComposerService, EmbedFormGroup } from '../../services/embed-composer.service';
import { EmbedFormService } from '../../services/embed-form.service';
import { toHexColor } from '../../utils/embed-format';
import { EmbedBuilderComponent } from '../embed-builder/embed-builder.component';

type EmbedVm = {
  group: EmbedFormGroup;
  messageType: MessageType;
  colorHex: string;
  isScraping: boolean;
  storeUrlValid: boolean;
  storeUrlMismatch: boolean;
};

@Component({
  selector: 'app-embed-list',
  imports: [EmbedBuilderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './embed-list.component.html',
  styleUrl: './embed-list.component.scss',
})
export class EmbedListComponent {
  protected readonly composer = inject(EmbedComposerService);
  private readonly embedFormService = inject(EmbedFormService);

  protected readonly vms = computed<EmbedVm[]>(() => {
    const snapshot = this.composer.formSnapshot();
    const scraping = this.composer.scrapingGroups();
    return snapshot.groups.map((group, index) => {
      const embed = snapshot.embeds[index];
      const url = embed.url.trim();
      const isStoreType = embed.messageType !== 'custom';
      const storeUrlValid =
        isStoreType &&
        url.length > 0 &&
        (this.embedFormService.isSupportedAssetListingUrl(url, embed.messageType) ||
          (embed.messageType === 'unity' && this.embedFormService.isUnityListUrl(url)));
      return {
        group,
        messageType: embed.messageType,
        colorHex: toHexColor(embed.color),
        isScraping: scraping.has(group),
        storeUrlValid,
        storeUrlMismatch: isStoreType && url.length > 0 && !storeUrlValid,
      };
    });
  });
}
