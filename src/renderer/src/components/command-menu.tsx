import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { IconArrowRightDashed, IconSun, IconMoon, IconDeviceLaptop } from '@tabler/icons-react'
import { useTheme } from '@/provider/theme-context'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './ui/command'
import { ScrollArea } from './ui/scroll-area'
import { getSidebarData } from './layout/data/sidebar-data'
import type { NavGroup, NavItem, SidebarData } from './layout/types'
import { useAuthStore } from '@/lib/auth'

export function CommandMenu({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const { theme, setTheme } = useTheme()
  const sidebarData: SidebarData = getSidebarData(user)

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='Type a command or search...' />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pr-1'>
          <CommandEmpty>No results found.</CommandEmpty>
          {sidebarData.navGroups.map((group: NavGroup) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((navItem: NavItem, i: number) => {
                if (navItem.url)
                  return (
                    <CommandItem
                      key={`${navItem.url}-${i}`}
                      value={navItem.title}
                      onSelect={() => {
                        runCommand(() => navigate({ to: navItem.url }))
                      }}
                    >
                      <div className='mr-2 flex h-4 w-4 items-center justify-center'>
                        <IconArrowRightDashed className='size-2 text-muted-foreground/80' />
                      </div>
                      {navItem.title}
                    </CommandItem>
                  )

                return navItem.items?.map((subItem: NavItem, i: number) => (
                  <CommandItem
                    key={`${subItem.url}-${i}`}
                    value={subItem.title}
                    onSelect={() => {
                      runCommand(() => navigate({ to: subItem.url }))
                    }}
                  >
                    <div className='mr-2 flex h-4 w-4 items-center justify-center'>
                      <IconArrowRightDashed className='size-2 text-muted-foreground/80' />
                    </div>
                    {subItem.title}
                  </CommandItem>
                ))
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading='Theme'>
            <div className="px-4 py-2">
              <div className="relative h-9 w-[294px] mx-auto rounded-full bg-secondary/50">
                <motion.div 
                  className="absolute inset-y-0.5 left-0.5 w-[95px] rounded-full bg-primary/20 backdrop-blur-sm"
                  animate={{
                    left: theme === 'light' ? '0.125rem' : theme === 'dark' ? '100px' : '198px',
                  }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 30,
                  }}
                />
                <div className="relative flex h-full">
                  <button
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 transition-colors duration-200",
                      theme === 'light' ? "text-primary" : "text-muted-foreground"
                    )}
                    onClick={() => setTheme('light')}
                  >
                    <IconSun size={15} 
                      className={cn(
                        "transition-transform duration-200",
                        theme === 'light' && "rotate-0 scale-110",
                        theme !== 'light' && "rotate-90 scale-90"
                      )}
                    />
                    <span className="text-sm font-medium">Light</span>
                  </button>
                  <button
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 transition-colors duration-200",
                      theme === 'dark' ? "text-primary" : "text-muted-foreground"
                    )}
                    onClick={() => setTheme('dark')}
                  >
                    <IconMoon size={15} 
                      className={cn(
                        "transition-transform duration-200",
                        theme === 'dark' && "rotate-0 scale-110",
                        theme !== 'dark' && "rotate-90 scale-90"
                      )}
                    />
                    <span className="text-sm font-medium">Dark</span>
                  </button>
                  <button
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 transition-colors duration-200",
                      theme === 'black' ? "text-primary" : "text-muted-foreground"
                    )}
                    onClick={() => setTheme('black')}
                  >
                    <span className="text-xs font-bold">BK</span>
                    <span className="text-sm font-medium">Black</span>
                  </button>
                </div>
              </div>
            </div>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
