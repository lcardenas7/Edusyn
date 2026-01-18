import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = [
    'SUPERADMIN',
    'ADMIN_INSTITUTIONAL',
    'DOCENTE',
    'ESTUDIANTE',
    'ACUDIENTE',
    'COORDINADOR',
  ];

  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  const firstName = process.env.SUPERADMIN_FIRST_NAME ?? 'Super';
  const lastName = process.env.SUPERADMIN_LAST_NAME ?? 'Admin';

  if (email && password) {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          roles: {
            create: [
              {
                role: {
                  connect: { name: 'SUPERADMIN' },
                },
              },
            ],
          },
        },
      });
    } else {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: existing.id,
            roleId: (await prisma.role.findUnique({ where: { name: 'SUPERADMIN' } }))!
              .id,
          },
        },
        update: {},
        create: {
          userId: existing.id,
          roleId: (await prisma.role.findUnique({ where: { name: 'SUPERADMIN' } }))!
            .id,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    await prisma.$disconnect();
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
