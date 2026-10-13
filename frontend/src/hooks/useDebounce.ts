import { useEffect, useState } from 'react';

export function useDebounce<T>(valeur: T, delai = 250): T {
  const [v, setV] = useState(valeur);
  useEffect(() => {
    const t = setTimeout(() => setV(valeur), delai);
    return () => clearTimeout(t);
  }, [valeur, delai]);
  return v;
}
