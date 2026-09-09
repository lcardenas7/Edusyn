import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';

import { ObserverActaExportMode } from './dto/create-observation.dto';
import { ObserverActaPdfService } from './observer-acta-pdf.service';

const institution = {
  id: 'inst-esperanza',
  name: 'IED LA ESPERANZA DEL SUR',
  nit: '802.014.062-7',
  daneCode: '108001000000',
  address: 'Carrera 8C No. 93-92',
  city: 'Barranquilla',
  phone: null,
  email: null,
  website: null,
  logo: null,
  primaryColor: '#1E3A8A',
};

const reportConfig = {
  headerResolution: '06197/2015',
  signatureConfig: [{ role: 'COORDINATOR', label: 'Coordinador(a)', name: 'Coordinación de Convivencia', enabled: true }],
};

const observation = (id: string, studentId: string, firstName: string, lastName: string) => ({
  id,
  institutionId: institution.id,
  authorId: 'teacher-1',
  date: new Date('2026-09-09T00:00:00.000Z'),
  type: 'ACTA_TYPE_II',
  description: 'Durante el cambio de clase se presentó una situación entre estudiantes. El docente intervino, escuchó a las partes y restableció las condiciones de cuidado.',
  actionTaken: 'Diálogo pedagógico, comunicación con las familias y compromiso de reparación y no repetición.',
  actaRecord: {
    actaNumber: 'CONV-2026-014',
    facts: 'Durante el cambio de clase se presentó una situación entre estudiantes. El docente intervino, escuchó a las partes y restableció las condiciones de cuidado.',
    regulationApplied: 'Manual de Convivencia, debido proceso y medidas pedagógicas aplicables a situaciones Tipo II.',
    studentStatement: `El estudiante ${firstName} manifestó su versión de los hechos y participó en la construcción de acuerdos.`,
    sanctions: 'Compromiso pedagógico, acompañamiento del director de grupo y seguimiento por coordinación.',
    witnesses: 'Docente acompañante y representante del curso.',
  },
  author: { id: 'teacher-1', firstName: 'María', lastName: 'Rodríguez' },
  studentEnrollment: {
    academicYear: { year: 2026 },
    student: { id: studentId, firstName, secondName: null, lastName, secondLastName: null },
    group: {
      directorId: 'director-1',
      name: 'A',
      grade: { name: 'Octavo' },
      campus: { name: 'Sede Principal' },
      director: { id: 'director-1', firstName: 'Carlos', lastName: 'Pérez' },
    },
  },
});

describe('ObserverActaPdfService', () => {
  const observations = [
    observation('obs-1', 'student-1', 'Ana María', 'Gómez'),
    observation('obs-2', 'student-2', 'Juan', 'Martínez'),
  ];

  const prisma: any = {
    institution: { findUnique: jest.fn().mockResolvedValue(institution) },
    reportCardConfig: { findUnique: jest.fn().mockResolvedValue(reportConfig) },
    studentObservation: { findMany: jest.fn().mockResolvedValue(observations) },
  };
  const storage: any = { resolveToDataUri: jest.fn().mockResolvedValue(null) };

  beforeEach(() => jest.clearAllMocks());

  it('genera un acta conjunta institucional y conserva el filtro tenant', async () => {
    const service = new ObserverActaPdfService(prisma, storage);
    const pdf = await service.generate({
      institutionId: institution.id,
      actorId: 'coordinator-1',
      actorRoles: ['COORDINADOR'],
      observationIds: ['obs-1', 'obs-2'],
      mode: ObserverActaExportMode.JOINT,
    });

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(3000);
    expect(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)).toHaveLength(3);
    expect(prisma.studentObservation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ institutionId: institution.id }),
    }));

    const outputPath = process.env.OBSERVER_ACTA_SAMPLE_PATH;
    if (outputPath) {
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, pdf);
    }
  });

  it('oculta ids ausentes o de otra institución', async () => {
    prisma.studentObservation.findMany.mockResolvedValueOnce([observations[0]]);
    const service = new ObserverActaPdfService(prisma, storage);
    await expect(service.generate({
      institutionId: institution.id,
      actorId: 'coordinator-1',
      actorRoles: ['COORDINADOR'],
      observationIds: ['obs-1', 'foreign-id'],
      mode: ObserverActaExportMode.JOINT,
    })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resuelve identidad, configuración y casos desde la institución autenticada', async () => {
    const otherInstitution = {
      ...institution,
      id: 'inst-other',
      name: 'COLEGIO DISTRITAL DEL NORTE',
      address: 'Calle 10 No. 20-30',
      city: 'Soledad',
      phone: '6050000000',
      email: 'contacto@colegio.example',
      website: 'colegio.example',
      logo: 'institutions/inst-other/logo.png',
      primaryColor: '#7C2D12',
    };
    const otherObservation = {
      ...observations[0],
      id: 'obs-other',
      institutionId: otherInstitution.id,
    };
    prisma.institution.findUnique.mockResolvedValueOnce(otherInstitution);
    prisma.reportCardConfig.findUnique.mockResolvedValueOnce({
      headerResolution: 'RESOLUCIÓN 1234 DE 2024',
      signatureConfig: [{ role: 'COORDINATOR', name: 'Coordinación Institucional', enabled: true }],
    });
    prisma.studentObservation.findMany.mockResolvedValueOnce([otherObservation]);
    storage.resolveToDataUri.mockResolvedValueOnce(null);

    const service = new ObserverActaPdfService(prisma, storage);
    const pdf = await service.generate({
      institutionId: otherInstitution.id,
      actorId: 'coordinator-other',
      actorRoles: ['COORDINADOR'],
      observationIds: [otherObservation.id],
      mode: ObserverActaExportMode.INDIVIDUAL,
    });

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(prisma.institution.findUnique).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: otherInstitution.id },
      select: expect.objectContaining({ name: true, logo: true, address: true, city: true, phone: true, email: true, website: true }),
    }));
    expect(prisma.reportCardConfig.findUnique).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { institutionId: otherInstitution.id },
    }));
    expect(prisma.studentObservation.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ institutionId: otherInstitution.id }),
    }));
    expect(storage.resolveToDataUri).toHaveBeenLastCalledWith(otherInstitution.logo);
  });

  it('impide al docente exportar actas ajenas a sus registros o dirección de grupo', async () => {
    const service = new ObserverActaPdfService(prisma, storage);
    await expect(service.generate({
      institutionId: institution.id,
      actorId: 'teacher-foreign',
      actorRoles: ['DOCENTE'],
      observationIds: ['obs-1', 'obs-2'],
      mode: ObserverActaExportMode.INDIVIDUAL,
    })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
