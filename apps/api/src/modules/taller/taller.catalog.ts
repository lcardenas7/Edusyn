// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — Biblioteca de Instrumentos (registro declarativo).
// Un instrumento = Motor + Dinámica + configuración. Añadir uno disponible es
// AÑADIR UNA ENTRADA AQUÍ (y su renderer en el front), no programar un módulo.
// Fuente de diseño: docs/BIBLIOTECA_INSTRUMENTOS.md (catálogo por intención).
// ═══════════════════════════════════════════════════════════════════════════

export interface TallerInstrumentDef {
  key: string;          // MOTOR:DINAMICA — identidad estable del instrumento
  motor: string;
  dynamic: string;
  name: string;
  emoji: string;
  intent: string;       // agrupador de la biblioteca (por tipo de pensamiento)
  description: string;  // qué provoca en los estudiantes (para el docente)
  available: boolean;   // false = visible en la biblioteca como "próximamente"
}

export const INSTRUMENT_INTENTS = [
  { id: 'GENERAR', name: '🧠 Generar ideas' },
  { id: 'INVESTIGAR', name: '🔍 Investigar' },
  { id: 'ANALIZAR', name: '📊 Analizar' },
  { id: 'DECIDIR', name: '🎯 Decidir' },
  { id: 'PLANIFICAR', name: '🏗️ Planificar' },
  { id: 'COMUNICAR', name: '📢 Comunicar' },
] as const;

export const INSTRUMENT_CATALOG: TallerInstrumentDef[] = [
  // ── 🧠 Generar ideas ──
  { key: 'BOARD:BRAINSTORM', motor: 'BOARD', dynamic: 'BRAINSTORM', name: 'Muro de ideas (Brainstorm)', emoji: '💡', intent: 'GENERAR', available: true,
    description: 'Post-its libres en un muro: escribir, arrastrar, votar y conversar. Ideal para abrir la exploración sin filtro.' },
  { key: 'GRAPH:ARBOL_IDEAS', motor: 'GRAPH', dynamic: 'ARBOL_IDEAS', name: 'Árbol de ideas', emoji: '🌳', intent: 'GENERAR', available: true,
    description: 'Las ideas se cuelgan de ramas y se ramifican unas de otras: el equipo VE cómo su pensamiento crece y se conecta.' },
  { key: 'BOARD:CRAZY8', motor: 'BOARD', dynamic: 'CRAZY8', name: 'Crazy 8', emoji: '⚡', intent: 'GENERAR', available: true,
    description: '8 ideas en 8 minutos: velocidad sobre perfección para romper el bloqueo creativo.' },
  { key: 'BOARD:SCAMPER', motor: 'BOARD', dynamic: 'SCAMPER', name: 'SCAMPER', emoji: '🧩', intent: 'GENERAR', available: true,
    description: 'Transformar ideas existentes: Sustituir, Combinar, Adaptar, Modificar, otros usos, Eliminar, Reordenar.' },
  // ── 🔍 Investigar ──
  { key: 'GRAPH:MAPA_ACTORES', motor: 'GRAPH', dynamic: 'MAPA_ACTORES', name: 'Mapa de actores', emoji: '🗺️', intent: 'INVESTIGAR', available: false,
    description: '¿Quiénes están involucrados en el problema y cómo se relacionan entre sí?' },
  { key: 'MEDIA:GALERIA', motor: 'MEDIA', dynamic: 'GALERIA', name: 'Galería de evidencias', emoji: '📷', intent: 'INVESTIGAR', available: false,
    description: 'Fotos, videos y hallazgos del terreno, con autor y fecha.' },
  { key: 'CARDS:REFERENCIAS', motor: 'CARDS', dynamic: 'REFERENCIAS', name: 'Gestor de referencias', emoji: '📑', intent: 'INVESTIGAR', available: false,
    description: 'Fuentes reales con autor, año y cita — para leer e investigar de verdad, no solo pedirle a la IA.' },
  // ── 📊 Analizar ──
  { key: 'GRAPH:ARBOL_PROBLEMAS', motor: 'GRAPH', dynamic: 'ARBOL_PROBLEMAS', name: 'Árbol de problemas', emoji: '🌲', intent: 'ANALIZAR', available: true,
    description: 'El problema central como tronco: las causas se cuelgan y se ramifican hasta llegar a las raíces de fondo.' },
  { key: 'GRAPH:CINCO_PORQUES', motor: 'GRAPH', dynamic: 'CINCO_PORQUES', name: '5 Porqués', emoji: '❓', intent: 'ANALIZAR', available: false,
    description: 'Preguntar "¿por qué?" en cadena hasta encontrar la causa raíz.' },
  { key: 'MATRIX:IMPACTO_ESFUERZO', motor: 'MATRIX', dynamic: 'IMPACTO_ESFUERZO', name: 'Matriz impacto / esfuerzo', emoji: '📈', intent: 'ANALIZAR', available: false,
    description: 'Ubicar cada idea según cuánto cambia el problema y cuánto cuesta hacerla.' },
  // ── 🎯 Decidir ──
  { key: 'POLL:VOTACION', motor: 'POLL', dynamic: 'VOTACION', name: 'Votación', emoji: '🗳️', intent: 'DECIDIR', available: false,
    description: 'Elegir entre opciones con votos simples, ponderados o por ranking.' },
  { key: 'CARDS:PROS_CONTRAS', motor: 'CARDS', dynamic: 'PROS_CONTRAS', name: 'Pros y contras', emoji: '⚖️', intent: 'DECIDIR', available: false,
    description: 'Dos columnas para pesar una decisión antes de tomarla.' },
  // ── 🏗️ Planificar ──
  { key: 'FLOW:KANBAN', motor: 'FLOW', dynamic: 'KANBAN', name: 'Kanban', emoji: '📋', intent: 'PLANIFICAR', available: false,
    description: 'Por hacer → haciendo → hecho: el plan de acción visible para todos.' },
  { key: 'TIMELINE:LINEA_TIEMPO', motor: 'TIMELINE', dynamic: 'LINEA_TIEMPO', name: 'Línea de tiempo', emoji: '📅', intent: 'PLANIFICAR', available: true,
    description: 'El equipo construye la cronología del proyecto: hechos, hallazgos y entregas ordenados en el tiempo.' },
  // ── 📢 Comunicar ──
  { key: 'DOC:INFORME', motor: 'DOC', dynamic: 'INFORME', name: 'Informe colaborativo', emoji: '📝', intent: 'COMUNICAR', available: false,
    description: 'Redactar juntos el documento final del proyecto.' },
];

export const instrumentByKey = (key: string) => INSTRUMENT_CATALOG.find(i => i.key === key);
