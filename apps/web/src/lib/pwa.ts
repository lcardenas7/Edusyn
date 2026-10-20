// Capture the browser's install offer even before the user signs in.
type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
let installPrompt: InstallPrompt | null = null;
let registration: Promise<ServiceWorkerRegistration> | null = null;
const changed = () => window.dispatchEvent(new Event('edusyn:pwa-change'));

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as InstallPrompt;
  changed();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  changed();
});

export const isInstalledApp = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const canInstallApp = () => !!installPrompt && !isInstalledApp();

export async function installApp() {
  const prompt = installPrompt;
  if (!prompt) return;
  // Each browser event can only be used once.
  installPrompt = null;
  changed();
  await prompt.prompt();
  await prompt.userChoice;
}

export function registerAppWorker() {
  if (!window.isSecureContext || !('serviceWorker' in navigator))
    return Promise.reject(new Error('Service worker unavailable'));
  if (!registration) {
    registration = navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(() => navigator.serviceWorker.ready)
      .catch((error) => {
        registration = null;
        throw error;
      });
  }
  return registration;
}

// Registration does not request notification permission and does not cache
// authenticated pages, answers, or API responses.
export function prepareAppWorker() {
  const start = () => { void registerAppWorker().catch(() => {}); };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
