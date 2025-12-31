export const UNITY_THUMBNAIL_URL =
  'https://yt3.googleusercontent.com/nIKd_1FqVPI6zaMzPnLHMZsg-lDiutyi1ja1VNeOaSaMHvIjwLUJlEpXRdl0LY-BnZ1ttNm8Tg=s900-c-k-c0x00ffffff-no-rj';
export const FAB_THUMBNAIL_URL =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQIxGKI2LmHlk9g-1u7nJLElU-3OyKP75wi5Q&s';

export const UNITY_ACCENT_COLOR = 0xffffff;
export const FAB_ACCENT_COLOR = 0x8a2be2;

export const getStoreThumbnailUrl = (rawUrl: string): string | null => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === 'assetstore.unity.com') {
      return UNITY_THUMBNAIL_URL;
    }
    if (parsed.hostname === 'www.fab.com' || parsed.hostname === 'fab.com') {
      return FAB_THUMBNAIL_URL;
    }
  } catch {
    return null;
  }
  return null;
};

export const getStoreAccentColor = (rawUrl: string): number | null => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname === 'assetstore.unity.com') {
      return UNITY_ACCENT_COLOR;
    }
    if (parsed.hostname === 'www.fab.com' || parsed.hostname === 'fab.com') {
      return FAB_ACCENT_COLOR;
    }
  } catch {
    return null;
  }
  return null;
};
