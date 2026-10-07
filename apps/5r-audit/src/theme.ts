export type Theme = 'light' | 'dark'

export type ThemeProps = {
  theme: Theme
  onToggleTheme: () => void
}

export function rootClassName(theme: Theme) {
  return theme === 'light' ? 'lp-root lp-light' : 'lp-root'
}
