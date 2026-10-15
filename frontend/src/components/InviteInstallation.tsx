/**
 * Invitation à installer l'application sur téléphone :
 * - Android (Chrome, Edge, Samsung Internet) : bouton relié à l'invite native « beforeinstallprompt » ;
 * - iPhone / iPad (Safari) : pas d'invite native, on explique « Partager → Sur l'écran d'accueil ».
 * Masquée si l'application est déjà installée ou si l'utilisateur a choisi « Plus tard ».
 */
import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { LogoComptapilot } from '@/components/Marque';

interface InviteNative extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CLE = 'installation-refusee';
const installee = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const estIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const refusee = () => {
  try {
    return Number(localStorage.getItem(CLE) ?? 0) > Date.now();
  } catch {
    return false;
  }
};

export function InviteInstallation() {
  const { t } = useT();
  const [invite, setInvite] = useState<InviteNative | null>(null);
  const [ios] = useState(() => estIos() && !installee());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (installee() || refusee()) return;
    const f = (e: Event) => {
      e.preventDefault();
      setInvite(e as InviteNative);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', f);
    // Sur iPhone, l'invite apparaît après quelques secondes d'utilisation.
    const id = ios ? setTimeout(() => setVisible(true), 4000) : undefined;
    return () => (window.removeEventListener('beforeinstallprompt', f), clearTimeout(id));
  }, [ios]);

  if (!visible) return null;
  const fermer = () => {
    try {
      localStorage.setItem(CLE, String(Date.now() + 14 * 86400_000)); // redemander dans 14 jours
    } catch {
      /* stockage indisponible */
    }
    setVisible(false);
  };

  return (
    <div role="dialog" aria-label={t('pwa.titre')} className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-white/10 bg-[#1a1540]/95 p-4 text-white shadow-[0_20px_60px_-15px_rgb(0_0_0/.6)] backdrop-blur-xl animate-in slide-in-from-bottom-4 fade-in sm:bottom-5">
      <button onClick={fermer} className="absolute right-2.5 top-2.5 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label={t('pwa.plusTard')}>
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <LogoComptapilot className="size-11 ring-1 ring-white/15" />
        <div className="min-w-0">
          <p className="font-display text-[15px] font-semibold">{t('pwa.titre')}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-white/65">{ios ? t('pwa.ios') : t('pwa.texte')}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={fermer} className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-white/60 hover:text-white">
          {t('pwa.plusTard')}
        </button>
        {invite ? (
          <button
            onClick={async () => {
              await invite.prompt();
              const choix = await invite.userChoice;
              if (choix.outcome === 'accepted') setVisible(false);
            }}
            className="flex items-center gap-1.5 rounded-full degrade-bouton px-4 py-2 text-[12.5px] font-bold"
          >
            <Download className="size-4" /> {t('pwa.installer')}
          </button>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-[12px] text-white/80">
            <Share className="size-4" /> Partager → +
          </span>
        )}
      </div>
    </div>
  );
}
