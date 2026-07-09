/**
 * Seed del grafo de competencias CEFR (Paso 2). Idempotente (upsert por code).
 * Can-do statements curados A1–B2 × Reading/Listening/Speaking/Writing, en
 * español (estudiantes colombianos). Se puntúa por inteligibilidad y can-do,
 * no por acento nativo (ver propuesta §2). No cubre todo el CEFR: es un
 * subconjunto escolar suficiente para arrancar el wedge bilingüe.
 *
 * Uso:  DATABASE_URL=... npx ts-node prisma/seed-cefr.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Skill = 'READING' | 'LISTENING' | 'SPEAKING' | 'WRITING';
type Level = 'A1' | 'A2' | 'B1' | 'B2';

// statements[skill][level] = lista de can-do statements
const CANDO: Record<Skill, Record<Level, string[]>> = {
  READING: {
    A1: [
      'Puedo entender palabras y frases muy simples en carteles y anuncios.',
      'Puedo entender instrucciones cortas y sencillas.',
      'Puedo reconocer nombres, palabras y frases básicas conocidas.',
    ],
    A2: [
      'Puedo entender textos cortos y sencillos sobre temas cotidianos.',
      'Puedo encontrar información específica en materiales de uso diario (horarios, menús).',
      'Puedo entender cartas y correos personales sencillos.',
    ],
    B1: [
      'Puedo entender textos redactados en lenguaje cotidiano.',
      'Puedo comprender la descripción de acontecimientos y deseos en cartas personales.',
      'Puedo entender las ideas principales de textos claros sobre temas conocidos.',
    ],
    B2: [
      'Puedo leer artículos e informes sobre problemas actuales.',
      'Puedo entender textos literarios contemporáneos en prosa.',
      'Puedo comprender la postura del autor en un texto argumentativo.',
    ],
  },
  LISTENING: {
    A1: [
      'Puedo reconocer palabras y expresiones básicas cuando se habla despacio.',
      'Puedo entender preguntas e instrucciones sencillas.',
      'Puedo captar números, precios y horas.',
    ],
    A2: [
      'Puedo entender frases y vocabulario de temas cercanos (familia, compras).',
      'Puedo captar la idea principal de mensajes cortos y claros.',
      'Puedo entender indicaciones para llegar a un lugar.',
    ],
    B1: [
      'Puedo entender los puntos principales de un discurso claro sobre temas conocidos.',
      'Puedo comprender la idea de programas de radio o TV sobre temas actuales.',
      'Puedo seguir una conversación cotidiana si se habla con claridad.',
    ],
    B2: [
      'Puedo entender conferencias y discursos extensos sobre temas conocidos.',
      'Puedo comprender la mayoría de programas de TV y películas en lengua estándar.',
      'Puedo seguir una argumentación compleja si el tema me es familiar.',
    ],
  },
  SPEAKING: {
    A1: [
      'Puedo presentarme y usar saludos y despedidas básicas.',
      'Puedo describir dónde vivo y a las personas que conozco con frases simples.',
      'Puedo pedir y dar información personal básica.',
    ],
    A2: [
      'Puedo describir a mi familia, mi rutina y mi entorno con frases simples.',
      'Puedo desenvolverme en intercambios sencillos (compras, transporte).',
      'Puedo narrar una experiencia o actividad reciente de forma simple.',
    ],
    B1: [
      'Puedo narrar una historia o describir experiencias y reacciones.',
      'Puedo expresar y justificar brevemente mis opiniones.',
      'Puedo desenvolverme en la mayoría de situaciones de un viaje.',
    ],
    B2: [
      'Puedo participar en una conversación con fluidez y espontaneidad.',
      'Puedo presentar y defender mis puntos de vista con argumentos.',
      'Puedo explicar las ventajas y desventajas de distintas opciones.',
    ],
  },
  WRITING: {
    A1: [
      'Puedo escribir notas y mensajes cortos y sencillos.',
      'Puedo rellenar formularios con datos personales.',
      'Puedo escribir frases simples sobre mí mismo.',
    ],
    A2: [
      'Puedo escribir sobre mi rutina y experiencias cotidianas con frases enlazadas.',
      'Puedo escribir cartas o correos personales sencillos.',
      'Puedo describir personas, lugares y objetos de forma simple.',
    ],
    B1: [
      'Puedo escribir textos sencillos y cohesionados sobre temas conocidos.',
      'Puedo describir experiencias, sentimientos y acontecimientos con detalle.',
      'Puedo escribir cartas personales expresando opiniones.',
    ],
    B2: [
      'Puedo escribir textos claros y detallados sobre diversos temas.',
      'Puedo redactar un ensayo o informe defendiendo un punto de vista.',
      'Puedo sintetizar información de varias fuentes.',
    ],
  },
};

async function main() {
  const skills: Skill[] = ['READING', 'LISTENING', 'SPEAKING', 'WRITING'];
  const levels: Level[] = ['A1', 'A2', 'B1', 'B2'];
  let count = 0;
  for (const skill of skills) {
    for (const level of levels) {
      const statements = CANDO[skill][level];
      for (let i = 0; i < statements.length; i++) {
        const num = String(i + 1).padStart(2, '0');
        const code = `CEFR.${level}.${skill}.${num}`;
        await prisma.competency.upsert({
          where: { code },
          create: { framework: 'CEFR', level, skill, code, statement: statements[i], sortOrder: i },
          update: { statement: statements[i], sortOrder: i, isActive: true },
        });
        count++;
      }
    }
  }
  const total = await prisma.competency.count({ where: { framework: 'CEFR' } });
  console.log(`Seed CEFR: ${count} can-do statements procesados. Total en DB: ${total}.`);
}

main().catch(e => { console.error('ERROR:', e?.message || e); process.exit(1); }).finally(() => prisma.$disconnect());
