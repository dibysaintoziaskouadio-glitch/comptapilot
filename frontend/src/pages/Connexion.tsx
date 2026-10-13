import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Lock, Mail, User } from 'lucide-react';
import { api, ErreurApi } from '@/lib/api';
import { Bouton, Champ } from '@/components/ui';

const ATOUTS = [
  '163 formules comptables, fiscales et sociales',
  'Chaque résultat affiche sa formule, ses étapes et sa référence légale',
  'Barèmes versionnés appliqués selon la date de l’opération',
  'Arithmétique décimale exacte — jamais de nombre flottant',
];

export function PageConnexion() {
  const etat = useQuery({ queryKey: ['etat'], queryFn: () => api<{ premierDemarrage: boolean; inscriptionOuverte: boolean }>('/auth/etat') });
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [f, setF] = useState({ email: '', nom: '', motDePasse: '' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const inscription = mode === 'inscription' || etat.data?.premierDemarrage;

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

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden degrade-accent p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 top-1/3 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 17l5-6 4 3 7-9" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight">Comptapilot</span>
        </div>
        <div className="relative max-w-xl">
          <h1 className="text-[44px] font-bold leading-[1.05] tracking-tight">Le comptable ne calcule plus. Il vérifie et il valide.</h1>
          <p className="mt-5 text-lg text-white/80">Saisissez un chiffre : tous les calculs dérivés, les contrôles de cohérence et les écritures se mettent à jour instantanément.</p>
          <ul className="mt-8 space-y-3">
            {ATOUTS.map((a) => (
              <li key={a} className="flex items-center gap-3 text-[15px]">
                <CheckCircle2 className="size-5 shrink-0 text-white/90" /> {a}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative grid max-w-lg grid-cols-3 gap-3">
          {[
            ['TVA à 20 %', '1 000,00 €', '200,00 €'],
            ['Annuité 5 ans 4 %', '100 000 €', '1 841,65 €'],
            ['Seuil de rentabilité', 'Taux MCV 40 %', '825 000 €'],
          ].map(([t, e, s]) => (
            <div key={t} className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
              <p className="text-[11px] text-white/70">{t}</p>
              <p className="mt-1 text-[12px] text-white/80">{e}</p>
              <p className="mt-0.5 font-semibold chiffre">{s}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center p-6 fond-grille">
        <form onSubmit={soumettre} className="carte w-full max-w-md p-8 shadow-flottant animate-apparition">
          <h2 className="text-2xl font-bold tracking-tight">{etat.data?.premierDemarrage ? 'Créer le compte administrateur' : inscription ? 'Créer un compte' : 'Bon retour'}</h2>
          <p className="mt-1.5 text-sm text-attenue">{etat.data?.premierDemarrage ? 'Premier démarrage : ce compte administrera l’application.' : inscription ? 'Quelques secondes suffisent.' : 'Connectez-vous pour accéder aux moteurs de calcul.'}</p>
          <div className="mt-7 space-y-4">
            {inscription && (
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium"><User className="size-3.5" /> Nom</span>
                <Champ value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} autoComplete="name" required />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium"><Mail className="size-3.5" /> Adresse e-mail</span>
              <Champ type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" required />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium"><Lock className="size-3.5" /> Mot de passe</span>
              <Champ type="password" value={f.motDePasse} onChange={(e) => setF({ ...f, motDePasse: e.target.value })} autoComplete={inscription ? 'new-password' : 'current-password'} minLength={inscription ? 10 : undefined} required />
              {inscription && <span className="mt-1 block text-[11.5px] text-attenue">10 caractères minimum.</span>}
            </label>
          </div>
          {erreur && <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-[13px] text-danger">{erreur}</p>}
          <Bouton variante="primaire" type="submit" chargement={envoi} className="mt-6 h-11 w-full">
            {inscription ? 'Créer le compte' : 'Se connecter'} <ArrowRight className="size-4" />
          </Bouton>
          {!etat.data?.premierDemarrage && etat.data?.inscriptionOuverte && (
            <p className="mt-5 text-center text-[13px] text-attenue">
              {inscription ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
              <button type="button" className="font-semibold text-accent-texte hover:underline" onClick={() => setMode(inscription ? 'connexion' : 'inscription')}>
                {inscription ? 'Se connecter' : 'Créer un compte'}
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
