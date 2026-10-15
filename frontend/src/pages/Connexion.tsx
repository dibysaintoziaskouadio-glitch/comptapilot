/**
 * Écran de connexion et d'inscription.
 * Toujours sombre, quel que soit le thème choisi : carte indigo sur un fond violet-magenta animé,
 * formulaire à gauche, ruban lumineux et message d'accueil à droite.
 * Inscription en trois étapes : identité (e-mail, téléphone), sécurité (mot de passe vérifié en direct),
 * puis confirmation par deux codes (e-mail ; SMS ou WhatsApp). Connexion par e-mail ou téléphone,
 * et parcours « mot de passe oublié » par code à usage unique.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ArrowRight, AtSign, Check, ChevronDown, Coins, Eye, EyeOff, FlaskConical, KeyRound, Loader2, Lock, Mail, MessageCircle, RotateCw, Send, ShieldCheck, Smartphone, User, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { CodeOTP } from '@/components/CodeOTP';
import { drapeau, PAYS, paysParDefaut } from '@/lib/pays';
import { api, ErreurApi } from '@/lib/api';
import { emailValide, LONGUEUR_MIN, reglesMotDePasse, robustesse } from '@/lib/motDePasse';
import { LogoComptapilot, MARQUE } from '@/components/Marque';
import { OndeFluide } from '@/components/OndeFluide';
import { cn } from '@/lib/utils';
import { useT, type Cle } from '@/lib/i18n';
import { BasculeLangue } from '@/components/layout/Preferences';
import { DEVISES } from '@/lib/devises';
import { montant } from '@/lib/format';

/** Exemples affichés sur le visuel : libellé, détail (avec montant de base) et résultat, dans la monnaie choisie. */
const EXEMPLES: { titre: Cle; detail: Cle; base: string; resultat: string }[] = [
  { titre: 'cx.exTva', detail: 'cx.exTvaDetail', base: '1000', resultat: '200' },
  { titre: 'cx.exAnnuite', detail: 'cx.exAnnuiteDetail', base: '100000', resultat: '1841.65' },
];

/** Délai d'apparition en cascade des éléments du formulaire. */
const cascade = (i: number) => ({ animationDelay: `${120 + i * 70}ms` });

type EtatSaisie = 'neutre' | 'valide' | 'invalide';

function Saisie({
  libelle,
  icone,
  droite,
  aide,
  erreur,
  etat = 'neutre',
  className,
  ...p
}: React.InputHTMLAttributes<HTMLInputElement> & { libelle: string; icone: React.ReactNode; droite?: React.ReactNode; aide?: React.ReactNode; erreur?: string | null; etat?: EtatSaisie }) {
  const id = useId();
  const e = erreur ? 'invalide' : etat;
  return (
    <div className={cn('group', className)}>
      <label htmlFor={id} className="mb-1.5 block pl-1 text-[11px] font-semibold uppercase tracking-[.12em] text-white/55">
        {libelle}
      </label>
      <div className="relative">
        <span className={cn('pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 transition-colors', e === 'invalide' ? 'text-[#fb7185]' : 'text-white/45 group-focus-within:text-[#c084fc]')}>{icone}</span>
        <input
          id={id}
          aria-invalid={e === 'invalide' || undefined}
          aria-describedby={erreur || aide ? `${id}-aide` : undefined}
          {...p}
          className={cn(
            'h-12 w-full rounded-full border bg-white/[.06] pl-11 pr-12 text-[14px] text-white placeholder:text-white/35 transition-all focus:bg-white/[.09] focus:outline-none',
            e === 'invalide'
              ? 'border-[#fb7185]/70 focus:shadow-[0_0_0_4px_rgb(251_113_133/.18)]'
              : e === 'valide'
                ? 'border-[#34d399]/50 focus:border-[#34d399] focus:shadow-[0_0_0_4px_rgb(52_211_153/.15)]'
                : 'border-white/15 hover:border-white/25 focus:border-[#a855f7] focus:shadow-[0_0_0_4px_rgb(168_85_247/.22),0_0_24px_-4px_rgb(217_70_239/.55)]',
          )}
        />
        <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {e === 'valide' && !droite && <Check className="mr-2 size-4 text-[#34d399] animate-in zoom-in" />}
          {droite}
        </span>
      </div>
      {(erreur || aide) && (
        <p id={`${id}-aide`} className={cn('mt-1.5 pl-4 text-[12px]', erreur ? 'text-[#fda4af]' : 'text-white/45')}>
          {erreur ?? aide}
        </p>
      )}
    </div>
  );
}

/** Bouton œil des champs mot de passe. */
function BoutonVoir({ voir, basculer }: { voir: boolean; basculer: () => void }) {
  const { t } = useT();
  return (
    <button type="button" onClick={basculer} className="grid size-8 place-items-center rounded-full text-white/45 hover:bg-white/10 hover:text-white" aria-label={t(voir ? 'cx.masquerMdp' : 'cx.afficherMdp')}>
      {voir ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}

/** Suit l'état de la touche Verr. Maj. pendant la saisie d'un mot de passe. */
function useVerrMaj() {
  const [actif, setActif] = useState(false);
  const suivre = (e: React.KeyboardEvent) => setActif(e.getModifierState?.('CapsLock') ?? false);
  return { actif, props: { onKeyDown: suivre, onKeyUp: suivre, onBlur: () => setActif(false) } };
}

function AlerteVerrMaj() {
  const { t } = useT();
  return (
    <p className="mt-1.5 flex items-center gap-1.5 pl-4 text-[12px] text-[#fcd34d] animate-in fade-in">
      <AlertTriangle className="size-3.5" /> {t('cx.verrMaj')}
    </p>
  );
}

function BoutonPrincipal({ envoi, children, disabled, style }: { envoi: boolean; children: React.ReactNode; disabled?: boolean; style?: React.CSSProperties }) {
  return (
    <button
      type="submit"
      disabled={envoi || disabled}
      className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full degrade-bouton text-[13px] font-bold uppercase tracking-[.16em] shadow-[0_14px_36px_-10px_rgb(236_72_153/.75)] transition-[transform,opacity] hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none animate-montee"
      style={style}
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25 blur-sm transition-transform duration-700 group-hover:translate-x-[420%]" />
      {envoi && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

function ErreurServeur({ message }: { message: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-2xl border border-[#fb7185]/30 bg-[#fb7185]/10 px-4 py-2.5 text-[13px] text-[#fecdd3] animate-montee">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {message}
    </p>
  );
}


// ─────────────────────────────── Types partagés ───────────────────────────────

interface EtatServeur {
  premierDemarrage: boolean;
  inscriptionOuverte: boolean;
  canaux: { email: boolean; sms: boolean; whatsapp: boolean };
  demonstration: boolean;
}

export interface EtatVerification {
  jeton: string;
  email: string;
  telephone: string | null;
  emailVerifie: boolean;
  telephoneVerifie: boolean;
  canalTelephone: 'SMS' | 'WHATSAPP' | null;
  codesDemo?: { email?: string; telephone?: string };
}

type CanalTel = 'SMS' | 'WHATSAPP';

/** Compte à rebours avant de pouvoir redemander un code (60 s, comme l'API). */
function useCompteARebours(initial = 60) {
  const [s, setS] = useState(initial);
  useEffect(() => {
    if (s <= 0) return;
    const id = setTimeout(() => setS((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [s]);
  return { secondes: s, relancer: () => setS(60) };
}

/** Choix segmenté (canal d'envoi). */
function Segments<T extends string>({ options, valeur, onChange, libelle }: { options: { v: T; libelle: string; icone: React.ReactNode }[]; valeur: T; onChange: (v: T) => void; libelle: string }) {
  return (
    <div>
      <p className="mb-1.5 pl-1 text-[11px] font-semibold uppercase tracking-[.12em] text-white/55">{libelle}</p>
      <div className="grid gap-1 rounded-full border border-white/10 bg-white/[.04] p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={libelle}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={valeur === o.v}
            onClick={() => onChange(o.v)}
            className={cn('flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-semibold transition-all', valeur === o.v ? 'bg-white text-[#1a1540] shadow' : 'text-white/60 hover:text-white')}
          >
            {o.icone} {o.libelle}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Encadré du mode démonstration : codes affichés faute de fournisseur d'envoi. */
function CodesDemo({ codes }: { codes: { libelle: string; code?: string }[] }) {
  const { t } = useT();
  const visibles = codes.filter((c) => c.code);
  if (!visibles.length) return null;
  return (
    <div className="rounded-2xl border border-dashed border-[#fcd34d]/50 bg-[#fcd34d]/[.07] px-4 py-3 text-[12.5px] text-[#fde68a] animate-montee" role="note">
      <p className="flex items-center gap-1.5 font-semibold">
        <FlaskConical className="size-4" /> {t('cx.demoTitre')}
      </p>
      <p className="mt-1 text-[#fde68a]/80">{t('cx.demoTexte')}</p>
      <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {visibles.map((c) => (
          <span key={c.libelle}>
            {c.libelle} : <strong className="font-display text-[15px] tracking-[.2em] text-white">{c.code}</strong>
          </span>
        ))}
      </p>
    </div>
  );
}

const optionsCanalTel = (t: (c: Cle) => string, canaux: EtatServeur['canaux']) =>
  [
    canaux.sms && { v: 'SMS' as CanalTel, libelle: t('cx.sms'), icone: <Smartphone className="size-3.5" /> },
    canaux.whatsapp && { v: 'WHATSAPP' as CanalTel, libelle: t('cx.whatsapp'), icone: <MessageCircle className="size-3.5" /> },
  ].filter(Boolean) as { v: CanalTel; libelle: string; icone: React.ReactNode }[];

// ─────────────────────────────── Connexion ───────────────────────────────

function FormulaireConnexion({ terminer, verifier, oublier, identifiantInitial, succes }: { terminer: () => Promise<void>; verifier: (e: EtatVerification) => void; oublier: (identifiant: string) => void; identifiantInitial: string; succes?: string | null }) {
  const [identifiant, setIdentifiant] = useState(identifiantInitial);
  const [mdp, setMdp] = useState('');
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const verrMaj = useVerrMaj();
  const { t, devise, erreur: messageErreur } = useT();

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await api('/auth/connexion', { method: 'POST', json: { identifiant, pays: paysParDefaut(devise), motDePasse: mdp } });
      await terminer();
    } catch (x) {
      // Compte créé mais pas encore confirmé : l'API renvoie l'état de vérification.
      if (x instanceof ErreurApi && x.code === 'COMPTE_NON_VERIFIE' && x.corps?.verification) verifier(x.corps.verification as EtatVerification);
      else setErreur(messageErreur(x));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={soumettre} className="space-y-4" noValidate>
      {succes && (
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-[#34d399]/30 bg-[#34d399]/10 px-4 py-2.5 text-[13px] text-[#a7f3d0] animate-montee">
          <Check className="mt-0.5 size-4 shrink-0" /> {succes}
        </p>
      )}
      <div className="animate-montee" style={cascade(3)}>
        <Saisie libelle={t('cx.identifiant')} icone={<AtSign className="size-4" />} placeholder={t('cx.identifiantPh')} value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoComplete="username" required />
      </div>
      <div className="animate-montee" style={cascade(4)}>
        <Saisie
          libelle={t('cx.mdp')}
          icone={<Lock className="size-4" />}
          type={voir ? 'text' : 'password'}
          placeholder={t('cx.mdpPh')}
          value={mdp}
          onChange={(e) => setMdp(e.target.value)}
          autoComplete="current-password"
          required
          {...verrMaj.props}
          droite={<BoutonVoir voir={voir} basculer={() => setVoir((v) => !v)} />}
        />
        {verrMaj.actif && <AlerteVerrMaj />}
        <div className="mt-2 flex justify-end pr-2">
          <button type="button" onClick={() => oublier(identifiant)} className="text-[12.5px] font-semibold text-[#f0abfc] hover:text-white hover:underline">
            {t('cx.oublie')}
          </button>
        </div>
      </div>
      {erreur && <ErreurServeur message={erreur} />}
      <div className="pt-1">
        <BoutonPrincipal envoi={envoi} disabled={!identifiant || !mdp} style={cascade(5)}>
          {t('cx.seConnecter')} {!envoi && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}
        </BoutonPrincipal>
      </div>
    </form>
  );
}

// ─────────────────────────────── Inscription ───────────────────────────────

function Etapes({ etape }: { etape: 1 | 2 | 3 }) {
  const { t } = useT();
  const items = [
    { n: 1, libelle: t('cx.identite') },
    { n: 2, libelle: t('cx.securite') },
    { n: 3, libelle: t('cx.verification') },
  ];
  return (
    <ol className="flex items-center gap-2" aria-label={t('cx.etape', { n: etape, total: 3 })}>
      {items.map((it, i) => {
        const fait = etape > it.n;
        const courant = etape === it.n;
        return (
          <li key={it.n} className={cn('flex items-center gap-2', i < items.length - 1 && 'flex-1')}>
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full text-[11.5px] font-bold transition-all duration-500',
                fait ? 'bg-[#34d399] text-[#0b2a1f]' : courant ? 'degrade-bouton text-white shadow-[0_0_0_4px_rgb(217_70_239/.2)]' : 'border border-white/20 text-white/50',
              )}
              aria-current={courant ? 'step' : undefined}
            >
              {fait ? <Check className="size-3.5" /> : it.n}
            </span>
            <span className={cn('hidden text-[12px] font-semibold sm:inline', courant || fait ? 'text-white' : 'text-white/45')}>{it.libelle}</span>
            {i < items.length - 1 && (
              <span className="relative h-[2px] min-w-4 flex-1 overflow-hidden rounded-full bg-white/10">
                <span className={cn('absolute inset-y-0 left-0 bg-gradient-to-r from-[#a855f7] to-[#ec4899] transition-all duration-700', etape > it.n ? 'w-full' : 'w-0')} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Robustesse({ mdp, nom, email }: { mdp: string; nom: string; email: string }) {
  const { t } = useT();
  const regles = useMemo(() => reglesMotDePasse(mdp, nom, email), [mdp, nom, email]);
  const r = robustesse(mdp, regles);
  const LIBELLES: Record<(typeof regles)[number]['id'], string> = {
    longueur: t('cx.regleLongueur', { n: LONGUEUR_MIN }),
    casse: t('cx.regleCasse'),
    chiffre: t('cx.regleChiffre'),
    special: t('cx.regleSpecial'),
    personnel: t('cx.reglePersonnel'),
  };
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-white/60">{t('cx.robustesse')}</span>
        <span className="font-semibold transition-colors" aria-live="polite" style={{ color: r.niveau ? r.couleur : 'rgb(255 255 255 / .45)' }}>
          {t(`cx.niveau${r.niveau}`)}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className="h-1.5 rounded-full bg-white/10 transition-all duration-500" style={r.niveau >= n ? { background: r.couleur, boxShadow: `0 0 10px ${r.couleur}` } : undefined} />
        ))}
      </div>
      <ul className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2" aria-label={t('cx.regles')}>
        {regles.map((g) => (
          <li key={g.id} className={cn('flex items-center gap-2 text-[12px] transition-colors', g.ok ? 'text-[#a7f3d0]' : 'text-white/50')}>
            <span className={cn('grid size-4 shrink-0 place-items-center rounded-full transition-all', g.ok ? 'bg-[#34d399] text-[#0b2a1f] scale-100' : 'border border-white/25 scale-90')}>{g.ok && <Check className="size-2.5" strokeWidth={3.5} />}</span>
            {LIBELLES[g.id]}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Numéro de téléphone : pays (indicatif) + numéro local. */
function SaisieTelephone({ pays, setPays, numero, setNumero, erreur, onBlur }: { pays: string; setPays: (p: string) => void; numero: string; setNumero: (n: string) => void; erreur?: string | null; onBlur?: () => void }) {
  const { t, langue } = useT();
  const id = useId();
  const p = PAYS.find((x) => x.code === pays) ?? PAYS[0];
  return (
    <div className="group">
      <label htmlFor={id} className="mb-1.5 block pl-1 text-[11px] font-semibold uppercase tracking-[.12em] text-white/55">
        {t('cx.telephone')}
      </label>
      <div className={cn('flex h-12 overflow-hidden rounded-full border bg-white/[.06] transition-all focus-within:bg-white/[.09]', erreur ? 'border-[#fb7185]/70' : 'border-white/15 hover:border-white/25 focus-within:border-[#a855f7] focus-within:shadow-[0_0_0_4px_rgb(168_85_247/.22)]')}>
        <div className="relative flex shrink-0 items-center border-r border-white/10">
          <select
            value={pays}
            onChange={(e) => setPays(e.target.value)}
            aria-label={t('cx.pays')}
            className="h-full appearance-none bg-transparent pl-4 pr-7 text-[14px] text-white focus:outline-none [&>option]:bg-[#1a1540]"
          >
            {PAYS.map((x) => (
              <option key={x.code} value={x.code}>
                {drapeau(x.code)} {x.nom[langue]} ({x.indicatif})
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 left-4 right-7 flex items-center bg-[#2a2452] text-[14px]">
            {drapeau(p.code)} <span className="ml-1.5 font-medium text-white/80">{p.indicatif}</span>
          </span>
          <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-white/45" />
        </div>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={t('cx.telephonePh')}
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/[^\d\s.+-]/g, ''))}
          onBlur={onBlur}
          aria-invalid={!!erreur || undefined}
          className="min-w-0 flex-1 bg-transparent px-4 text-[14px] text-white placeholder:text-white/35 focus:outline-none"
        />
      </div>
      <p className={cn('mt-1.5 pl-4 text-[12px]', erreur ? 'text-[#fda4af]' : 'text-white/45')}>{erreur ?? t('cx.telephoneAide')}</p>
    </div>
  );
}

function FormulaireInscription({ premier, canaux, verifier }: { premier: boolean; canaux: EtatServeur['canaux']; verifier: (e: EtatVerification) => void }) {
  const [etape, setEtape] = useState<1 | 2>(1);
  const { t, devise, changer, erreur: messageErreur, langue } = useT();
  const [v, setV] = useState({ prenom: '', nom: '', email: '', numero: '', mdp: '', confirmation: '' });
  const [pays, setPays] = useState(() => paysParDefaut(devise));
  const options = optionsCanalTel(t, canaux);
  const [canal, setCanal] = useState<CanalTel>(options[0]?.v ?? 'SMS');
  const [touches, setTouches] = useState<Record<string, boolean>>({});
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurEmail, setErreurEmail] = useState<string | null>(null);
  const [erreurTel, setErreurTel] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const verrMaj = useVerrMaj();
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV({ ...v, [k]: e.target.value });
    if (k === 'email') setErreurEmail(null);
  };
  const toucher = (k: string) => () => setTouches((x) => ({ ...x, [k]: true }));

  const nomComplet = `${v.prenom.trim()} ${v.nom.trim()}`.trim();
  const chiffresTel = v.numero.replace(/\D/g, '').length;
  const erreurs1 = {
    prenom: v.prenom.trim().length < 2 ? t('cx.errPrenom') : null,
    nom: v.nom.trim().length < 2 ? t('cx.errNom') : null,
    email: !emailValide(v.email) ? t('cx.errEmail') : null,
    telephone: chiffresTel < 6 || chiffresTel > 15 ? t('cx.errTelephone') : null,
  };
  const etape1Ok = !erreurs1.prenom && !erreurs1.nom && !erreurs1.email && !erreurs1.telephone;
  const regles = useMemo(() => reglesMotDePasse(v.mdp, nomComplet, v.email), [v.mdp, nomComplet, v.email]);
  const mdpOk = regles.every((r) => r.ok);
  const correspond = v.confirmation.length > 0 && v.confirmation === v.mdp;
  const montrer = (k: keyof typeof erreurs1) => (touches[k] ? erreurs1[k] : null);

  const continuer = (e: React.FormEvent) => {
    e.preventDefault();
    setTouches({ prenom: true, nom: true, email: true, telephone: true });
    if (etape1Ok) setEtape(2);
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mdpOk || !correspond) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api<{ verification: EtatVerification }>('/auth/inscription', {
        method: 'POST',
        json: { email: v.email.trim(), nom: nomComplet, telephone: v.numero, pays, canalTelephone: canal, motDePasse: v.mdp, langue, devise },
      });
      verifier(r.verification);
    } catch (x) {
      // Une adresse ou un numéro refusé se corrige à l'étape 1.
      const champ = x instanceof ErreurApi ? (x.code === 'EMAIL_UTILISE' ? 'email' : x.code === 'TELEPHONE_UTILISE' ? 'telephone' : x.champs[0]?.champ) : undefined;
      if (champ === 'email') (setErreurEmail(messageErreur(x)), setEtape(1));
      else if (champ === 'telephone') (setErreurTel(x instanceof ErreurApi && x.code === 'TELEPHONE_UTILISE' ? messageErreur(x) : t('cx.errTelephone')), setEtape(1));
      else setErreur(messageErreur(x));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="animate-montee" style={cascade(3)}>
        <Etapes etape={etape} />
      </div>

      {etape === 1 ? (
        <form key="identite" onSubmit={continuer} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="animate-montee" style={cascade(4)}>
              <Saisie libelle={t('cx.prenom')} icone={<User className="size-4" />} placeholder={t('cx.prenomPh')} value={v.prenom} onChange={maj('prenom')} onBlur={toucher('prenom')} autoComplete="given-name" erreur={montrer('prenom')} etat={v.prenom && !erreurs1.prenom ? 'valide' : 'neutre'} autoFocus />
            </div>
            <div className="animate-montee" style={cascade(5)}>
              <Saisie libelle={t('cx.nom')} icone={<User className="size-4" />} placeholder={t('cx.nomPh')} value={v.nom} onChange={maj('nom')} onBlur={toucher('nom')} autoComplete="family-name" erreur={montrer('nom')} etat={v.nom && !erreurs1.nom ? 'valide' : 'neutre'} />
            </div>
          </div>
          <div className="animate-montee" style={cascade(6)}>
            <Saisie
              libelle={t('cx.emailPro')}
              icone={<Mail className="size-4" />}
              type="email"
              placeholder={t('cx.emailProPh')}
              value={v.email}
              onChange={maj('email')}
              onBlur={toucher('email')}
              autoComplete="email"
              erreur={erreurEmail ?? montrer('email')}
              etat={v.email && !erreurs1.email ? 'valide' : 'neutre'}
              aide={t('cx.emailAide')}
            />
          </div>
          <div className="animate-montee" style={cascade(7)}>
            <SaisieTelephone pays={pays} setPays={(p) => (setPays(p), setErreurTel(null))} numero={v.numero} setNumero={(n) => (setV({ ...v, numero: n }), setErreurTel(null))} onBlur={toucher('telephone')} erreur={erreurTel ?? montrer('telephone')} />
          </div>
          <div className="animate-montee" style={cascade(8)}>
            <label htmlFor="devise-inscription" className="mb-1.5 block pl-1 text-[11px] font-semibold uppercase tracking-[.12em] text-white/55">
              {t('cx.devise')}
            </label>
            <div className="relative">
              <Coins className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/45" />
              <select
                id="devise-inscription"
                value={devise}
                onChange={(e) => changer({ devise: e.target.value })}
                className="h-12 w-full appearance-none rounded-full border border-white/15 bg-white/[.06] pl-11 pr-10 text-[14px] text-white focus:border-[#a855f7] focus:outline-none [&>option]:bg-[#1a1540]"
              >
                {DEVISES.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.code} — {x.nom[langue]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-white/45" />
            </div>
          </div>
          <div className="pt-2">
            <BoutonPrincipal envoi={false} style={cascade(9)}>
              {t('cx.continuer')} <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </BoutonPrincipal>
          </div>
        </form>
      ) : (
        <form key="securite" onSubmit={soumettre} className="space-y-4" noValidate>
          <p className="flex items-center gap-2 rounded-2xl bg-white/[.04] px-4 py-2.5 text-[12.5px] text-white/65 animate-montee" style={cascade(0)}>
            <UserRound className="size-4 shrink-0 text-[#67e8f9]" />
            <span className="min-w-0 truncate">
              <span className="font-semibold text-white">{nomComplet}</span> · {v.email.trim()} · {PAYS.find((x) => x.code === pays)?.indicatif} {v.numero}
            </span>
          </p>
          <div className="animate-montee" style={cascade(1)}>
            <Saisie
              libelle={t('cx.mdp')}
              icone={<KeyRound className="size-4" />}
              type={voir ? 'text' : 'password'}
              placeholder={t('cx.mdpChoisir')}
              value={v.mdp}
              onChange={maj('mdp')}
              autoComplete="new-password"
              etat={mdpOk ? 'valide' : 'neutre'}
              {...verrMaj.props}
              droite={<BoutonVoir voir={voir} basculer={() => setVoir((x) => !x)} />}
              autoFocus
            />
            {verrMaj.actif && <AlerteVerrMaj />}
            <Robustesse mdp={v.mdp} nom={nomComplet} email={v.email} />
          </div>
          <div className="animate-montee" style={cascade(2)}>
            <Saisie
              libelle={t('cx.confirmation')}
              icone={<Lock className="size-4" />}
              type={voir ? 'text' : 'password'}
              placeholder={t('cx.confirmationPh')}
              value={v.confirmation}
              onChange={maj('confirmation')}
              onBlur={toucher('confirmation')}
              autoComplete="new-password"
              etat={correspond ? 'valide' : 'neutre'}
              erreur={(touches.confirmation || v.confirmation.length >= v.mdp.length) && v.confirmation && !correspond ? t('cx.errCorrespond') : null}
              aide={correspond ? t('cx.correspond') : undefined}
            />
          </div>
          {options.length > 0 && (
            <div className="animate-montee" style={cascade(3)}>
              <Segments libelle={t('cx.recevoirPar')} options={options} valeur={canal} onChange={setCanal} />
            </div>
          )}
          {erreur && <ErreurServeur message={erreur} />}
          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={() => setEtape(1)} className="flex h-12 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-5 text-[13px] font-semibold text-white/80 transition-colors hover:border-white/30 hover:bg-white/5 animate-montee" style={cascade(4)}>
              <ArrowLeft className="size-4" /> {t('cx.retour')}
            </button>
            <BoutonPrincipal envoi={envoi} disabled={!mdpOk || !correspond} style={cascade(4)}>
              {t(premier ? 'cx.creerAdmin' : 'cx.creer')}
            </BoutonPrincipal>
          </div>
          <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-white/40">
            <ShieldCheck className="size-3.5" /> {t('cx.chiffre')}
          </p>
        </form>
      )}
    </div>
  );
}

// ─────────────────────────────── Vérification des codes ───────────────────────────────

function BlocCode({
  icone,
  titre,
  destination,
  verifie,
  demarrer,
  onVerifier,
  onRenvoyer,
  autreCanal,
  autoFocus,
}: {
  icone: React.ReactNode;
  titre: string;
  destination: string;
  verifie: boolean;
  demarrer: boolean;
  onVerifier: (code: string) => Promise<string | null>;
  onRenvoyer: (canal?: CanalTel) => Promise<boolean>;
  autreCanal?: { canal: CanalTel; libelle: string };
  autoFocus?: boolean;
}) {
  const { t } = useT();
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [renvoye, setRenvoye] = useState(false);
  const rebours = useCompteARebours(demarrer ? 60 : 0);

  const verifier = async (c: string) => {
    setEnvoi(true);
    setErreur(null);
    const e = await onVerifier(c);
    setEnvoi(false);
    if (e) (setErreur(e), setCode(''));
  };
  const renvoyer = async (canal?: CanalTel) => {
    setErreur(null);
    if (await onRenvoyer(canal)) (rebours.relancer(), setRenvoye(true), setCode(''));
  };

  return (
    <div className={cn('rounded-2xl border p-4 transition-colors', verifie ? 'border-[#34d399]/40 bg-[#34d399]/[.07]' : 'border-white/10 bg-white/[.04]')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', verifie ? 'bg-[#34d399] text-[#0b2a1f]' : 'bg-white/10 text-[#67e8f9]')}>{verifie ? <Check className="size-4" /> : icone}</span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold">{titre}</p>
            <p className="truncate text-[12px] text-white/50">{t('cx.envoyeA', { destination })}</p>
          </div>
        </div>
        {verifie && <span className="shrink-0 rounded-full bg-[#34d399]/15 px-2.5 py-1 text-[11px] font-bold text-[#6ee7b7]">{t('cx.confirme')}</span>}
      </div>
      {!verifie && (
        <div className="mt-3 space-y-2.5">
          <CodeOTP valeur={code} onChange={setCode} onComplet={verifier} desactive={envoi} invalide={!!erreur} libelle={titre} autoFocus={autoFocus} />
          {erreur && <p className="pl-1 text-[12px] text-[#fda4af]">{erreur}</p>}
          {renvoye && !erreur && <p className="pl-1 text-[12px] text-[#a7f3d0]">{t('cx.codeRenvoye')}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
            <button type="button" disabled={rebours.secondes > 0} onClick={() => renvoyer()} className="flex items-center gap-1.5 font-semibold text-[#f0abfc] hover:text-white disabled:cursor-default disabled:text-white/40">
              <RotateCw className="size-3.5" /> {rebours.secondes > 0 ? t('cx.renvoyerDans', { s: rebours.secondes }) : t('cx.renvoyer')}
            </button>
            {autreCanal && (
              <button type="button" disabled={rebours.secondes > 0} onClick={() => renvoyer(autreCanal.canal)} className="font-semibold text-white/60 hover:text-white disabled:cursor-default disabled:text-white/30">
                {autreCanal.libelle}
              </button>
            )}
          </div>
          {envoi && <Loader2 className="mx-auto size-4 animate-spin text-white/60" />}
        </div>
      )}
    </div>
  );
}

function Verification({ initial, canaux, terminer }: { initial: EtatVerification; canaux: EtatServeur['canaux']; terminer: () => Promise<void> }) {
  const { t, erreur: messageErreur } = useT();
  const [etat, setEtat] = useState(initial);
  const [demo, setDemo] = useState(initial.codesDemo ?? {});
  const canal: CanalTel = etat.canalTelephone ?? 'SMS';
  const autre: CanalTel = canal === 'SMS' ? 'WHATSAPP' : 'SMS';
  const autreDispo = autre === 'SMS' ? canaux.sms : canaux.whatsapp;

  const verifier = (cible: 'email' | 'telephone') => async (code: string) => {
    try {
      const r = await api<{ verification?: EtatVerification; utilisateur?: unknown }>('/auth/verification/verifier', { method: 'POST', json: { jeton: etat.jeton, cible, code } });
      if (r.utilisateur) await terminer();
      else if (r.verification) setEtat((e) => ({ ...r.verification!, canalTelephone: e.canalTelephone }));
      return null;
    } catch (x) {
      return messageErreur(x);
    }
  };
  const renvoyer = (cible: 'email' | 'telephone') => async (c?: CanalTel) => {
    try {
      const r = await api<{ verification: EtatVerification }>('/auth/verification/renvoyer', { method: 'POST', json: { jeton: etat.jeton, cible, canal: cible === 'telephone' ? (c ?? canal) : undefined } });
      setEtat((e) => ({ ...r.verification, canalTelephone: cible === 'telephone' ? (r.verification.canalTelephone ?? e.canalTelephone) : e.canalTelephone }));
      setDemo((d) => ({ ...d, ...r.verification.codesDemo }));
      return true;
    } catch (x) {
      toast.error(messageErreur(x));
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <CodesDemo
        codes={[
          { libelle: t('cx.demoCodeEmail'), code: etat.emailVerifie ? undefined : demo.email },
          { libelle: t('cx.demoCodeTelephone'), code: etat.telephoneVerifie ? undefined : demo.telephone },
        ]}
      />
      <div className="animate-montee" style={cascade(3)}>
        <BlocCode icone={<Mail className="size-4" />} titre={t('cx.codeEmail')} destination={etat.email} verifie={etat.emailVerifie} demarrer={!!initial.codesDemo?.email || !initial.emailVerifie} onVerifier={verifier('email')} onRenvoyer={renvoyer('email')} autoFocus={!etat.emailVerifie} />
      </div>
      {etat.telephone && (
        <div className="animate-montee" style={cascade(4)}>
          <BlocCode
            icone={canal === 'WHATSAPP' ? <MessageCircle className="size-4" /> : <Smartphone className="size-4" />}
            titre={t('cx.codeTelephone', { canal: t(canal === 'WHATSAPP' ? 'cx.whatsapp' : 'cx.sms') })}
            destination={etat.telephone}
            verifie={etat.telephoneVerifie}
            demarrer={!initial.telephoneVerifie}
            onVerifier={verifier('telephone')}
            onRenvoyer={renvoyer('telephone')}
            autreCanal={autreDispo ? { canal: autre, libelle: t(autre === 'WHATSAPP' ? 'cx.parWhatsapp' : 'cx.parSms') } : undefined}
            autoFocus={etat.emailVerifie}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────── Mot de passe oublié ───────────────────────────────

function FormulaireOubli({ identifiantInitial, canaux, retour }: { identifiantInitial: string; canaux: EtatServeur['canaux']; retour: (identifiant: string, succes?: boolean) => void }) {
  const { t, devise, erreur: messageErreur } = useT();
  const [identifiant, setIdentifiant] = useState(identifiantInitial);
  const parEmail = identifiant.includes('@');
  const options = [
    canaux.email && { v: 'EMAIL' as const, libelle: t('cx.emailCanal'), icone: <Mail className="size-3.5" /> },
    ...(parEmail ? [] : optionsCanalTel(t, canaux)),
  ].filter(Boolean) as { v: 'EMAIL' | CanalTel; libelle: string; icone: React.ReactNode }[];
  const [canal, setCanal] = useState<'EMAIL' | CanalTel>(parEmail || !identifiant ? 'EMAIL' : 'SMS');
  const canalEffectif = options.some((o) => o.v === canal) ? canal : (options[0]?.v ?? 'EMAIL');
  const [envoye, setEnvoye] = useState(false);
  const [nonEnvoye, setNonEnvoye] = useState(false);
  const [code, setCode] = useState('');
  const [mdp, setMdp] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const rebours = useCompteARebours(0);
  const verrMaj = useVerrMaj();
  const pays = paysParDefaut(devise);
  const regles = useMemo(() => reglesMotDePasse(mdp, '', parEmail ? identifiant : ''), [mdp, identifiant, parEmail]);
  const mdpOk = regles.every((r) => r.ok);
  const correspond = confirmation.length > 0 && confirmation === mdp;

  const demander = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api<{ envoye: boolean; nonEnvoye?: boolean }>('/auth/mot-de-passe/oubli', { method: 'POST', json: { identifiant, pays, canal: canalEffectif } });
      setNonEnvoye(!!r.nonEnvoye);
      setEnvoye(true);
      setCode('');
      rebours.relancer();
    } catch (x) {
      setErreur(messageErreur(x));
    } finally {
      setEnvoi(false);
    }
  };

  const reinitialiser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || !mdpOk || !correspond) return;
    setErreur(null);
    setEnvoi(true);
    try {
      await api('/auth/mot-de-passe/reinitialiser', { method: 'POST', json: { identifiant, pays, code, motDePasse: mdp } });
      retour(identifiant, true);
    } catch (x) {
      setErreur(messageErreur(x));
      if (x instanceof ErreurApi && x.code.startsWith('CODE_')) setCode('');
    } finally {
      setEnvoi(false);
    }
  };

  if (!envoye)
    return (
      <form onSubmit={demander} className="space-y-4" noValidate>
        <div className="animate-montee" style={cascade(3)}>
          <Saisie libelle={t('cx.identifiant')} icone={<AtSign className="size-4" />} placeholder={t('cx.identifiantPh')} value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoComplete="username" autoFocus />
        </div>
        {options.length > 0 && (
          <div className="animate-montee" style={cascade(4)}>
            <Segments libelle={t('cx.canalOubli')} options={options} valeur={canalEffectif} onChange={setCanal} />
          </div>
        )}
        {erreur && <ErreurServeur message={erreur} />}
        <div className="pt-2">
          <BoutonPrincipal envoi={envoi} disabled={identifiant.trim().length < 3 || !options.length} style={cascade(5)}>
            {t('cx.recevoirCode')} {!envoi && <Send className="size-4" />}
          </BoutonPrincipal>
        </div>
        <button type="button" onClick={() => retour(identifiant)} className="mx-auto flex items-center gap-1.5 text-[12.5px] font-semibold text-white/60 hover:text-white">
          <ArrowLeft className="size-3.5" /> {t('cx.retourConnexion')}
        </button>
      </form>
    );

  return (
    <form onSubmit={reinitialiser} className="space-y-4" noValidate>
      <p role="status" className="flex items-start gap-2 rounded-2xl bg-white/[.05] px-4 py-2.5 text-[12.5px] text-white/70 animate-montee">
        <Send className="mt-0.5 size-4 shrink-0 text-[#67e8f9]" /> {t('cx.oubliEnvoye', { identifiant })}
      </p>
      {nonEnvoye && (
        <div className="rounded-2xl border border-dashed border-[#fcd34d]/50 bg-[#fcd34d]/[.07] px-4 py-3 text-[12.5px] text-[#fde68a] animate-montee" role="note">
          <p className="flex items-center gap-1.5 font-semibold">
            <FlaskConical className="size-4" /> {t('cx.demoTitre')}
          </p>
          <p className="mt-1 text-[#fde68a]/80">{t('cx.demoReinit')}</p>
        </div>
      )}
      <div className="animate-montee" style={cascade(1)}>
        <p className="mb-1.5 pl-1 text-[11px] font-semibold uppercase tracking-[.12em] text-white/55">{t('cx.code')}</p>
        <CodeOTP valeur={code} onChange={setCode} libelle={t('cx.code')} autoFocus />
        <button type="button" disabled={rebours.secondes > 0 || envoi} onClick={() => demander()} className="mt-2 flex items-center gap-1.5 pl-1 text-[12.5px] font-semibold text-[#f0abfc] hover:text-white disabled:cursor-default disabled:text-white/40">
          <RotateCw className="size-3.5" /> {rebours.secondes > 0 ? t('cx.renvoyerDans', { s: rebours.secondes }) : t('cx.renvoyer')}
        </button>
      </div>
      <div className="animate-montee" style={cascade(2)}>
        <Saisie
          libelle={t('cx.nouveauMdp')}
          icone={<KeyRound className="size-4" />}
          type={voir ? 'text' : 'password'}
          placeholder={t('cx.mdpChoisir')}
          value={mdp}
          onChange={(e) => setMdp(e.target.value)}
          autoComplete="new-password"
          etat={mdpOk ? 'valide' : 'neutre'}
          {...verrMaj.props}
          droite={<BoutonVoir voir={voir} basculer={() => setVoir((x) => !x)} />}
        />
        {verrMaj.actif && <AlerteVerrMaj />}
        <Robustesse mdp={mdp} nom="" email={parEmail ? identifiant : ''} />
      </div>
      <div className="animate-montee" style={cascade(3)}>
        <Saisie
          libelle={t('cx.confirmation')}
          icone={<Lock className="size-4" />}
          type={voir ? 'text' : 'password'}
          placeholder={t('cx.confirmationPh')}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="new-password"
          etat={correspond ? 'valide' : 'neutre'}
          erreur={confirmation.length >= mdp.length && confirmation && !correspond ? t('cx.errCorrespond') : null}
        />
      </div>
      {erreur && <ErreurServeur message={erreur} />}
      <div className="flex items-center gap-3 pt-1">
        <button type="button" onClick={() => setEnvoye(false)} className="flex h-12 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-5 text-[13px] font-semibold text-white/80 transition-colors hover:border-white/30 hover:bg-white/5">
          <ArrowLeft className="size-4" /> {t('cx.retour')}
        </button>
        <BoutonPrincipal envoi={envoi} disabled={code.length !== 6 || !mdpOk || !correspond}>
          {t('cx.changerMdp')}
        </BoutonPrincipal>
      </div>
    </form>
  );
}

// ─────────────────────────────── Page ───────────────────────────────

export function PageConnexion() {
  const etat = useQuery({ queryKey: ['etat'], queryFn: () => api<EtatServeur>('/auth/etat') });
  const [mode, setMode] = useState<'connexion' | 'inscription' | 'oubli' | 'verification'>('connexion');
  const [verification, setVerification] = useState<EtatVerification | null>(null);
  const [depuisInscription, setDepuisInscription] = useState(false);
  const [identifiant, setIdentifiant] = useState('');
  const [succes, setSucces] = useState<string | null>(null);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { t } = useT();
  const premier = !!etat.data?.premierDemarrage;
  const canaux = etat.data?.canaux ?? { email: false, sms: false, whatsapp: false };
  // Au premier démarrage, l'écran s'ouvre sur l'inscription de l'administrateur.
  const vue = premier && mode === 'connexion' ? 'inscription' : mode;
  const inscription = vue === 'inscription' || (vue === 'verification' && depuisInscription);
  const peutBasculer = !premier && !!etat.data?.inscriptionOuverte;
  const basculer = () => (setSucces(null), setMode(vue === 'connexion' ? 'inscription' : 'connexion'));
  const terminer = async () => {
    await qc.invalidateQueries({ queryKey: ['session'] });
    nav('/');
  };
  const verifier = (depuis: 'inscription' | 'connexion') => (e: EtatVerification) => {
    setVerification(e);
    setDepuisInscription(depuis === 'inscription');
    setMode('verification');
  };

  const titre = t(vue === 'verification' ? 'cx.titreVerification' : vue === 'oubli' ? 'cx.titreOubli' : premier ? 'cx.titreAdmin' : vue === 'inscription' ? 'cx.titreInscription' : 'cx.titreConnexion');
  const sousTitre = t(vue === 'verification' ? 'cx.sousVerification' : vue === 'oubli' ? 'cx.sousOubli' : premier ? 'cx.sousAdmin' : vue === 'inscription' ? 'cx.sousInscription' : 'cx.sousConnexion');
  const IconeAvatar = vue === 'oubli' ? KeyRound : vue === 'verification' || premier ? ShieldCheck : UserRound;
  const compact = vue !== 'connexion';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[linear-gradient(125deg,#3b2bd9,#7c2bf0_35%,#b026e8_65%,#e0309f)] bg-[length:220%_220%] px-3 py-6 text-white animate-degrade sm:px-6 sm:py-10">
      {/* Lueurs en mouvement */}
      <div className="pointer-events-none absolute -left-40 -top-40 size-[34rem] rounded-full bg-[#3b6bff]/40 blur-[120px] animate-derive" />
      <div className="pointer-events-none absolute -bottom-48 -right-32 size-[38rem] rounded-full bg-[#ff3cac]/35 blur-[130px] animate-derive [animation-delay:-6s]" />
      <div className="pointer-events-none absolute left-1/3 top-1/2 size-[26rem] rounded-full bg-[#22d3ee]/15 blur-[110px] animate-derive [animation-delay:-11s]" />

      <div className="relative w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[#1a1540]/90 shadow-[0_40px_120px_-30px_rgb(10_5_40/.85)] backdrop-blur-xl animate-entree">
        {/* Barre supérieure */}
        <header className="flex items-center justify-between gap-4 border-b border-white/[.07] px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <LogoComptapilot className="size-10 ring-1 ring-white/15" />
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold uppercase tracking-[.14em]">Comptapilot</p>
              <p className="text-[11px] tracking-wide text-white/55">{t('commun.parSociete', { societe: MARQUE.societe })}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <nav className="hidden items-center gap-6 text-[11px] font-semibold uppercase tracking-[.16em] text-white/55 lg:flex" aria-label={t('cx.chiffresCles')}>
              <span>{t('cx.formules', { n: 163 })}</span>
              <span>{t('cx.moteurs', { n: 13 })}</span>
              <span>{t('cx.baremesDates')}</span>
            </nav>
            <BasculeLangue />
            {peutBasculer && (
              <button
                type="button"
                onClick={basculer}
                className="rounded-full bg-gradient-to-r from-[#22d3ee] to-[#3b82f6] px-5 py-2 text-[11.5px] font-bold uppercase tracking-[.12em] text-white shadow-[0_8px_24px_-8px_rgb(34_211_238/.7)] transition-transform hover:scale-[1.04] active:scale-95"
              >
                {t(vue === 'connexion' ? 'cx.sinscrire' : 'cx.seConnecter')}
              </button>
            )}
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,470px)_1px_minmax(0,1fr)]">
          {/* Panneau visuel (en tête sur mobile, à droite sur grand écran) */}
          <section className="relative order-1 h-56 overflow-hidden sm:h-72 lg:order-3 lg:h-auto lg:min-h-[620px]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_45%,rgb(124_58_237/.35),transparent_65%)]" />
            <OndeFluide className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#1a1540] via-[#1a1540]/60 to-transparent" />

            <div className="absolute right-6 top-6 hidden flex-col gap-3 xl:flex">
              {EXEMPLES.map((x, i) => (
                <div key={x.titre} className="w-60 rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 shadow-[0_10px_30px_-12px_rgb(0_0_0/.5)] backdrop-blur-md animate-flottement" style={{ animationDelay: `${-i * 3}s` }}>
                  <p className="flex items-center justify-between gap-2 text-[11px] text-white/60">
                    {t(x.titre)}
                    <span className="size-1.5 rounded-full bg-[#34d399] shadow-[0_0_8px_#34d399]" />
                  </p>
                  <p className="mt-0.5 text-xl font-semibold montant">{montant(x.resultat)}</p>
                  <p className="text-[11px] text-white/40 chiffre">{t(x.detail, { montant: montant(x.base) })}</p>
                </div>
              ))}
            </div>

            <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 lg:bottom-14 lg:left-12">
              <h1 key={vue === 'oubli' ? 'o' : inscription ? 'i' : 'c'} className="text-5xl font-bold animate-montee sm:text-6xl lg:text-7xl" style={{ animationDelay: '250ms' }}>
                {t(vue === 'oubli' ? 'cx.pasDePanique' : inscription ? 'cx.bienvenue' : 'cx.bonRetour')}
                <span className="text-[#ff4fd8]">.</span>
              </h1>
              <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/70 animate-montee sm:text-[15px]" style={{ animationDelay: '380ms' }}>
                {t(vue === 'oubli' ? 'cx.accrocheOubli' : 'cx.accroche')}
              </p>
              {peutBasculer && vue !== 'oubli' && (
                <p className="mt-4 hidden text-[13px] text-white/60 animate-montee lg:block" style={{ animationDelay: '480ms' }}>
                  {t(vue === 'connexion' ? 'cx.pasCompte' : 'cx.dejaCompte')}{' '}
                  <button type="button" onClick={basculer} className="font-semibold text-white underline decoration-[#ff4fd8] decoration-2 underline-offset-4 hover:text-[#ffb3ef]">
                    {t(vue === 'connexion' ? 'cx.creerCompte' : 'cx.seConnecter')}
                  </button>
                </p>
              )}
            </div>
          </section>

          <div className="order-2 hidden bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block" />

          {/* Formulaires */}
          <div key={vue} className="order-3 flex flex-col justify-center px-6 py-10 sm:px-12 lg:order-1 lg:py-12">
            <div className={cn('relative mx-auto grid place-items-center animate-montee', compact ? 'mb-4 size-16' : 'mb-6 size-20')} style={cascade(0)}>
              <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#22d3ee,#7c3aed,#ff3cac,#22d3ee)] p-[2px] animate-rotation-lente">
                <div className="size-full rounded-full bg-[#1a1540]" />
              </div>
              <div className="absolute inset-2 rounded-full bg-[#7c3aed]/25 blur-md animate-halo" />
              <IconeAvatar className={cn('relative text-[#67e8f9]', compact ? 'size-7' : 'size-9')} strokeWidth={1.6} />
            </div>

            <h2 className="text-center text-[26px] font-semibold animate-montee" style={cascade(1)}>
              {titre}
            </h2>
            <p className={cn('mt-1.5 text-center text-[13.5px] text-white/60 animate-montee', compact ? 'mb-6' : 'mb-7')} style={cascade(2)}>
              {sousTitre}
            </p>

            {vue === 'verification' && verification ? (
              <div className="space-y-6">
                {depuisInscription && (
                  <div className="animate-montee" style={cascade(3)}>
                    <Etapes etape={3} />
                  </div>
                )}
                <Verification initial={verification} canaux={canaux} terminer={terminer} />
              </div>
            ) : vue === 'inscription' ? (
              <FormulaireInscription premier={premier} canaux={canaux} verifier={verifier('inscription')} />
            ) : vue === 'oubli' ? (
              <FormulaireOubli
                identifiantInitial={identifiant}
                canaux={canaux}
                retour={(id, ok) => {
                  setIdentifiant(id);
                  setSucces(ok ? t('cx.mdpChange') : null);
                  setMode('connexion');
                }}
              />
            ) : (
              <FormulaireConnexion
                key={identifiant + (succes ?? '')}
                terminer={terminer}
                verifier={verifier('connexion')}
                oublier={(id) => (setIdentifiant(id), setSucces(null), setMode('oubli'))}
                identifiantInitial={identifiant}
                succes={succes}
              />
            )}

            {peutBasculer && vue !== 'oubli' && (
              <p className="mt-6 text-center text-[13px] text-white/55 lg:hidden">
                {t(vue === 'connexion' ? 'cx.pasCompte' : 'cx.dejaCompte')}{' '}
                <button type="button" onClick={basculer} className="font-semibold text-[#f0abfc] hover:underline">
                  {t(vue === 'connexion' ? 'cx.creerCompte' : 'cx.seConnecter')}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="relative mt-6 text-[12px] text-white/70">
        {t('commun.copyright', { annee: new Date().getFullYear(), societe: MARQUE.societe })}
      </p>
    </div>
  );
}
