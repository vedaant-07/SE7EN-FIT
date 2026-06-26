import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.se7enfit.capacitor',
  appName: 'SE7EN FIT',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
