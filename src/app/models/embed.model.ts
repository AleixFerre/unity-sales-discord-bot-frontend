export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedFooter {
  text: string;
}

export interface EmbedMedia {
  url: string;
}

export type MessageType = 'unity' | 'fab' | 'custom';

export interface EmbedConfig {
  messageType: MessageType;
  title: string;
  color: number;
  url: string;
  fields: EmbedField[];
  footer: EmbedFooter;
  thumbnail: EmbedMedia;
  /** Up to 4 — the backend turns extra images into Discord's same-URL gallery trick. */
  images: EmbedMedia[];
}

/** What goes over the wire — the backend has no use for messageType. */
export type EmbedPayload = Omit<EmbedConfig, 'messageType'>;

export interface EmbedRequest {
  embeds: EmbedPayload[];
}
