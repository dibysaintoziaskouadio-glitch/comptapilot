/**
 * Écran de connexion et d'inscription.
 * Toujours sombre, quel que soit le thème choisi : carte indigo sur un fond violet-magenta animé,
 * formulaire à gauche, ruban lumineux et message d'accueil à droite.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, User, UserRound } from 'lucide-react';
import { api, ErreurApi } from '@/lib/api';
import { LogoVision, MARQUE } from '@/components/Marque';
import { OndeFluide } from '@/components/OndeFluide';
import { cn } from '@/lib/utils';

const EXEMPLES: [string, string, string][] = [
  ['TVA à 20 %', 'HT 1 000 €', '200,00 €'],
  ['Annuité d’emprunt', '100 000 € · 5 ans · 4 %', '1 841,65 €'],
]; 

/** Délai d'apparition en cascade des éléments du formulaire. */
const cascade = (i: number) => ({ animationDelay: `${120 + i * 70}ms` });

function Saisie({ icone, droite, className, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { icone: React.ReactNode; droite?: React.ReactNode }) {
  return (
    <div className={cn('group relative', className)}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45 transition-colors group-focus-within:text-[#c084fc]">{icone}</span>
      <input
        {...p}
        className="h-12 w-full rounded-full border border-white/15 bg-white/[.06] pl-11 pr-11 text-[14px] text-white placeholder:text-white/40 transition-all hover:border-white/25 focus:border-[#a855f7] focus:bg-white/[.09] focus:shadow-[0_0_0_4px_rgb(168_85_247/.22),0_0_24px_-4px_rgb(217_70_239/.55)] focus:outline-none"
      />
      {droite && <span className="absolute right-2 top-1/2 -translate-y-1/2">{droite}</span>}
    </div>
  );
}

export function PageConnexion() {
  const etat = useQuery({ queryKey: ['etat'], queryFn: () => api<{ premierDemarrage: boolean; inscriptionOuverte: boolean }>('/auth/etat') });
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [f, setF] = useState({ email: '', nom: '', motDePasse: '' });
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const premier = !!etat.data?.premierDemarrage;
  const inscription = mode === 'inscription' || premier;
  const peutBasculer = !premier && !!etat.data?.inscriptionOuverte;
  const basculer = () => {
    setErreur(null);
    setMode(inscription ? 'connexion' : 'inscription');
  };

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await api(inscription ? '/auth/inscription' : '/auth/connexion', { method: 'POST', json: inscription ? f : { email: f.email, motDePasse: f.motDePasse } });
      await qc.invalidateQueries({ queryKey: ['session'] });
      nav('/');
    } catch (x) {
      setErreur(x instanceof ErreurApi ? (x.details?.[0]?.message ?? x.message) : 'Serveur injoignable');
    } finally {
      setEnvoi(false);
    }
  };

  const titre = premier ? 'Compte administrateur' : inscription ? 'Créer un compte' : 'Connexion';
  const sousTitre = premier ? 'Premier démarrage : ce compte administrera l’application.' : inscription ? 'Quelques secondes suffisent.' : 'Accédez à vos moteurs de calcul.';

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
              <p className="text-[15px] font-extrabold uppercase tracking-[.14em]">Comptapilot</p>
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

        <div className="grid lg:grid-cols-[minmax(0,430px)_1px_minmax(0,1fr)]">
          {/* Panneau visuel (en tête sur mobile, à droite sur grand écran) */}
          <section className="relative order-1 h-56 overflow-hidden sm:h-72 lg:order-3 lg:h-auto lg:min-h-[580px]">
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
                  <p className="mt-0.5 text-xl font-bold chiffre">{v}</p>
                  <p className="text-[11px] text-white/40 chiffre">{e}</p>
                </div>
              ))}
            </div>

            <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 lg:bottom-14 lg:left-12">
              <h1 className="text-5xl font-extrabold tracking-tight animate-montee sm:text-6xl lg:text-7xl" style={{ animationDelay: '250ms' }}>
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

          {/* Formulaire */}
          <form key={inscription ? 'inscription' : 'connexion'} onSubmit={soumettre} className="order-3 flex flex-col justify-center px-6 py-10 sm:px-12 lg:order-1 lg:py-14">
            <div className="relative mx-auto mb-7 grid size-24 place-items-center animate-montee" style={cascade(0)}>
              <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#22d3ee,#7c3aed,#ff3cac,#22d3ee)] p-[2px] animate-rotation-lente">
                <div className="size-full rounded-full bg-[#1a1540]" />
              </div>
              <div className="absolute inset-2 rounded-full bg-[#7c3aed]/25 blur-md animate-halo" />
              {premier ? <ShieldCheck className="relative size-10 text-[#67e8f9]" strokeWidth={1.6} /> : <UserRound className="relative size-10 text-[#67e8f9]" strokeWidth={1.6} />}
            </div>

            <h2 className="text-center text-2xl font-bold tracking-tight animate-montee" style={cascade(1)}>
              {titre}
            </h2>
            <p className="mt-1.5 text-center text-[13.5px] text-white/60 animate-montee" style={cascade(2)}>
              {sousTitre}
            </p>

            <div className="mt-8 space-y-3.5">
              {inscription && (
                <div className="animate-montee" style={cascade(3)}>
                  <Saisie icone={<User className="size-4" />} aria-label="Nom" placeholder="Nom complet" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} autoComplete="name" required />
                </div>
              )}
              <div className="animate-montee" style={cascade(4)}>
                <Saisie icone={<Mail className="size-4" />} aria-label="Adresse e-mail" placeholder="Adresse e-mail" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" required />
              </div>
              <div className="animate-montee" style={cascade(5)}>
                <Saisie
                  icone={<Lock className="size-4" />}
                  aria-label="Mot de passe"
                  placeholder="Mot de passe"
                  type={voir ? 'text' : 'password'}
                  value={f.motDePasse}
                  onChange={(e) => setF({ ...f, motDePasse: e.target.value })}
                  autoComplete={inscription ? 'new-password' : 'current-password'}
                  minLength={inscription ? 10 : undefined}
                  required
                  droite={
                    <button type="button" onClick={() => setVoir((v) => !v)} className="grid size-8 place-items-center rounded-full text-white/45 hover:bg-white/10 hover:text-white" aria-label={voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                      {voir ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                />
                {inscription && <p className="mt-1.5 pl-5 text-[11.5px] text-white/45">10 caractères minimum.</p>}
              </div>
            </div>

            {erreur && (
              <p role="alert" className="mt-4 rounded-2xl border border-[#ff4f7b]/30 bg-[#ff4f7b]/10 px-4 py-2.5 text-[13px] text-[#ffb3c4] animate-montee">
                {erreur}
              </p>
            )}

            <button
              type="submit"
              disabled={envoi}
              className="group relative mt-7 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-full degrade-bouton text-[13px] font-bold uppercase tracking-[.16em] shadow-[0_14px_36px_-10px_rgb(236_72_153/.75)] transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 animate-montee"
              style={cascade(6)}
            >
              <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25 blur-sm transition-transform duration-700 group-hover:translate-x-[420%]" />
              {envoi ? <Loader2 className="size-4 animate-spin" /> : null}
              {inscription ? 'Créer le compte' : 'Se connecter'}
              {!envoi && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}
            </button>

            {peutBasculer && (
              <p className="mt-6 text-center text-[13px] text-white/55 animate-montee lg:hidden" style={cascade(7)}>
                {inscription ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
                <button type="button" onClick={basculer} className="font-semibold text-[#f0abfc] hover:underline">
                  {inscription ? 'Se connecter' : 'Créer un compte'}
                </button>
              </p>
            )}
          </form>
        </div>
      </div>

      <p className="relative mt-6 text-[12px] text-white/70">
        © {new Date().getFullYear()} {MARQUE.societe} · Tous droits réservés
      </p>
    </div>
  );
}
