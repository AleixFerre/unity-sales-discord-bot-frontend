import { Injectable } from '@angular/core';

import {
  FAB_ACCENT_COLOR,
  FAB_THUMBNAIL_URL,
  UNITY_ACCENT_COLOR,
  UNITY_THUMBNAIL_URL,
} from '../constants/store-thumbnails';
import { EmbedConfig, MessageType } from '../models/embed.model';

const DEFAULT_FOOTER_TEXT = 'GameDev Sales Bot © ' + new Date().getFullYear();
const DEFAULT_FIELDS = [
  { name: 'Preu', value: '', inline: true },
  { name: 'Fi', value: '', inline: true },
  { name: 'Codi', value: '', inline: true },
];

@Injectable({ providedIn: 'root' })
export class EmbedFormService {
  getDefaultsForType(type: MessageType): EmbedConfig {
    const base: EmbedConfig = {
      messageType: type,
      title: '',
      color: 0,
      url: '',
      fields: DEFAULT_FIELDS.map((field) => ({ ...field })),
      footer: { text: DEFAULT_FOOTER_TEXT },
      thumbnail: { url: '' },
      images: [{ url: '' }],
    };
    if (type === 'unity') {
      return { ...base, color: UNITY_ACCENT_COLOR, thumbnail: { url: UNITY_THUMBNAIL_URL } };
    }
    if (type === 'fab') {
      return { ...base, color: FAB_ACCENT_COLOR, thumbnail: { url: FAB_THUMBNAIL_URL } };
    }
    return base;
  }

  detectMessageTypeFromUrl(url: string): Exclude<MessageType, 'custom'> | null {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'assetstore.unity.com' && parsed.pathname.startsWith('/packages/')) {
        return 'unity';
      }
      if (
        (parsed.hostname === 'www.fab.com' || parsed.hostname === 'fab.com') &&
        parsed.pathname.startsWith('/listings/')
      ) {
        return 'fab';
      }
    } catch {
      // Not a parseable URL.
    }
    return null;
  }

  isSupportedAssetListingUrl(url: string, messageType: MessageType): boolean {
    return this.detectMessageTypeFromUrl(url) === messageType;
  }

  isUnityAssetStoreUrl(url: string): boolean {
    try {
      return new URL(url).hostname === 'assetstore.unity.com';
    } catch {
      return false;
    }
  }

  isUnityListUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'assetstore.unity.com' && parsed.pathname.startsWith('/lists/');
    } catch {
      return false;
    }
  }
}
