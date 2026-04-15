import AsyncStorage from '@react-native-async-storage/async-storage';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

const PHOTO_WIDTH = 168;
const PHOTO_HEIGHT = 224;
const PHOTO_QUALITY = 0.4;
const MAX_PHOTO_DATA_URL_LENGTH = 250000;

const profilePhotoCacheKey = (userId: string) => `profile-photo:${userId}`;

async function toDataUrl(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error('Nao foi possivel ler a foto selecionada.');
  }

  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nao foi possivel converter a foto selecionada.'));
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Nao foi possivel converter a foto selecionada.'));
        return;
      }

      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

export const profilePhotoService = {
  async uploadProfilePhoto(localUri: string) {
    const preparedImage = await manipulateAsync(
      localUri,
      [{ resize: { width: PHOTO_WIDTH, height: PHOTO_HEIGHT } }],
      {
        compress: PHOTO_QUALITY,
        format: SaveFormat.JPEG,
      },
    );

    const dataUrl = await toDataUrl(preparedImage.uri);
    if (dataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
      throw new Error('A foto ficou maior do que o permitido. Tente outra imagem com menos detalhes.');
    }

    return dataUrl;
  },

  async getCachedProfilePhoto(userId: string) {
    return AsyncStorage.getItem(profilePhotoCacheKey(userId));
  },

  async cacheProfilePhoto(userId: string, photoDataUrl: string | null) {
    if (photoDataUrl) {
      await AsyncStorage.setItem(profilePhotoCacheKey(userId), photoDataUrl);
      return;
    }

    await AsyncStorage.removeItem(profilePhotoCacheKey(userId));
  },

  async removeProfilePhoto() {
    return Promise.resolve();
  },
};
