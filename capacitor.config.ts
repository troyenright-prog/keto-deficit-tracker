import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ketodeficit.tracker',
  appName: 'Health Tracker',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#12805c',
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
  },
};

export default config;
