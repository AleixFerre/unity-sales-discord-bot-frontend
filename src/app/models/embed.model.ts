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
  title: string;
  color: number;
  url: string;
  fields: EmbedField[];
  footer: EmbedFooter;
  thumbnail: EmbedMedia;
  image: EmbedMedia;
}

export interface EmbedRequest {
  embed: EmbedConfig;
}
