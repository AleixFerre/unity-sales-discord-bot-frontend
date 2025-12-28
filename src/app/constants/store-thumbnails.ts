export const UNITY_THUMBNAIL_URL =
  'https://cdn.discordapp.com/app-icons/1454213455593865428/4564252e658bed263baf2d8e8287beea.png?size=256';
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
