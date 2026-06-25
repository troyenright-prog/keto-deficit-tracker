import { registerSW } from 'virtual:pwa-register';

export function enableFreshAppUpdates(): void {
  if (!('serviceWorker' in navigator)) return;

  let reloading = false;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
    onOfflineReady() {
      cleanupOldRuntimeCaches();
    },
    onRegisteredSW(_swUrl, registration) {
      registration?.update().catch(() => {
        // Offline or restricted browsers continue using the current cached app.
      });
    },
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  const checkForUpdate = () => {
    navigator.serviceWorker.getRegistration()
      .then((registration) => registration?.update())
      .catch(() => {
        // Offline or restricted browsers continue using the current cached app.
      });
  };

  window.addEventListener('load', checkForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
}

export async function hardRefreshApp(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // A reload is still useful if the browser blocks cache or service-worker access.
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set('refresh', Date.now().toString());
    window.location.replace(url.toString());
  }
}

function cleanupOldRuntimeCaches(): void {
  if (!('caches' in window)) return;
  caches.keys()
    .then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith('keto-runtime-'))
        .map((key) => caches.delete(key)),
    ))
    .catch(() => {
      // Cache cleanup is best-effort; the service worker still controls updates.
    });
}
