import {
  BarChart3,
  Calculator,
  Droplets,
  Factory,
  Globe,
  Landmark,
  LineChart,
  Package,
  Receipt,
  Shield,
  Target,
  TrendingDown,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface Apparence {
  icone: LucideIcon;
  teinte: number; // teinte HSL
}

export const APPARENCE: Record<string, Apparence> = {
  base: { icone: Calculator, teinte: 220 },
  tva: { icone: Receipt, teinte: 243 },
  amortissements: { icone: TrendingDown, teinte: 271 },
  provisions: { icone: Shield, teinte: 300 },
  paie: { icone: Users, teinte: 330 },
  fiscal: { icone: Landmark, teinte: 352 },
  financier: { icone: BarChart3, teinte: 18 },
  tresorerie: { icone: Droplets, teinte: 195 },
  analytique: { icone: Target, teinte: 38 },
  investissement: { icone: LineChart, teinte: 152 },
  stocks: { icone: Package, teinte: 170 },
  consolidation: { icone: Globe, teinte: 210 },
  sectoriels: { icone: Factory, teinte: 260 },
};

export const apparence = (code: string): Apparence => APPARENCE[code] ?? { icone: Calculator, teinte: 243 };

/** Styles inline dérivés de la teinte du moteur (fond doux + texte contrasté, clair/sombre). */
export const pastille = (teinte: number) => ({
  background: `hsl(${teinte} 85% 60% / 0.13)`,
  color: `hsl(${teinte} 70% var(--pastille-l, 45%))`,
});
