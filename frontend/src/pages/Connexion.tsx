/**
 * Écran de connexion et d'inscription.
 * Toujours sombre, quel que soit le thème choisi : carte indigo sur un fond violet-magenta animé,
 * formulaire à gauche, ruban lumineux et message d'accueil à droite.
 * L'inscription se fait en deux étapes (identité, puis sécurité) avec vérification du mot de passe en direct.
 */
import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, ShieldCheck, User, UserRound, X } from 'lucide-react';
import { api, ErreurApi } from '@/lib/api';
import { emailValide, reglesMotDePasse, robustesse } from '@/lib/motDePasse';
import { LogoVision, MARQUE } from '@/components/Marque';
import { OndeFluide } from '@/components/OndeFluide';
import { cn } from '@/lib/utils';

const EXEMPLES: [string, string, string][] = [
  ['TVA à 20 %', 'HT 1 000 €', '200,00 €'],
  ['Annuité d’emprunt', '100 000 € · 5 ans · 4 %', '1 841,65 €'],
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
  return (
    <button type="button" onClick={basculer} className="grid size-8 place-items-center rounded-full text-white/45 hover:bg-white/10 hover:text-white" aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
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
  return (
    <p className="mt-1.5 flex items-center gap-1.5 pl-4 text-[12px] text-[#fcd34d] animate-in fade-in">
      <AlertTriangle className="size-3.5" /> Verrouillage des majuscules activé
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

const messageErreur = (x: unknown) => (x instanceof ErreurApi ? (x.details?.[0]?.message ?? x.message) : 'Serveur injoignable. Vérifiez votre connexion.');

// ─────────────────────────────── Connexion ───────────────────────────────

function FormulaireConnexion({ terminer }: { terminer: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const verrMaj = useVerrMaj();

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await api('/auth/connexion', { method: 'POST', json: { email, motDePasse: mdp } });
      await terminer();
    } catch (x) {
      setErreur(messageErreur(x));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={soumettre} className="space-y-4" noValidate>
      <div className="animate-montee" style={cascade(3)}>
        <Saisie libelle="Adresse e-mail" icone={<Mail className="size-4" />} type="email" placeholder="vous@cabinet.fr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </div>
      <div className="animate-montee" style={cascade(4)}>
        <Saisie
          libelle="Mot de passe"
          icone={<Lock className="size-4" />}
          type={voir ? 'text' : 'password'}
          placeholder="Votre mot de passe"
          value={mdp}
          onChange={(e) => setMdp(e.target.value)}
          autoComplete="current-password"
          required
          {...verrMaj.props}
          droite={<BoutonVoir voir={voir} basculer={() => setVoir((v) => !v)} />}
        />
        {verrMaj.actif && <AlerteVerrMaj />}
      </div>
      {erreur && <ErreurServeur message={erreur} />}
      <div className="pt-2">
        <BoutonPrincipal envoi={envoi} disabled={!email || !mdp} style={cascade(5)}>
          Se connecter {!envoi && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}
        </BoutonPrincipal>
      </div>
    </form>
  );
}

// ─────────────────────────────── Inscription ───────────────────────────────

function Etapes({ etape }: { etape: 1 | 2 }) {
  const items = [
    { n: 1, libelle: 'Identité' },
    { n: 2, libelle: 'Sécurité' },
  ];
  return (
    <ol className="flex items-center gap-3" aria-label={`Étape ${etape} sur 2`}>
      {items.map((it, i) => {
        const fait = etape > it.n;
        const courant = etape === it.n;
        return (
          <li key={it.n} className="flex flex-1 items-center gap-3">
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-bold transition-all duration-500',
                fait ? 'bg-[#34d399] text-[#0b2a1f]' : courant ? 'degrade-bouton text-white shadow-[0_0_0_4px_rgb(217_70_239/.2)]' : 'border border-white/20 text-white/50',
              )}
              aria-current={courant ? 'step' : undefined}
            >
              {fait ? <Check className="size-4" /> : it.n}
            </span>
            <span className={cn('text-[12.5px] font-semibold', courant || fait ? 'text-white' : 'text-white/45')}>{it.libelle}</span>
            {i < items.length - 1 && (
              <span className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-white/10">
                <span className={cn('absolute inset-y-0 left-0 bg-gradient-to-r from-[#a855f7] to-[#ec4899] transition-all duration-700', etape > 1 ? 'w-full' : 'w-0')} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Robustesse({ mdp, nom, email }: { mdp: string; nom: string; email: string }) {
  const regles = useMemo(() => reglesMotDePasse(mdp, nom, email), [mdp, nom, email]);
  const r = robustesse(mdp, regles);
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
      <div className="flex items-center justify-between text-[12px]">
        <span className="font-medium text-white/60">Robustesse</span>
        <span className="font-semibold transition-colors" aria-live="polite" style={{ color: r.niveau ? r.couleur : 'rgb(255 255 255 / .45)' }}>
          {r.libelle}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className="h-1.5 rounded-full bg-white/10 transition-all duration-500" style={r.niveau >= n ? { background: r.couleur, boxShadow: `0 0 10px ${r.couleur}` } : undefined} />
        ))}
      </div>
      <ul className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2" aria-label="Règles du mot de passe">
        {regles.map((g) => (
          <li key={g.id} className={cn('flex items-center gap-2 text-[12px] transition-colors', g.ok ? 'text-[#a7f3d0]' : 'text-white/50')}>
            <span className={cn('grid size-4 shrink-0 place-items-center rounded-full transition-all', g.ok ? 'bg-[#34d399] text-[#0b2a1f] scale-100' : 'border border-white/25 scale-90')}>{g.ok && <Check className="size-2.5" strokeWidth={3.5} />}</span>
            {g.libelle}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FormulaireInscription({ terminer, premier }: { terminer: () => Promise<void>; premier: boolean }) {
  const [etape, setEtape] = useState<1 | 2>(1);
  const [v, setV] = useState({ prenom: '', nom: '', email: '', mdp: '', confirmation: '' });
  const [touches, setTouches] = useState<Record<string, boolean>>({});
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurEmail, setErreurEmail] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const verrMaj = useVerrMaj();
  const maj = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setV({ ...v, [k]: e.target.value });
    if (k === 'email') setErreurEmail(null);
  };
  const toucher = (k: string) => () => setTouches((t) => ({ ...t, [k]: true }));

  const nomComplet = `${v.prenom.trim()} ${v.nom.trim()}`.trim();
  const erreurs1 = {
    prenom: v.prenom.trim().length < 2 ? 'Indiquez votre prénom' : null,
    nom: v.nom.trim().length < 2 ? 'Indiquez votre nom' : null,
    email: !emailValide(v.email) ? 'Adresse e-mail invalide' : null,
  };
  const etape1Ok = !erreurs1.prenom && !erreurs1.nom && !erreurs1.email;
  const regles = useMemo(() => reglesMotDePasse(v.mdp, nomComplet, v.email), [v.mdp, nomComplet, v.email]);
  const mdpOk = regles.every((r) => r.ok);
  const correspond = v.confirmation.length > 0 && v.confirmation === v.mdp;
  const montrer = (k: keyof typeof erreurs1) => (touches[k] ? erreurs1[k] : null);

  const continuer = (e: React.FormEvent) => {
    e.preventDefault();
    setTouches({ prenom: true, nom: true, email: true });
    if (etape1Ok) setEtape(2);
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mdpOk || !correspond) return;
    setErreur(null);
    setEnvoi(true);
    try {
      await api('/auth/inscription', { method: 'POST', json: { email: v.email.trim(), nom: nomComplet, motDePasse: v.mdp } });
      await terminer();
    } catch (x) {
      // Une adresse déjà utilisée se corrige à l'étape 1.
      if (x instanceof ErreurApi && (x.code === 'EMAIL_UTILISE' || x.details?.[0]?.champ === 'email')) {
        setErreurEmail(messageErreur(x));
        setEtape(1);
      } else setErreur(messageErreur(x));
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
              <Saisie libelle="Prénom" icone={<User className="size-4" />} placeholder="Camille" value={v.prenom} onChange={maj('prenom')} onBlur={toucher('prenom')} autoComplete="given-name" erreur={montrer('prenom')} etat={v.prenom && !erreurs1.prenom ? 'valide' : 'neutre'} autoFocus />
            </div>
            <div className="animate-montee" style={cascade(5)}>
              <Saisie libelle="Nom" icone={<User className="size-4" />} placeholder="Martin" value={v.nom} onChange={maj('nom')} onBlur={toucher('nom')} autoComplete="family-name" erreur={montrer('nom')} etat={v.nom && !erreurs1.nom ? 'valide' : 'neutre'} />
            </div>
          </div>
          <div className="animate-montee" style={cascade(6)}>
            <Saisie
              libelle="Adresse e-mail professionnelle"
              icone={<Mail className="size-4" />}
              type="email"
              placeholder="camille.martin@cabinet.fr"
              value={v.email}
              onChange={maj('email')}
              onBlur={toucher('email')}
              autoComplete="email"
              erreur={erreurEmail ?? montrer('email')}
              etat={v.email && !erreurs1.email ? 'valide' : 'neutre'}
              aide="Elle servira d’identifiant de connexion."
            />
          </div>
          <div className="pt-2">
            <BoutonPrincipal envoi={false} style={cascade(7)}>
              Continuer <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </BoutonPrincipal>
          </div>
        </form>
      ) : (
        <form key="securite" onSubmit={soumettre} className="space-y-4" noValidate>
          <p className="flex items-center gap-2 rounded-2xl bg-white/[.04] px-4 py-2.5 text-[12.5px] text-white/65 animate-montee" style={cascade(0)}>
            <UserRound className="size-4 text-[#67e8f9]" />
            <span className="min-w-0 truncate">
              <span className="font-semibold text-white">{nomComplet}</span> · {v.email.trim()}
            </span>
          </p>
          <div className="animate-montee" style={cascade(1)}>
            <Saisie
              libelle="Mot de passe"
              icone={<KeyRound className="size-4" />}
              type={voir ? 'text' : 'password'}
              placeholder="Choisissez un mot de passe"
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
              libelle="Confirmation du mot de passe"
              icone={<Lock className="size-4" />}
              type={voir ? 'text' : 'password'}
              placeholder="Saisissez-le à nouveau"
              value={v.confirmation}
              onChange={maj('confirmation')}
              onBlur={toucher('confirmation')}
              autoComplete="new-password"
              etat={correspond ? 'valide' : 'neutre'}
              erreur={(touches.confirmation || v.confirmation.length >= v.mdp.length) && v.confirmation && !correspond ? 'Les deux mots de passe ne correspondent pas' : null}
              aide={correspond ? 'Les mots de passe correspondent.' : undefined}
            />
          </div>
          {erreur && <ErreurServeur message={erreur} />}
          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={() => setEtape(1)} className="flex h-12 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-5 text-[13px] font-semibold text-white/80 transition-colors hover:border-white/30 hover:bg-white/5 animate-montee" style={cascade(3)}>
              <ArrowLeft className="size-4" /> Retour
            </button>
            <BoutonPrincipal envoi={envoi} disabled={!mdpOk || !correspond} style={cascade(3)}>
              {premier ? 'Créer l’administrateur' : 'Créer le compte'}
            </BoutonPrincipal>
          </div>
          <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-white/40">
            <ShieldCheck className="size-3.5" /> Mot de passe chiffré (bcrypt), jamais conservé en clair.
          </p>
        </form>
      )}
    </div>
  );
}

// ─────────────────────────────── Page ───────────────────────────────

export function PageConnexion() {
  const etat = useQuery({ queryKey: ['etat'], queryFn: () => api<{ premierDemarrage: boolean; inscriptionOuverte: boolean }>('/auth/etat') });
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const nav = useNavigate();
  const qc = useQueryClient();
  const premier = !!etat.data?.premierDemarrage;
  const inscription = mode === 'inscription' || premier;
  const peutBasculer = !premier && !!etat.data?.inscriptionOuverte;
  const basculer = () => setMode(inscription ? 'connexion' : 'inscription');
  const terminer = async () => {
    await qc.invalidateQueries({ queryKey: ['session'] });
    nav('/');
  };

  const titre = premier ? 'Compte administrateur' : inscription ? 'Créer votre compte' : 'Connexion';
  const sousTitre = premier ? 'Premier démarrage : ce compte administrera l’application.' : inscription ? 'Deux étapes, moins d’une minute.' : 'Accédez à vos moteurs de calcul.';

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
            <LogoVision className="size-10 ring-1 ring-white/15" />
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold uppercase tracking-[.14em]">Comptapilot</p>
              <p className="text-[11px] tracking-wide text-white/55">par {MARQUE.societe}</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden items-center gap-6 text-[11px] font-semibold uppercase tracking-[.16em] text-white/55 md:flex" aria-label="Chiffres clés">
              <span>163 formules</span>
              <span>13 moteurs</span>
              <span>Barèmes datés</span>
            </nav>
            {peutBasculer && (
              <button
                type="button"
                onClick={basculer}
                className="rounded-full bg-gradient-to-r from-[#22d3ee] to-[#3b82f6] px-5 py-2 text-[11.5px] font-bold uppercase tracking-[.12em] text-white shadow-[0_8px_24px_-8px_rgb(34_211_238/.7)] transition-transform hover:scale-[1.04] active:scale-95"
              >
                {inscription ? 'Se connecter' : 'S’inscrire'}
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
              {EXEMPLES.map(([t, e, v], i) => (
                <div key={t} className="w-60 rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 shadow-[0_10px_30px_-12px_rgb(0_0_0/.5)] backdrop-blur-md animate-flottement" style={{ animationDelay: `${-i * 3}s` }}>
                  <p className="flex items-center justify-between gap-2 text-[11px] text-white/60">
                    {t}
                    <span className="size-1.5 rounded-full bg-[#34d399] shadow-[0_0_8px_#34d399]" />
                  </p>
                  <p className="mt-0.5 text-xl font-semibold montant">{v}</p>
                  <p className="text-[11px] text-white/40 chiffre">{e}</p>
                </div>
              ))}
            </div>

            <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 lg:bottom-14 lg:left-12">
              <h1 key={inscription ? 'i' : 'c'} className="text-5xl font-bold animate-montee sm:text-6xl lg:text-7xl" style={{ animationDelay: '250ms' }}>
                {inscription ? 'Bienvenue' : 'Bon retour'}
                <span className="text-[#ff4fd8]">.</span>
              </h1>
              <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/70 animate-montee sm:text-[15px]" style={{ animationDelay: '380ms' }}>
                Le comptable ne calcule plus : il vérifie et il valide. Chaque résultat affiche sa formule, ses étapes et sa référence légale.
              </p>
              {peutBasculer && (
                <p className="mt-4 hidden text-[13px] text-white/60 animate-montee lg:block" style={{ animationDelay: '480ms' }}>
                  {inscription ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
                  <button type="button" onClick={basculer} className="font-semibold text-white underline decoration-[#ff4fd8] decoration-2 underline-offset-4 hover:text-[#ffb3ef]">
                    {inscription ? 'Se connecter' : 'Créer un compte'}
                  </button>
                </p>
              )}
            </div>
          </section>

          <div className="order-2 hidden bg-gradient-to-b from-transparent via-white/15 to-transparent lg:block" />

          {/* Formulaires */}
          <div key={inscription ? 'inscription' : 'connexion'} className="order-3 flex flex-col justify-center px-6 py-10 sm:px-12 lg:order-1 lg:py-12">
            <div className={cn('relative mx-auto grid place-items-center animate-montee', inscription ? 'mb-4 size-16' : 'mb-6 size-20')} style={cascade(0)}>
              <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#22d3ee,#7c3aed,#ff3cac,#22d3ee)] p-[2px] animate-rotation-lente">
                <div className="size-full rounded-full bg-[#1a1540]" />
              </div>
              <div className="absolute inset-2 rounded-full bg-[#7c3aed]/25 blur-md animate-halo" />
              {premier ? <ShieldCheck className={cn('relative text-[#67e8f9]', inscription ? 'size-7' : 'size-9')} strokeWidth={1.6} /> : <UserRound className={cn('relative text-[#67e8f9]', inscription ? 'size-7' : 'size-9')} strokeWidth={1.6} />}
            </div>

            <h2 className="text-center text-[26px] font-semibold animate-montee" style={cascade(1)}>
              {titre}
            </h2>
            <p className={cn('mt-1.5 text-center text-[13.5px] text-white/60 animate-montee', inscription ? 'mb-6' : 'mb-7')} style={cascade(2)}>
              {sousTitre}
            </p>

            {inscription ? <FormulaireInscription terminer={terminer} premier={premier} /> : <FormulaireConnexion terminer={terminer} />}

            {peutBasculer && (
              <p className="mt-6 text-center text-[13px] text-white/55 lg:hidden">
                {inscription ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
                <button type="button" onClick={basculer} className="font-semibold text-[#f0abfc] hover:underline">
                  {inscription ? 'Se connecter' : 'Créer un compte'}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="relative mt-6 text-[12px] text-white/70">
        © {new Date().getFullYear()} {MARQUE.societe} · Tous droits réservés
      </p>
    </div>
  );
}
