import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark';
export const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: 'light',
  setTheme: () => undefined,
});
export const useTheme = () => useContext(ThemeContext);
