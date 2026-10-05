import { createContext, useContext } from 'react';

export const TNThemeContext = createContext('light');
export function useTNTheme(override) {
  const inherited = useContext(TNThemeContext);
  return override ?? inherited;
}
