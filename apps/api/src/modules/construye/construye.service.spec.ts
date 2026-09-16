import { BadRequestException } from '@nestjs/common';
import { ConstruyeService, validateStaticManifest, validateTeamBrief } from './construye.service';

describe('validateStaticManifest', () => {
  it('acepta el conjunto estático mínimo', () => {
    expect(validateStaticManifest({ files: [
      { path: 'index.html', content: '<main>Hola</main>' },
      { path: 'styles.css', content: 'main { color: teal }' },
      { path: 'app.js', content: 'console.log("hola")' },
    ] })).toEqual(expect.objectContaining({ files: expect.any(Array) }));
  });

  it('rechaza archivos ejecutables o dependencias externas', () => {
    expect(() => validateStaticManifest({ files: [
      { path: 'index.html', content: '<main></main>' },
      { path: 'package.json', content: '{"dependencies":{}}' },
    ] })).toThrow(BadRequestException);
  });

  it('exige una página de entrada', () => {
    expect(() => validateStaticManifest({ files: [{ path: 'app.js', content: '' }] })).toThrow(BadRequestException);
  });
});

describe('validateTeamBrief', () => {
  it('normaliza únicamente los campos pedagógicos certificados', () => {
    expect(validateTeamBrief({
      problem: '  Reducir residuos  ', audience: 'Estudiantes', subject: 'Ciencias', grade: '9.º',
      features: 'Clasificar residuos', style: 'Claro', offsets: [1, 2], code: '<script />',
    })).toEqual({
      problem: 'Reducir residuos', audience: 'Estudiantes', subject: 'Ciencias', grade: '9.º',
      features: 'Clasificar residuos', style: 'Claro',
    });
  });

  it('permite guardar un borrador parcial sin inventar contenido', () => {
    expect(validateTeamBrief({ problem: 'Una idea', grade: '8.º' })).toEqual({
      problem: 'Una idea', audience: '', subject: '', grade: '8.º', features: '', style: '',
    });
  });

  it('rechaza grados fuera del contrato', () => {
    expect(() => validateTeamBrief({ grade: 'Universidad' })).toThrow(BadRequestException);
  });
});

describe('ConstruyeService.updateBrief', () => {
  it('actualiza el estado actual y agrega una entrada histórica en la misma transacción', async () => {
    const updatedTeam = { id: 'team-1', projectId: 'project-1', brief: { problem: 'Reducir residuos' } };
    const journalEntry = { id: 'journal-1', type: 'BRIEF_UPDATED' };
    const tx = {
      construyeTeam: { update: jest.fn().mockResolvedValue(updatedTeam) },
      construyeJournalEntry: { create: jest.fn().mockResolvedValue(journalEntry) },
    };
    const prisma = {
      construyeTeam: { findFirst: jest.fn().mockResolvedValue({ id: 'team-1', projectId: 'project-1', brief: null }) },
      construyeTeamMember: { findFirst: jest.fn().mockResolvedValue({ studentEnrollmentId: 'enrollment-1', studentEnrollment: { id: 'enrollment-1', studentId: 'student-1' } }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ConstruyeService(prisma as any);

    await expect(service.updateBrief('team-1', 'institution-1', 'user-1', {
      brief: { problem: 'Reducir residuos', grade: '8.º' },
    })).resolves.toEqual({ team: updatedTeam, journalEntry });

    expect(tx.construyeTeam.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'team-1' },
      data: expect.objectContaining({ brief: expect.objectContaining({ problem: 'Reducir residuos' }), briefUpdatedAt: expect.any(Date) }),
    }));
    expect(tx.construyeJournalEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        institutionId: 'institution-1', projectId: 'project-1', teamId: 'team-1',
        actorEnrollmentId: 'enrollment-1', type: 'BRIEF_UPDATED',
        detail: expect.objectContaining({ changedFields: expect.arrayContaining(['problem']) }),
      }),
    }));
  });
});
