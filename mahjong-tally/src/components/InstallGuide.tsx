import { useState } from 'react';
import { MoreVertical, PlusSquare, Share } from 'lucide-react';
import { Sheet } from './overlay';
import { Button } from './ui';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setUsed] = useState(false);
  const canPrompt = open && deferredPrompt !== null;
  const installed = typeof window !== 'undefined' && isStandalone();
  return (
    <Sheet open={open} onClose={onClose} title="Install Mahjong Tally" labelledBy="install-title">
      <div className="space-y-5 text-[15px] leading-relaxed text-ink-2">
        {installed ? (
          <p className="rounded-2xl border border-emerald/30 bg-emerald-soft p-3 text-positive">You are using the installed app.</p>
        ) : null}
        <p>Installing adds Mahjong Tally to your home screen. It opens full-screen and works without internet. Your games stay on this device.</p>
        {canPrompt ? (
          <Button
            variant="primary"
            block
            onClick={async () => {
              if (!deferredPrompt) return;
              await deferredPrompt.prompt();
              await deferredPrompt.userChoice;
              deferredPrompt = null;
              setUsed(true);
              onClose();
            }}
          >
            Install now
          </Button>
        ) : null}
        <section aria-labelledby="ios-install">
          <h3 id="ios-install" className="mb-2 text-[15px] font-semibold text-ink">
            iPhone & iPad (Safari)
          </h3>
          <ol className="space-y-2">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-emerald">
                <Share size={18} />
              </span>
              Tap the Share button in Safari’s toolbar.
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-emerald">
                <PlusSquare size={18} />
              </span>
              Choose “Add to Home Screen”, then tap Add.
            </li>
          </ol>
        </section>
        <section aria-labelledby="android-install">
          <h3 id="android-install" className="mb-2 text-[15px] font-semibold text-ink">
            Android (Chrome)
          </h3>
          <ol className="space-y-2">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-emerald">
                <MoreVertical size={18} />
              </span>
              Tap the ⋮ menu in Chrome.
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-emerald">
                <PlusSquare size={18} />
              </span>
              Choose “Install app” or “Add to Home screen”.
            </li>
          </ol>
        </section>
      </div>
    </Sheet>
  );
}
