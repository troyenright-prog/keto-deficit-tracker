export function enableFreshAppUpdates(): void {
  if (!('serviceWorker' in navigator)) return;

  let reloading = false;
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
