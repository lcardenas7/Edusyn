/**
 * El acento efectivo del aula, disponible para cualquier vista de dentro.
 *
 * Hace falta porque el color puede venir de dos sitios: el que eligió el docente para el aula
 * y el que eligió el estudiante para su vista. Sin un punto único, la mitad de la pantalla se
 * repintaba y la otra mitad no — pasó de verdad: el riel y los botones quedaron azules y las
 * carátulas de las unidades siguieron rosadas.
 */

import { createContext, useContext, type ReactNode } from 'react'

const Ctx = createContext<string | null>(null)

export function ProveedorAcento({ acento, children }: { acento: string; children: ReactNode }) {
  return <Ctx.Provider value={acento}>{children}</Ctx.Provider>
}

/** El acento del aula. Fuera del aula (p. ej. el selector) cae al color que le pasen. */
export function useAcento(porDefecto?: string | null): string | null {
  return useContext(Ctx) ?? porDefecto ?? null
}
