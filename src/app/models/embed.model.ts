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

export interface EmbedConfig {
  messageType?: MessageType;
  title: string;
  color: number;
  url: string;
  fields: EmbedField[];
  footer: EmbedFooter;
  thumbnail: EmbedMedia;
  image: EmbedMedia;
}

export type MessageType = 'unity' | 'fab' | 'custom';

export interface EmbedRequest {
  embed?: EmbedConfig;
  embeds?: EmbedConfig[];
}
