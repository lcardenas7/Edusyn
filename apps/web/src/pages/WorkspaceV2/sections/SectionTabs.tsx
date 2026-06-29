import { motion } from 'framer-motion'
import { BookOpen, Eye, Coins, UserCog, FolderOpen, type LucideIcon } from 'lucide-react'

export type SectionKey = 'log' | 'observations' | 'collection' | 'roles' | 'resources'

interface TabDef {
  key: SectionKey
  label: string
  icon: LucideIcon
  shortLabel?: string
}

export const SECTION_TABS: TabDef[] = [
  { key: 'log',          label: 'Bitácora',      icon: BookOpen,    shortLabel: 'Bitácora' },
  { key: 'observations', label: 'Observaciones', icon: Eye,         shortLabel: 'Obs.' },
  { key: 'collection',   label: 'Recaudo',       icon: Coins,       shortLabel: 'Recaudo' },
  { key: 'roles',        label: 'Roles',         icon: UserCog,     shortLabel: 'Roles' },
  { key: 'resources',    label: 'Recursos',      icon: FolderOpen,  shortLabel: 'Recursos' },
]

interface SectionTabsProps {
  active: SectionKey
  onChange: (key: SectionKey) => void
  counts?: Partial<Record<SectionKey, number>>
}

export function SectionTabs({ active, onChange, counts }: SectionTabsProps) {
  return (
    <div className="relative border-b border-slate-200 mb-6">
      <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
        {SECTION_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.key
          const count = counts?.[tab.key]
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition whitespace-nowrap ${
                isActive
                  ? 'text-violet-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              aria-pressed={isActive}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              {typeof count === 'number' && count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
              {isActive && (
                <motion.span
                  layoutId="section-tab-indicator"
                  className="absolute left-0 right-0 -bottom-px h-0.5 bg-violet-600"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
