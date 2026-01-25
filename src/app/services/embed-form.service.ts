import { Injectable } from '@angular/core';

import {
  FAB_ACCENT_COLOR,
  FAB_THUMBNAIL_URL,
  UNITY_ACCENT_COLOR,
  UNITY_THUMBNAIL_URL,
} from '../constants/store-thumbnails';
import { EmbedConfig, MessageType } from '../models/embed.model';
import { AssetStoreData } from './embed.service';

export type AssetStoreDataWithPromo = AssetStoreData & {
  promoCode?: string;
};

export type BulkPayload = {
  messageType: MessageType;
  title?: string;
  url?: string;
  imageUrl?: string;
};

export type BulkEmbedPayload = Partial<EmbedConfig> & { messageType?: MessageType };

export type ExtractedBulkPayload = {
  asset: AssetStoreDataWithPromo & { url?: string; messageType?: MessageType };
  embed?: BulkEmbedPayload;
};

const DEFAULT_UNITY_TITLE = '';
const DEFAULT_FOOTER_TEXT = 'GameDev Sales Bot © ' + new Date().getFullYear();
const DEFAULT_UNITY_IMAGE_URL = '';
const DEFAULT_FIELDS = [
  { name: 'Preu', value: '', inline: true },
  { name: 'Fi', value: '', inline: true },
  { name: 'Codi', value: '', inline: true },
];

@Injectable({ providedIn: 'root' })
export class EmbedFormService {
  getDefaultsForType(type: MessageType): EmbedConfig & { messageType: MessageType } {
    if (type === 'custom') {
      return {
        messageType: type,
        title: '',
        color: 0,
        url: '',
        fields: DEFAULT_FIELDS.map((field) => ({ ...field })),
        footer: { text: DEFAULT_FOOTER_TEXT },
        thumbnail: { url: '' },
        image: { url: '' },
      };
    }
    const baseFields = DEFAULT_FIELDS.map((field) => ({ ...field }));
    if (type === 'fab') {
      return {
        messageType: type,
        title: '',
        color: FAB_ACCENT_COLOR,
        url: '',
        fields: baseFields,
        footer: { text: DEFAULT_FOOTER_TEXT },
        thumbnail: { url: FAB_THUMBNAIL_URL },
        image: { url: DEFAULT_UNITY_IMAGE_URL },
      };
    }
    return {
      messageType: type,
      title: DEFAULT_UNITY_TITLE,
      color: UNITY_ACCENT_COLOR,
      url: '',
      fields: baseFields,
      footer: { text: DEFAULT_FOOTER_TEXT },
      thumbnail: { url: UNITY_THUMBNAIL_URL },
      image: { url: DEFAULT_UNITY_IMAGE_URL },
    };
  }

  buildBulkPayloadFromEmbed(embed: EmbedConfig, messageType: MessageType): BulkPayload {
    const payload: BulkPayload = {
      messageType,
    };
    if (embed.title) {
      payload.title = embed.title;
    }
    if (embed.url) {
      payload.url = embed.url;
    }
    if (embed.image?.url) {
      payload.imageUrl = embed.image.url;
    }
    return payload;
  }

  extractBulkPayload(input: Record<string, unknown>): ExtractedBulkPayload {
    const payload: ExtractedBulkPayload = {
      asset: {},
    };
    payload.embed = this.extractEmbedPayload(input);
    if (typeof input['url'] === 'string') {
      payload.asset.url = input['url'];
    }
    if (
      input['messageType'] === 'unity' ||
      input['messageType'] === 'fab' ||
      input['messageType'] === 'custom'
    ) {
      payload.asset.messageType = input['messageType'];
    }
    if (typeof input['title'] === 'string') {
      payload.asset.title = input['title'];
    }
    if (typeof input['imageUrl'] === 'string') {
      payload.asset.imageUrl = input['imageUrl'];
    }
    if (typeof input['price'] === 'string' || typeof input['price'] === 'number') {
      payload.asset.price = String(input['price']);
    }
    if (typeof input['promoCode'] === 'string') {
      payload.asset.promoCode = input['promoCode'];
    }
    return payload;
  }

  extractEmbedPayload(input: Record<string, unknown>): BulkEmbedPayload | undefined {
    const embed = input['embed'];
    if (!embed || typeof embed !== 'object' || Array.isArray(embed)) {
      return undefined;
    }
    return this.extractEmbedPayloadFromRecord(embed as Record<string, unknown>);
  }

  extractEmbedPayloadFromRecord(embedRecord: Record<string, unknown>): BulkEmbedPayload | undefined {
    const payload: BulkEmbedPayload = {};
    if (
      embedRecord['messageType'] === 'unity' ||
      embedRecord['messageType'] === 'fab' ||
      embedRecord['messageType'] === 'custom'
    ) {
      payload.messageType = embedRecord['messageType'];
    }
    if (typeof embedRecord['title'] === 'string') {
      payload.title = embedRecord['title'];
    }
    const color = embedRecord['color'];
    if (typeof color === 'number' && Number.isFinite(color)) {
      payload.color = color;
    } else if (typeof color === 'string' && color.trim()) {
      const parsed = Number(color);
      if (!Number.isNaN(parsed)) {
        payload.color = parsed;
      }
    }
    if (typeof embedRecord['url'] === 'string') {
      payload.url = embedRecord['url'];
    }
    if (Array.isArray(embedRecord['fields'])) {
      payload.fields = embedRecord['fields']
        .filter((field) => field && typeof field === 'object' && !Array.isArray(field))
        .map((field) => {
          const fieldRecord = field as Record<string, unknown>;
          const name = typeof fieldRecord['name'] === 'string' ? fieldRecord['name'] : '';
          const valueRaw = fieldRecord['value'];
          const value =
            typeof valueRaw === 'string' || typeof valueRaw === 'number' ? String(valueRaw) : '';
          const inline = typeof fieldRecord['inline'] === 'boolean' ? fieldRecord['inline'] : true;
          return { name, value, inline };
        });
    }
    const footer = embedRecord['footer'];
    if (footer && typeof footer === 'object' && !Array.isArray(footer)) {
      const text = (footer as Record<string, unknown>)['text'];
      if (typeof text === 'string') {
        payload.footer = { text };
      }
    }
    const thumbnail = embedRecord['thumbnail'];
    if (thumbnail && typeof thumbnail === 'object' && !Array.isArray(thumbnail)) {
      const url = (thumbnail as Record<string, unknown>)['url'];
      if (typeof url === 'string') {
        payload.thumbnail = { url };
      }
    }
    const image = embedRecord['image'];
    if (image && typeof image === 'object' && !Array.isArray(image)) {
      const url = (image as Record<string, unknown>)['url'];
      if (typeof url === 'string') {
        payload.image = { url };
      }
    }
    return payload;
  }

  isSupportedAssetUrl(url: string, messageType: MessageType): boolean {
    try {
      const parsed = new URL(url);
      if (messageType === 'unity') {
        return parsed.hostname === 'assetstore.unity.com';
      }
      if (messageType === 'fab') {
        return parsed.hostname === 'www.fab.com' || parsed.hostname === 'fab.com';
      }
      return false;
    } catch {
      return false;
    }
  }

  isSupportedAssetListingUrl(url: string, messageType: MessageType): boolean {
    try {
      const parsed = new URL(url);
      if (messageType === 'unity') {
        return parsed.hostname === 'assetstore.unity.com' && parsed.pathname.startsWith('/packages/');
      }
      if (messageType === 'fab') {
        return (
          (parsed.hostname === 'www.fab.com' || parsed.hostname === 'fab.com') &&
          parsed.pathname.startsWith('/listings/')
        );
      }
      return false;
    } catch {
      return false;
    }
  }

  isUnityAssetStoreUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'assetstore.unity.com';
    } catch {
      return false;
    }
  }
}
