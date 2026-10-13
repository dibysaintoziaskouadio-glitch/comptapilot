import { useCallback, useState } from 'react';

export function useTheme() {
  const [sombre, setSombre] = useState(() => document.documentElement.classList.contains('dark'));
  const basculer = useCallback(() => {
    const v = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', v);
    try {
      localStorage.setItem('theme', v ? 'dark' : 'light');
    } catch {
      /* stockage indisponible */
    }
    setSombre(v);
  }, []);
  return { sombre, basculer };
}
