/**
 * Generación de códigos cortos y estables para áreas y asignaturas del catálogo.
 * El código es la clave que amarra la carga académica (inmune a tildes/mayúsculas
 * y errores de escritura). Se generan una sola vez y no cambian.
 */

/** Normaliza a MAYÚSCULAS sin tildes ni símbolos, solo A-Z 0-9 y espacios. */
function clean(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Código base de un área a partir del nombre:
 *  - 1 palabra: sus primeras 3 letras ("MATEMÁTICAS" → "MAT").
 *  - 2+ palabras: inicial de la 1ª + 2 letras de la 2ª ("CIENCIAS NATURALES" → "CNA").
 */
export function baseAreaCode(name: string): string {
  const words = clean(name).split(' ').filter(Boolean);
  if (words.length === 0) return 'ARE';
  if (words.length === 1) return words[0].slice(0, 3).padEnd(3, 'X');
  return (words[0][0] + words[1].slice(0, 2)).slice(0, 3).padEnd(3, 'X');
}

/** Devuelve un código único no presente en `taken` (agrega sufijo numérico si choca). */
export function uniqueCode(base: string, taken: Set<string>): string {
  let code = base;
  let i = 1;
  while (taken.has(code)) {
    code = `${base}${i}`;
    i++;
  }
  taken.add(code);
  return code;
}

/**
 * Código base de una asignatura: prefijo del área + secuencia de 2 dígitos
 * ("MAT01", "MAT02"). `seq` es el consecutivo dentro del área.
 */
export function baseSubjectCode(areaCode: string, seq: number): string {
  return `${areaCode}${String(seq).padStart(2, '0')}`;
}

/**
 * Asigna códigos a las áreas y asignaturas de la institución que aún no tengan.
 * Idempotente (no toca las que ya tienen código). Función compartida —recibe el
 * PrismaService— para usarla desde varios módulos sin dependencias circulares.
 */
export async function backfillCatalogCodes(
  prisma: any,
  institutionId: string,
): Promise<{ areasUpdated: number; subjectsUpdated: number }> {
  const areas = await prisma.area.findMany({
    where: { institutionId },
    select: { id: true, name: true, code: true, subjects: { select: { id: true, name: true, code: true } } },
    orderBy: { name: 'asc' },
  });

  const takenAreaCodes = new Set<string>(areas.map((a: any) => a.code).filter(Boolean));
  const takenSubjectCodes = new Set<string>(
    areas.flatMap((a: any) => a.subjects.map((s: any) => s.code).filter(Boolean)),
  );

  let areasUpdated = 0;
  let subjectsUpdated = 0;

  for (const area of areas) {
    let areaCode: string = area.code || '';
    if (!areaCode) {
      areaCode = uniqueCode(baseAreaCode(area.name), takenAreaCodes);
      await prisma.area.update({ where: { id: area.id }, data: { code: areaCode } });
      areasUpdated++;
    }
    let seq = area.subjects.filter((s: any) => s.code?.startsWith(areaCode)).length + 1;
    for (const subject of area.subjects) {
      if (subject.code) continue;
      const code = uniqueCode(baseSubjectCode(areaCode, seq), takenSubjectCodes);
      seq++;
      await prisma.subject.update({ where: { id: subject.id }, data: { code } });
      subjectsUpdated++;
    }
  }

  return { areasUpdated, subjectsUpdated };
}
