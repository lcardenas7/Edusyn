import * as ts from 'typescript';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';

describe('B1 filtros contra Prisma generado (sin conexión)', () => {
  it('los modelos de relaciones B1 coinciden con el esquema del cliente utilizado', () => {
    const schema = readFileSync(path.resolve(__dirname, '../../../prisma/schema.prisma'), 'utf8');
    const generated = readFileSync(require.resolve('.prisma/client/schema.prisma'), 'utf8');
    for (const model of ['Classroom', 'ClassroomActivity', 'ClassroomSection', 'ClassroomMaterial',
      'ClassroomAnnouncement', 'TeacherAssignment', 'Group', 'Subject', 'AcademicTerm', 'AcademicYear',
      'StudentEnrollment', 'Student', 'ActivityDependency', 'ActivityAssignment', 'ActivitySubmission',
      'AttitudinalRubric', 'AttitudinalCriterion', 'CriterionLevel', 'Lesson', 'LessonProgress']) {
      const pattern = new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}`);
      const normalize = (source: string) => source.match(pattern)?.[0].split(/\r?\n/)
        .map(line => line.replace(/\/\/.*$/, '').trim().replace(/\s+/g, ' ')).filter(Boolean).sort();
      expect({ model, definition: normalize(generated) }).toEqual({ model, definition: normalize(schema) });
    }
  });

  it('compila los filtros usados con strictNullChecks y rechaza null para FK obligatoria', () => {
    const production = path.join(__dirname, 'classroom-b1-relations.ts');
    const probe = path.join(__dirname, '__b1_null_probe__.ts').replace(/\\/g, '/');
    const options: ts.CompilerOptions = {
      noEmit: true, strictNullChecks: true, skipLibCheck: true,
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10, types: [],
    };
    const host = ts.createCompilerHost(options);
    const original = host.getSourceFile.bind(host);
    host.getSourceFile = (file, version, onError, create) => file === probe
      ? ts.createSourceFile(file, `import { Prisma } from '@prisma/client';
          const invalid: Prisma.ClassroomActivityWhereInput = { classroomId: null };
          const valid: Prisma.ClassroomActivityWhereInput = { sectionId: null, rubricId: null };`, version)
      : original(file, version, onError, create);
    const program = ts.createProgram([production, probe], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(diagnostics.filter(d => d.file?.fileName !== probe).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
    expect(diagnostics.filter(d => d.file?.fileName === probe).map(d => d.code)).toEqual([2322]);
  });
});
