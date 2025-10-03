
import { motion } from 'framer-motion'
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  size?: number
}

export function Logo({ className, size = 32 }: LogoProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="px-2">
          <div className={cn('relative inline-flex items-center justify-center', className)}>
            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 rounded-lg bg-primary/20 blur-lg"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            
            {/* Nyx Spider Logo - Using the same design as favicon.svg */}
            <motion.svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="relative"
              initial={{ rotate: 0 }}
              whileHover={{ rotate: 180, scale: 1.1 }}
              transition={{ duration: 0.3 }}
            >
              <style>
                {`
                  path, circle { 
                    stroke: hsl(var(--primary)); 
                    fill: none; 
                    stroke-width: 1.5;
                  }
                  circle.eye { 
                    fill: hsl(var(--primary)); 
                  }
                `}
              </style>
              
              {/* Main body - hexagon */}
              <path d="M12 4L18 8V16L12 20L6 16V8L12 4Z"/>
              
              {/* Spider legs */}
              <g>
                {/* Left legs */}
                <path d="M6 12L3 9"/>
                <path d="M6 12L2 12"/>
                <path d="M6 12L3 15"/>
                
                {/* Right legs */}
                <path d="M18 12L21 9"/>
                <path d="M18 12L22 12"/>
                <path d="M18 12L21 15"/>
              </g>
              
              {/* Eyes */}
              <circle cx="10" cy="12" r="1" className="eye"/>
              <circle cx="14" cy="12" r="1" className="eye"/>
            </motion.svg>
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}