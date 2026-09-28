import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const markdownFiles = Array.from({ length: 6 }, (_, i) => path.join(root, `docs/DUELOS_DEPORTES_6_BLOQUE_0${i + 1}.md`));
const questions = [];
const answerPositionCounts = { A: 0, B: 0, C: 0, D: 0 };
for (const file of markdownFiles) {
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
    const firstBlock = body.trim().split(/\r?\n\s*\r?\n/)[0];
    const text = firstBlock.trim();
    const concept = body.match(/^\*\*Concepto:\*\*\s*([a-z0-9_]+)\s*$/m)?.[1];
    const explanation = body.match(/^\*\*Explicación:\*\*\s*(.+)\s*$/m)?.[1]?.trim();
    if (!concept || !text || !explanation) throw new Error(`Missing fields for Q${number} in ${file}`);
    let options;
    let correctAnswer;
    if (type === 'TRUE_FALSE') {
      options = ['Verdadero', 'Falso'];
      correctAnswer = body.match(/^\*\*Respuesta:\*\*\s*(Verdadero|Falso)\./m)?.[1];
    } else {
      options = [...body.matchAll(/^([ABCD])\.\s+(.+?)\s*$/gm)].map((option) => option[2].trim());
      const letter = body.match(/^\*\*Respuesta:\*\*\s*([ABCD])\./m)?.[1];
      if (options.length !== 4 || !letter) throw new Error(`Invalid multiple choice options/key for Q${number} in ${file}`);
      const keyedOptions = Object.fromEntries([...body.matchAll(/^([ABCD])\.\s+(.+?)\s*$/gm)].map((option) => [option[1], option[2].trim()]));
      correctAnswer = keyedOptions[letter];
      answerPositionCounts[letter] += 1;
    }
    if (!correctAnswer || (type === 'TRUE_FALSE' && !options.includes(correctAnswer))) throw new Error(`Invalid answer for Q${number}`);
    questions.push({ id: `DEP6-${String(number).padStart(3, '0')}`, number, topic, concept, difficulty, type, text, options, correctAnswer, explanation, stability: 'STABLE' });
  }
}
questions.sort((a, b) => a.number - b.number);
const counts = {
  questions: questions.length,
  multipleChoice: questions.filter((q) => q.type === 'MULTIPLE_CHOICE').length,
  trueFalse: questions.filter((q) => q.type === 'TRUE_FALSE').length,
  difficulty: { basic: questions.filter((q) => q.difficulty === 'BASIC').length, intermediate: questions.filter((q) => q.difficulty === 'INTERMEDIATE').length, application: questions.filter((q) => q.difficulty === 'APPLICATION').length },
  answerPositions: answerPositionCounts,
  conceptsPresent: new Set(questions.map((q) => q.concept)).size,
};
counts.conceptsMissing = questions.filter((q) => !q.concept).length;
if (counts.questions !== 150 || counts.multipleChoice !== 120 || counts.trueFalse !== 30 || counts.difficulty.basic !== 50 || counts.difficulty.intermediate !== 70 || counts.difficulty.application !== 30 || Object.values(counts.answerPositions).some((n) => n !== 30) || counts.conceptsPresent !== 150 || counts.conceptsMissing !== 0) {
  throw new Error(`Audit failed: ${JSON.stringify(counts)}`);
}
if (questions.some((q, i) => q.number !== i + 1)) throw new Error('Question numbers are not consecutive 1–150');
const catalog = { catalogId: 'edusyn-deportes-grade-6-v1', title: 'Deportes · 6.º', grade: 6, subjectArea: 'Duelos', category: 'Deportes', version: '1.0', availability: 'institution-opt-in', editorialStatus: 'ready-for-import', audit: counts, questions };
const outputPath = path.join(root, 'docs/duelos/oficial/deportes_6.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output: outputPath, audit: counts }, null, 2));

