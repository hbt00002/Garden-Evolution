// What the store apps (Capacitor, Android and iPhone) do differently from the
// website: vibration, the phone's own share sheet, and the Android back button.
// On the website none of this runs: isNativeApp() is false and the plugins are
// never loaded (they are separate chunks, imported only inside the app).

export const isNativeApp = (win = globalThis.window) => Boolean(win?.Capacitor?.isNativePlatform?.());

// A short buzz for what happens in the game. enabled(): the player's Settings
// switch. Outside the app every call does nothing.
export function createHaptics({ enabled, native = isNativeApp() }) {
  const silent = { merge() {}, world() {}, end() {} };
  if (!native) return silent;
  const plugin = import("@capacitor/haptics").catch(() => null);
  const run = buzz => {
    if (!enabled()) return;
    plugin.then(module => module && buzz(module)).catch(() => {});
  };
  return {
    // Plants merged on this move (once per move, however many merged).
    merge: () => run(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light })),
    // A new world arrived.
    world: () => run(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success })),
    // The run ended.
    end: () => run(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Medium }))
  };
}

const blobToBase64 = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1]);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

// The phone's own share sheet, shaped like navigator.share so share.js can use
// it unchanged (the app's web view has no navigator.share on Android). A
// picture is written to the app's cache first, since the share sheet takes files.
export function nativeShareNav({ clipboard = globalThis.navigator?.clipboard } = {}) {
  return {
    canShare: () => true,
    async share({ files, text, url }) {
      const { Share } = await import("@capacitor/share");
      const options = { text: url ? `${text} ${url}` : text };
      if (files?.length) {
        const { Directory, Filesystem } = await import("@capacitor/filesystem");
        const written = await Filesystem.writeFile({
          path: files[0].name,
          data: await blobToBase64(files[0]),
          directory: Directory.Cache
        });
        options.files = [written.uri];
      }
      try {
        await Share.share(options);
      } catch (error) {
        // Closing the sheet is not a failure (share.js expects an AbortError).
        if (/cancel/i.test(String(error?.message || error))) throw new DOMException("closed", "AbortError");
        throw error;
      }
    },
    clipboard
  };
}

// Android's back button: closes whatever is open (handled() returns true when
// it did), otherwise sends the app to the background like other games do.
export async function onBackButton(handled, native = isNativeApp()) {
  if (!native) return;
  const { App } = await import("@capacitor/app");
  App.addListener("backButton", () => {
    if (!handled()) App.minimizeApp();
  });
}
