import { useEffect } from 'react'
import { IconMoon, IconSun } from '@tabler/icons-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/provider/theme-context'

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme()

  /* Update theme-color meta tag
   * when theme is updated */
  useEffect(() => {
    let themeColor = '#fff';
    if (theme === 'dark') {
      themeColor = '#020817';
    } else if (theme === 'black') {
      themeColor = '#000000';
    }
    const metaThemeColor = document.querySelector("meta[name='theme-color']")
    if (metaThemeColor) metaThemeColor.setAttribute('content', themeColor)
  }, [theme])

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('black');  // Switch to black/dark theme
    } else {
      setTheme('light');  // Switch back to light theme
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'relative h-8 w-14 rounded-full bg-secondary/50',  // Reduced width for 2-state switch
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
      )}
    >
      <motion.div 
        className="absolute inset-y-1 left-1 h-6 w-6 rounded-full bg-primary"
        animate={{
          left: theme === 'light' ? '0.25rem' : '1.25rem',  // Animate between two positions only
        }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 30,
        }}
      />
      <div className="relative flex h-full">
        <div className="flex h-full flex-1 items-center justify-center">
          <IconSun 
            size={14} 
            className={cn(
              "transition-all duration-200",
              theme === 'light' ? "opacity-100 text-primary" : "opacity-40 text-muted-foreground"
            )}
          />
        </div>
        <div className="flex h-full flex-1 items-center justify-center">
          <IconMoon 
            size={14} 
            className={cn(
              "transition-all duration-200",
              theme === 'black' ? "opacity-100 text-primary" : "opacity-40 text-muted-foreground"
            )}
          />
        </div>
      </div>
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
