import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = Array.from({ length: 6 }, (_, i) => path.join(root, `docs/DUELOS_CIENCIA_NATURALEZA_6_BLOQUE_0${i + 1}.md`));
const questions = [];
const answerPositions = { A: 0, B: 0, C: 0, D: 0 };
for (const file of files) {
  const markdown = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const sections = [...markdown.matchAll(/^### (\d+)\. (.+)\r?\n([\s\S]*?)(?=^### |^## Fuentes|$(?![\s\S]))/gm)];
  for (const match of sections) {
    const number = Number(match[1]);
    const heading = match[2].trim();
    const body = match[3];
    const difficultyLabel = heading.split('·')[0].trim();
    const difficulty = difficultyLabel === 'Básica' ? 'BASIC' : difficultyLabel === 'Intermedia' ? 'INTERMEDIATE' : 'APPLICATION';
    const type = heading.includes('TRUE/FALSE') ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE';
    const topic = heading.split('·').slice(1).join('·').replace(/—\s*TRUE\/FALSE/g, '').trim();
    const text = body.trim().split(/\r?\n\s*\r?\n/)[0].trim();
    const concept = body.match(/^\*\*Concepto:\*\*\s*([a-z0-9_]+)\s*$/m)?.[1];
    const explanation = body.match(/^\*\*Explicación:\*\*\s*(.+)\s*$/m)?.[1]?.trim();
    if (!concept || !text || !explanation) throw new Error(`Missing required field for Q${number} (${file})`);
    let options;
    let correctAnswer;
    if (type === 'TRUE_FALSE') {
      options = ['Verdadero', 'Falso'];
      correctAnswer = body.match(/^\*\*Respuesta:\*\*\s*(Verdadero|Falso)\./m)?.[1];
    } else {
      const optionMatches = [...body.matchAll(/^([ABCD])\.\s+(.+?)\s*$/gm)];
      if (optionMatches.length !== 4) throw new Error(`Q${number} must have four options`);
      options = optionMatches.map((option) => option[2].trim());
      const letter = body.match(/^\*\*Respuesta:\*\*\s*([ABCD])\./m)?.[1];
      const keyed = Object.fromEntries(optionMatches.map((option) => [option[1], option[2].trim()]));
      correctAnswer = keyed[letter];
      if (!correctAnswer) throw new Error(`Q${number} has an invalid answer key`);
      answerPositions[letter] += 1;
    }
    questions.push({ id: `CIE6-${String(number).padStart(3, '0')}`, number, topic, concept, difficulty, type, text, options, correctAnswer, explanation, stability: 'STABLE' });
  }
}
questions.sort((a, b) => a.number - b.number);
const counts = {
  questions: questions.length,
  multipleChoice: questions.filter((q) => q.type === 'MULTIPLE_CHOICE').length,
  trueFalse: questions.filter((q) => q.type === 'TRUE_FALSE').length,
  difficulty: {
    basic: questions.filter((q) => q.difficulty === 'BASIC').length,
    intermediate: questions.filter((q) => q.difficulty === 'INTERMEDIATE').length,
    application: questions.filter((q) => q.difficulty === 'APPLICATION').length,
  },
  answerPositions,
  conceptsPresent: new Set(questions.map((q) => q.concept)).size,
  conceptsMissing: questions.filter((q) => !q.concept).length,
};
if (counts.questions !== 150 || counts.multipleChoice !== 120 || counts.trueFalse !== 30 || counts.difficulty.basic !== 50 || counts.difficulty.intermediate !== 70 || counts.difficulty.application !== 30 || Object.values(answerPositions).some((n) => n !== 30) || counts.conceptsPresent !== 150 || counts.conceptsMissing !== 0 || questions.some((q, i) => q.number !== i + 1)) {
  throw new Error(`Audit failed: ${JSON.stringify(counts)}`);
}
const catalog = {
  catalogId: 'edusyn-ciencia-naturaleza-grade-6-v1',
  title: 'Ciencia y naturaleza · 6.º',
  grade: 6,
  subjectArea: 'Duelos',
  category: 'Ciencia y naturaleza',
  version: '1.0',
  availability: 'institution-opt-in',
  editorialStatus: 'ready-for-import',
  audit: counts,
  sources: [
    'https://science.nasa.gov/moon/moon-phases/',
    'https://science.nasa.gov/moon/tides/',
    'https://science.nasa.gov/earth/earth-observatory/ozone/',
    'https://science.nasa.gov/solar-system/solar-system-facts/',
    'https://www.noaa.gov/education/resource-collections/freshwater/water-cycle',
    'https://www.noaa.gov/education/resource-collections/weather-atmosphere',
    'https://openstax.org/details/books/biology-2e',
    'https://openstax.org/books/biology-2e/pages/46-1-ecology-of-ecosystems',
    'https://openstax.org/books/biology-2e/pages/19-3-adaptive-evolution',
    'https://pubs.usgs.gov/gip/collect1/collectgip.html',
    'https://www.usgs.gov/programs/earthquake-hazards/science-earthquakes',
  ],
  questions,
};
const output = path.join(root, 'docs/duelos/oficial/ciencia_naturaleza_6.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output, audit: counts }, null, 2));
