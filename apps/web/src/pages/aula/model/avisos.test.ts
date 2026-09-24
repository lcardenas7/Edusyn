import { describe, it, expect } from 'vitest'
import { cuandoLlego, normalizarAvisos, sinLeer } from './avisos'

const AHORA = new Date('2026-09-23T15:00:00.000Z')

describe('avisos · lo que llega a la campana', () => {
  it('aplana la bandeja a algo que se pueda pintar', () => {
    const [a] = normalizarAvisos([
      {
        id: 'rec-1',
        readAt: null,
        message: {
          id: 'msg-1',
          subject: 'Matemáticas: Fracciones',
          content: 'Tarea nueva, sin fecha de entrega.',
          link: '/aula/aula-1/actividades/act-1',
          origin: 'actividad-publicada',
          sentAt: '2026-09-23T14:00:00.000Z',
        },
      },
    ])

    expect(a).toEqual({
      messageId: 'msg-1',
      titulo: 'Matemáticas: Fracciones',
      detalle: 'Tarea nueva, sin fecha de entrega.',
      enlace: '/aula/aula-1/actividades/act-1',
      deActividad: true,
      leido: false,
      fecha: '2026-09-23T14:00:00.000Z',
    })
  })

  it('una circular del colegio no es un aviso de actividad y no lleva a ninguna parte', () => {
    const [a] = normalizarAvisos([
      { id: 'r', readAt: '2026-09-23T10:00:00.000Z', message: { id: 'm', subject: 'Izada de bandera', content: 'Viernes' } },
    ])
    expect(a.deActividad).toBe(false)
    expect(a.enlace).toBeNull()
    expect(a.leido).toBe(true)
  })

  it('lo más reciente primero: la campana se mira por arriba', () => {
    const avisos = normalizarAvisos([
      { id: 'r1', message: { id: 'viejo', subject: 'Viejo', sentAt: '2026-09-01T10:00:00.000Z' } },
      { id: 'r2', message: { id: 'nuevo', subject: 'Nuevo', sentAt: '2026-09-23T10:00:00.000Z' } },
    ])
    expect(avisos.map((a) => a.messageId)).toEqual(['nuevo', 'viejo'])
  })

  it('una fila sin mensaje no rompe la lista', () => {
    expect(normalizarAvisos([{ id: 'r', message: null }, null as any])).toEqual([])
    expect(normalizarAvisos(undefined)).toEqual([])
  })

  it('un mensaje sin asunto sigue siendo legible', () => {
    expect(normalizarAvisos([{ id: 'r', message: { id: 'm', subject: '   ' } }])[0].titulo).toBe('Aviso')
  })

  it('cuenta los que faltan por leer, que es lo que se pinta en la burbuja', () => {
    const avisos = normalizarAvisos([
      { id: 'r1', readAt: null, message: { id: 'a', subject: 'A' } },
      { id: 'r2', readAt: '2026-09-23T10:00:00.000Z', message: { id: 'b', subject: 'B' } },
      { id: 'r3', readAt: null, message: { id: 'c', subject: 'C' } },
    ])
    expect(sinLeer(avisos)).toBe(2)
  })
})

describe('cuandoLlego', () => {
  const casos: Array<[string, string, string]> = [
    ['recién llegado', '2026-09-23T14:59:40.000Z', 'ahora'],
    ['minutos', '2026-09-23T14:35:00.000Z', 'hace 25 min'],
    ['horas', '2026-09-23T09:00:00.000Z', 'hace 6 h'],
    ['ayer', '2026-09-22T09:00:00.000Z', 'ayer'],
    ['esta semana', '2026-09-20T09:00:00.000Z', 'hace 3 días'],
  ]

  it.each(casos)('%s', (_, fecha, esperado) => {
    expect(cuandoLlego(fecha, AHORA)).toBe(esperado)
  })

  it('más de una semana: fecha, porque "hace 9 días" no le dice nada a nadie', () => {
    expect(cuandoLlego('2026-09-10T09:00:00.000Z', AHORA)).toMatch(/10 de sept/)
  })

  it('sin fecha o con una rota, no inventa', () => {
    expect(cuandoLlego(null, AHORA)).toBe('')
    expect(cuandoLlego('mañana por la tarde', AHORA)).toBe('')
  })
})
