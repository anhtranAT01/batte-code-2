import { useCallback, useEffect, useState } from 'react';

function initialTheme() {
  const saved = localStorage.getItem('battlecode-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark';
}

export default function useTheme() {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('battlecode-theme', theme);
  }, [theme]);
  const toggleTheme=useCallback(()=>setTheme(value=>value==='dark'?'light':'dark'),[]);
  return { theme, toggleTheme };
}
