import { motion } from 'framer-motion'
import { getGreeting, getFormattedDate } from '../utils/greetings'

interface GreetingProps {
  name?: string | null
  spacesCount: number
}

export function Greeting({ name, spacesCount }: GreetingProps) {
  const greeting = getGreeting(name)
  const date = getFormattedDate()

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mb-8"
    >
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1
          className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight"
          style={{ fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif' }}
        >
          {greeting}
        </h1>
        <span className="text-sm text-slate-500 font-medium">{date}</span>
      </div>
      <p className="text-base text-slate-600 mt-2 font-light">
        {spacesCount === 0 && 'Aún no tienes espacios. Empecemos por crear el primero.'}
        {spacesCount === 1 && 'Tienes 1 espacio para organizar tu trabajo.'}
        {spacesCount > 1 && `Tienes ${spacesCount} espacios para organizar tu trabajo.`}
      </p>
    </motion.div>
  )
}
