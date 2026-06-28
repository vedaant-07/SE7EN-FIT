import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export const isNativeApp = () => Capacitor.isNativePlatform();

export async function initNativeApp() {
  if (!isNativeApp()) return;

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#000000' });
  } catch {}

  try {
    await SplashScreen.hide();
  } catch {}

  try {
    Keyboard.addListener('keyboardWillShow', () => document.body.classList.add('keyboard-open'));
    Keyboard.addListener('keyboardWillHide', () => document.body.classList.remove('keyboard-open'));
  } catch {}

  try {
    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else CapacitorApp.exitApp();
    });
  } catch {}
}

export async function setupPushNotifications() {
  return null;
}

export async function nativeTap() {
  if (!isNativeApp()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}

function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);

  for (let i = 0; i < byteString.length; i += 1) {
    bytes[i] = byteString.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mimeType });
}

export async function getNativeFoodPhoto(source = 'camera') {
  if (!isNativeApp()) return null;

  const photo = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: source === 'gallery' ? CameraSource.Photos : CameraSource.Camera,
    promptLabelHeader: 'SE7EN FIT Food Scan',
    promptLabelPhoto: 'Choose from Gallery',
    promptLabelPicture: 'Use Camera'
  });

  if (!photo?.dataUrl) return null;

  const file = dataUrlToFile(photo.dataUrl, `se7enfit-food-${Date.now()}.${photo.format || 'jpg'}`);

  return {
    file,
    imageUrl: photo.dataUrl,
    base64: photo.dataUrl.split(',')[1],
    mimeType: file.type || `image/${photo.format || 'jpeg'}`
  };
}
