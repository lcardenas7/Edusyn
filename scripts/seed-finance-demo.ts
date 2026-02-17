/**
 * Script para poblar el módulo financiero con datos de prueba
 * Incluye: categorías, conceptos, terceros, obligaciones, pagos, egresos
 *
 * Uso:
 *   npx ts-node scripts/seed-finance-demo.ts
 *
 * Requiere DATABASE_URL en el entorno.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_INSTITUTION_NAME = 'Colegio Demo Excelencia Académica';

async function main() {
  console.log('🔍 Buscando institución demo...');

  // 1. Encontrar la institución demo
  const institution = await prisma.institution.findFirst({
    where: { name: { contains: DEMO_INSTITUTION_NAME, mode: 'insensitive' } },
  });

  if (!institution) {
    console.error('❌ No se encontró institución demo');
    process.exit(1);
  }

  console.log(`✅ Institución encontrada: ${institution.name} (${institution.id})`);

  // 2. Encontrar un usuario admin para auditoría
  const adminUser = await prisma.user.findFirst({
    where: { institutionUsers: { some: { institutionId: institution.id } } },
  });

  if (!adminUser) {
    console.error('❌ No se encontró usuario admin');
    process.exit(1);
  }

  console.log(`✅ Usuario admin: ${adminUser.email}`);

  // 3. Crear o actualizar configuración financiera
  console.log('\n📋 Configurando settings financieros...');
  await prisma.financialSettings.upsert({
    where: { institutionId: institution.id },
    create: {
      institutionId: institution.id,
      invoicePrefix: 'FAC',
      receiptPrefix: 'REC',
      defaultLateFeeType: 'PERCENTAGE',
      defaultLateFeeValue: new Prisma.Decimal(2),
      defaultGracePeriodDays: 5,
      taxId: '900.123.456-7',
      taxRegime: 'NO_RESPONSABLE',
      sendPaymentReminders: true,
      reminderDaysBefore: 3,
    },
    update: {},
  });

  // 4. Crear categorías financieras
  console.log('\n📂 Creando categorías financieras...');
  
  const categoriesData = [
    // INGRESOS
    { name: 'Matrículas y Pensiones', type: 'INCOME', code: '4101', color: '#10B981', icon: 'graduation-cap' },
    { name: 'Eventos Institucionales', type: 'INCOME', code: '4102', color: '#8B5CF6', icon: 'calendar' },
    { name: 'Derechos de Grado', type: 'INCOME', code: '4103', color: '#F59E0B', icon: 'award' },
    { name: 'Servicios Académicos', type: 'INCOME', code: '4104', color: '#3B82F6', icon: 'book' },
    { name: 'Alquileres y Arriendos', type: 'INCOME', code: '4105', color: '#EC4899', icon: 'building' },
    { name: 'Otros Ingresos', type: 'INCOME', code: '4199', color: '#6B7280', icon: 'plus-circle' },
    // EGRESOS
    { name: 'Mantenimiento y Reparaciones', type: 'EXPENSE', code: '5101', color: '#EF4444', icon: 'wrench' },
    { name: 'Servicios Públicos', type: 'EXPENSE', code: '5102', color: '#F97316', icon: 'zap' },
    { name: 'Suministros y Materiales', type: 'EXPENSE', code: '5103', color: '#84CC16', icon: 'package' },
    { name: 'Servicios Profesionales', type: 'EXPENSE', code: '5104', color: '#06B6D4', icon: 'briefcase' },
    { name: 'Otros Egresos', type: 'EXPENSE', code: '5199', color: '#6B7280', icon: 'minus-circle' },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const created = await prisma.financialCategory.upsert({
      where: { institutionId_name: { institutionId: institution.id, name: cat.name } },
      create: {
        institutionId: institution.id,
        name: cat.name,
        type: cat.type as any,
        code: cat.code,
        color: cat.color,
        icon: cat.icon,
      },
      update: {},
    });
    categories[cat.name] = created.id;
    console.log(`  ✓ ${cat.name}`);
  }

  // 5. Crear conceptos de cobro
  console.log('\n💰 Creando conceptos de cobro...');

  const conceptsData = [
    // Pensiones
    { name: 'Pensión Mensual 2025', categoryName: 'Matrículas y Pensiones', amount: 450000, isMassive: true, isRecurring: true },
    { name: 'Matrícula 2025', categoryName: 'Matrículas y Pensiones', amount: 350000, isMassive: true, isRecurring: false },
    // Eventos
    { name: 'Bingo Institucional 2025', categoryName: 'Eventos Institucionales', amount: 25000, isMassive: true, isRecurring: false },
    { name: 'Rifa Pro-Fondos Navidad', categoryName: 'Eventos Institucionales', amount: 15000, isMassive: true, isRecurring: false },
    { name: 'Festival de la Familia', categoryName: 'Eventos Institucionales', amount: 20000, isMassive: false, isRecurring: false },
    // Grados
    { name: 'Derecho de Grado 11°', categoryName: 'Derechos de Grado', amount: 280000, isMassive: true, isRecurring: false },
    { name: 'Derecho de Grado Preescolar', categoryName: 'Derechos de Grado', amount: 150000, isMassive: true, isRecurring: false },
    { name: 'Alquiler Toga y Birrete', categoryName: 'Derechos de Grado', amount: 80000, isMassive: false, isRecurring: false },
    // Servicios académicos
    { name: 'Curso PreICFES Intensivo', categoryName: 'Servicios Académicos', amount: 180000, isMassive: true, isRecurring: false },
    { name: 'Simulacro ICFES', categoryName: 'Servicios Académicos', amount: 35000, isMassive: true, isRecurring: false },
    { name: 'Certificado de Estudios', categoryName: 'Servicios Académicos', amount: 15000, isMassive: false, isRecurring: false },
    { name: 'Constancia de Notas', categoryName: 'Servicios Académicos', amount: 10000, isMassive: false, isRecurring: false },
    // Alquileres
    { name: 'Alquiler Kiosko Mensual', categoryName: 'Alquileres y Arriendos', amount: 800000, isMassive: false, isRecurring: true },
    { name: 'Alquiler Auditorio (día)', categoryName: 'Alquileres y Arriendos', amount: 250000, isMassive: false, isRecurring: false },
    // Otros
    { name: 'Carné Estudiantil', categoryName: 'Otros Ingresos', amount: 12000, isMassive: true, isRecurring: false },
    { name: 'Agenda Escolar', categoryName: 'Otros Ingresos', amount: 25000, isMassive: true, isRecurring: false },
  ];

  const concepts: Record<string, string> = {};
  for (const concept of conceptsData) {
    const created = await prisma.chargeConcept.upsert({
      where: { institutionId_name: { institutionId: institution.id, name: concept.name } },
      create: {
        institutionId: institution.id,
        name: concept.name,
        categoryId: categories[concept.categoryName],
        defaultAmount: new Prisma.Decimal(concept.amount),
        isMassive: concept.isMassive,
        isRecurring: concept.isRecurring,
        allowPartial: true,
        allowDiscount: true,
      },
      update: {},
    });
    concepts[concept.name] = created.id;
    console.log(`  ✓ ${concept.name} - $${concept.amount.toLocaleString()}`);
  }

  // 6. Crear terceros (proveedores externos)
  console.log('\n👥 Creando terceros proveedores...');

  const providersData = [
    { name: 'Servicios de Aire Acondicionado S.A.S.', type: 'PROVIDER', document: '900.555.111-2', businessName: 'Servicios de Aire Acondicionado S.A.S.', nit: '900555111' },
    { name: 'Papelería El Estudiante', type: 'PROVIDER', document: '800.123.456-7', businessName: 'Papelería El Estudiante Ltda.', nit: '800123456' },
    { name: 'Aseo y Mantenimiento Integral', type: 'PROVIDER', document: '900.888.999-1', businessName: 'Aseo y Mantenimiento Integral S.A.S.', nit: '900888999' },
    { name: 'Cafetería Doña Rosa', type: 'EXTERNAL', document: '52.123.456', businessName: 'Rosa María Pérez', email: 'cafeteria@gmail.com', phone: '3101234567' },
    { name: 'Transporte Escolar ABC', type: 'PROVIDER', document: '900.777.666-5', businessName: 'Transporte Escolar ABC S.A.S.', nit: '900777666' },
  ];

  const providers: Record<string, string> = {};
  for (const prov of providersData) {
    const existing = await prisma.financialThirdParty.findFirst({
      where: { institutionId: institution.id, name: prov.name },
    });
    if (existing) {
      providers[prov.name] = existing.id;
      console.log(`  ✓ ${prov.name} (existente)`);
    } else {
      const created = await prisma.financialThirdParty.create({
        data: {
          institutionId: institution.id,
          type: prov.type as any,
          name: prov.name,
          document: prov.document,
          businessName: prov.businessName,
          nit: prov.nit,
          email: (prov as any).email,
          phone: (prov as any).phone,
        },
      });
      providers[prov.name] = created.id;
      console.log(`  ✓ ${prov.name}`);
    }
  }

  // 7. Sincronizar estudiantes como terceros (si no existen)
  console.log('\n🎓 Sincronizando estudiantes como terceros...');
  
  const students = await prisma.student.findMany({
    where: { institutionId: institution.id },
    take: 30, // Limitar a 30 estudiantes para demo
    include: { user: true },
  });

  const studentThirdParties: string[] = [];
  for (const student of students) {
    const existing = await prisma.financialThirdParty.findFirst({
      where: { institutionId: institution.id, type: 'STUDENT', referenceId: student.id },
    });
    if (existing) {
      studentThirdParties.push(existing.id);
    } else {
      const created = await prisma.financialThirdParty.create({
        data: {
          institutionId: institution.id,
          type: 'STUDENT',
          referenceId: student.id,
          name: `${student.firstName} ${student.lastName}`,
          document: student.documentNumber || undefined,
          email: student.user?.email,
        },
      });
      studentThirdParties.push(created.id);
    }
  }
  console.log(`  ✓ ${studentThirdParties.length} estudiantes sincronizados`);

  // 8. Crear obligaciones de prueba
  console.log('\n📝 Creando obligaciones de prueba...');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Pensiones para los primeros 20 estudiantes (meses anteriores)
  let obligationCount = 0;
  for (let i = 0; i < Math.min(20, studentThirdParties.length); i++) {
    const thirdPartyId = studentThirdParties[i];
    
    // Pensiones de meses anteriores (algunas pagadas, algunas pendientes)
    for (let month = 1; month <= currentMonth; month++) {
      const dueDate = new Date(currentYear, month - 1, 15);
      const isPaid = Math.random() > 0.3; // 70% pagadas
      const amount = 450000;
      
      const existing = await prisma.financialObligation.findFirst({
        where: {
          institutionId: institution.id,
          thirdPartyId,
          conceptId: concepts['Pensión Mensual 2025'],
          dueDate,
        },
      });

      if (!existing) {
        await prisma.financialObligation.create({
          data: {
            institutionId: institution.id,
            thirdPartyId,
            conceptId: concepts['Pensión Mensual 2025'],
            originalAmount: new Prisma.Decimal(amount),
            totalAmount: new Prisma.Decimal(amount),
            paidAmount: isPaid ? new Prisma.Decimal(amount) : new Prisma.Decimal(0),
            balance: isPaid ? new Prisma.Decimal(0) : new Prisma.Decimal(amount),
            status: isPaid ? 'PAID' : (dueDate < now ? 'OVERDUE' : 'PENDING'),
            issueDate: new Date(currentYear, month - 1, 1),
            dueDate,
            paidDate: isPaid ? new Date(currentYear, month - 1, Math.floor(Math.random() * 10) + 5) : undefined,
            reference: `PEN-${currentYear}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
          },
        });
        obligationCount++;
      }
    }
  }
  console.log(`  ✓ ${obligationCount} obligaciones de pensión creadas`);

  // Bingo para 15 estudiantes
  let bingoCount = 0;
  for (let i = 0; i < Math.min(15, studentThirdParties.length); i++) {
    const thirdPartyId = studentThirdParties[i];
    const isPaid = Math.random() > 0.4;
    const amount = 25000;

    const existing = await prisma.financialObligation.findFirst({
      where: {
        institutionId: institution.id,
        thirdPartyId,
        conceptId: concepts['Bingo Institucional 2025'],
      },
    });

    if (!existing) {
      await prisma.financialObligation.create({
        data: {
          institutionId: institution.id,
          thirdPartyId,
          conceptId: concepts['Bingo Institucional 2025'],
          originalAmount: new Prisma.Decimal(amount),
          totalAmount: new Prisma.Decimal(amount),
          paidAmount: isPaid ? new Prisma.Decimal(amount) : new Prisma.Decimal(0),
          balance: isPaid ? new Prisma.Decimal(0) : new Prisma.Decimal(amount),
          status: isPaid ? 'PAID' : 'PENDING',
          issueDate: new Date(currentYear, currentMonth - 1, 1),
          dueDate: new Date(currentYear, currentMonth, 20),
          paidDate: isPaid ? new Date(currentYear, currentMonth - 1, Math.floor(Math.random() * 20) + 1) : undefined,
          reference: `BIN-${currentYear}-${String(i + 1).padStart(4, '0')}`,
        },
      });
      bingoCount++;
    }
  }
  console.log(`  ✓ ${bingoCount} obligaciones de bingo creadas`);

  // Rifa para 10 estudiantes
  let rifaCount = 0;
  for (let i = 0; i < Math.min(10, studentThirdParties.length); i++) {
    const thirdPartyId = studentThirdParties[i];
    const isPaid = Math.random() > 0.5;
    const amount = 15000;

    const existing = await prisma.financialObligation.findFirst({
      where: {
        institutionId: institution.id,
        thirdPartyId,
        conceptId: concepts['Rifa Pro-Fondos Navidad'],
      },
    });

    if (!existing) {
      await prisma.financialObligation.create({
        data: {
          institutionId: institution.id,
          thirdPartyId,
          conceptId: concepts['Rifa Pro-Fondos Navidad'],
          originalAmount: new Prisma.Decimal(amount),
          totalAmount: new Prisma.Decimal(amount),
          paidAmount: isPaid ? new Prisma.Decimal(amount) : new Prisma.Decimal(0),
          balance: isPaid ? new Prisma.Decimal(0) : new Prisma.Decimal(amount),
          status: isPaid ? 'PAID' : 'PENDING',
          issueDate: new Date(currentYear, currentMonth - 1, 15),
          dueDate: new Date(currentYear, 11, 15), // Diciembre
          paidDate: isPaid ? new Date(currentYear, currentMonth - 1, Math.floor(Math.random() * 10) + 15) : undefined,
          reference: `RIF-${currentYear}-${String(i + 1).padStart(4, '0')}`,
        },
      });
      rifaCount++;
    }
  }
  console.log(`  ✓ ${rifaCount} obligaciones de rifa creadas`);

  // PreICFES para 8 estudiantes (grado 11)
  let preicfesCount = 0;
  for (let i = 0; i < Math.min(8, studentThirdParties.length); i++) {
    const thirdPartyId = studentThirdParties[i];
    const isPaid = Math.random() > 0.3;
    const amount = 180000;

    const existing = await prisma.financialObligation.findFirst({
      where: {
        institutionId: institution.id,
        thirdPartyId,
        conceptId: concepts['Curso PreICFES Intensivo'],
      },
    });

    if (!existing) {
      await prisma.financialObligation.create({
        data: {
          institutionId: institution.id,
          thirdPartyId,
          conceptId: concepts['Curso PreICFES Intensivo'],
          originalAmount: new Prisma.Decimal(amount),
          totalAmount: new Prisma.Decimal(amount),
          paidAmount: isPaid ? new Prisma.Decimal(amount) : new Prisma.Decimal(0),
          balance: isPaid ? new Prisma.Decimal(0) : new Prisma.Decimal(amount),
          status: isPaid ? 'PAID' : 'PENDING',
          issueDate: new Date(currentYear, 1, 1),
          dueDate: new Date(currentYear, 2, 15),
          paidDate: isPaid ? new Date(currentYear, 1, Math.floor(Math.random() * 28) + 1) : undefined,
          reference: `PRE-${currentYear}-${String(i + 1).padStart(4, '0')}`,
        },
      });
      preicfesCount++;
    }
  }
  console.log(`  ✓ ${preicfesCount} obligaciones de PreICFES creadas`);

  // Derecho de grado para 5 estudiantes
  let gradoCount = 0;
  for (let i = 0; i < Math.min(5, studentThirdParties.length); i++) {
    const thirdPartyId = studentThirdParties[i];
    const isPaid = Math.random() > 0.4;
    const amount = 280000;

    const existing = await prisma.financialObligation.findFirst({
      where: {
        institutionId: institution.id,
        thirdPartyId,
        conceptId: concepts['Derecho de Grado 11°'],
      },
    });

    if (!existing) {
      await prisma.financialObligation.create({
        data: {
          institutionId: institution.id,
          thirdPartyId,
          conceptId: concepts['Derecho de Grado 11°'],
          originalAmount: new Prisma.Decimal(amount),
          totalAmount: new Prisma.Decimal(amount),
          paidAmount: isPaid ? new Prisma.Decimal(amount) : new Prisma.Decimal(0),
          balance: isPaid ? new Prisma.Decimal(0) : new Prisma.Decimal(amount),
          status: isPaid ? 'PAID' : 'PENDING',
          issueDate: new Date(currentYear, 8, 1),
          dueDate: new Date(currentYear, 10, 15),
          paidDate: isPaid ? new Date(currentYear, 9, Math.floor(Math.random() * 30) + 1) : undefined,
          reference: `GRA-${currentYear}-${String(i + 1).padStart(4, '0')}`,
        },
      });
      gradoCount++;
    }
  }
  console.log(`  ✓ ${gradoCount} obligaciones de derecho de grado creadas`);

  // 9. Crear pagos para obligaciones pagadas
  console.log('\n💵 Creando pagos de prueba...');

  const paidObligations = await prisma.financialObligation.findMany({
    where: {
      institutionId: institution.id,
      status: 'PAID',
      payments: { none: {} }, // Sin pagos registrados
    },
    take: 50,
  });

  let paymentCount = 0;
  let receiptNumber = 1;
  for (const obl of paidObligations) {
    const paymentMethods = ['CASH', 'TRANSFER', 'PSE', 'CARD'];
    const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

    await prisma.financialPayment.create({
      data: {
        institutionId: institution.id,
        obligationId: obl.id,
        thirdPartyId: obl.thirdPartyId,
        amount: obl.paidAmount,
        paymentMethod: method as any,
        receiptNumber: `REC-${currentYear}-${String(receiptNumber++).padStart(5, '0')}`,
        paymentDate: obl.paidDate || new Date(),
        receivedById: adminUser.id,
        transactionRef: method === 'TRANSFER' || method === 'PSE' ? `TRX${Math.random().toString(36).substring(2, 10).toUpperCase()}` : undefined,
      },
    });
    paymentCount++;
  }
  console.log(`  ✓ ${paymentCount} pagos creados`);

  // 10. Crear egresos de prueba
  console.log('\n📤 Creando egresos de prueba...');

  const expensesData = [
    { description: 'Mantenimiento preventivo aires acondicionados - Bloque A', categoryName: 'Mantenimiento y Reparaciones', amount: 850000, providerName: 'Servicios de Aire Acondicionado S.A.S.', invoiceNumber: 'FAC-001234' },
    { description: 'Reparación aire acondicionado sala de profesores', categoryName: 'Mantenimiento y Reparaciones', amount: 320000, providerName: 'Servicios de Aire Acondicionado S.A.S.', invoiceNumber: 'FAC-001235' },
    { description: 'Suministros de papelería - Febrero', categoryName: 'Suministros y Materiales', amount: 450000, providerName: 'Papelería El Estudiante', invoiceNumber: 'PEE-5678' },
    { description: 'Suministros de papelería - Marzo', categoryName: 'Suministros y Materiales', amount: 380000, providerName: 'Papelería El Estudiante', invoiceNumber: 'PEE-5890' },
    { description: 'Servicio de aseo mensual - Enero', categoryName: 'Servicios Profesionales', amount: 1200000, providerName: 'Aseo y Mantenimiento Integral', invoiceNumber: 'AMI-2025-001' },
    { description: 'Servicio de aseo mensual - Febrero', categoryName: 'Servicios Profesionales', amount: 1200000, providerName: 'Aseo y Mantenimiento Integral', invoiceNumber: 'AMI-2025-002' },
    { description: 'Reparación puerta principal', categoryName: 'Mantenimiento y Reparaciones', amount: 180000, providerName: null, invoiceNumber: null },
    { description: 'Compra de materiales de limpieza', categoryName: 'Suministros y Materiales', amount: 95000, providerName: null, invoiceNumber: null },
  ];

  let expenseCount = 0;
  for (const exp of expensesData) {
    const existing = await prisma.financialExpense.findFirst({
      where: {
        institutionId: institution.id,
        description: exp.description,
      },
    });

    if (!existing) {
      await prisma.financialExpense.create({
        data: {
          institutionId: institution.id,
          categoryId: categories[exp.categoryName],
          providerId: exp.providerName ? providers[exp.providerName] : undefined,
          description: exp.description,
          amount: new Prisma.Decimal(exp.amount),
          expenseDate: new Date(currentYear, Math.floor(Math.random() * currentMonth), Math.floor(Math.random() * 28) + 1),
          invoiceNumber: exp.invoiceNumber || undefined,
          paymentMethod: 'TRANSFER',
          registeredById: adminUser.id,
          approvedById: adminUser.id,
          approvedAt: new Date(),
        },
      });
      expenseCount++;
    }
  }
  console.log(`  ✓ ${expenseCount} egresos creados`);

  // 11. Crear ingreso por alquiler del kiosko
  console.log('\n🏪 Creando ingresos por alquiler de kiosko...');

  const kioskThirdParty = providers['Cafetería Doña Rosa'];
  if (kioskThirdParty) {
    for (let month = 1; month <= currentMonth; month++) {
      const existing = await prisma.financialObligation.findFirst({
        where: {
          institutionId: institution.id,
          thirdPartyId: kioskThirdParty,
          conceptId: concepts['Alquiler Kiosko Mensual'],
          dueDate: new Date(currentYear, month - 1, 5),
        },
      });

      if (!existing) {
        const isPaid = month < currentMonth || Math.random() > 0.3;
        const amount = 800000;

        await prisma.financialObligation.create({
          data: {
            institutionId: institution.id,
            thirdPartyId: kioskThirdParty,
            conceptId: concepts['Alquiler Kiosko Mensual'],
            originalAmount: new Prisma.Decimal(amount),
            totalAmount: new Prisma.Decimal(amount),
            paidAmount: isPaid ? new Prisma.Decimal(amount) : new Prisma.Decimal(0),
            balance: isPaid ? new Prisma.Decimal(0) : new Prisma.Decimal(amount),
            status: isPaid ? 'PAID' : 'PENDING',
            issueDate: new Date(currentYear, month - 1, 1),
            dueDate: new Date(currentYear, month - 1, 5),
            paidDate: isPaid ? new Date(currentYear, month - 1, Math.floor(Math.random() * 5) + 1) : undefined,
            reference: `ALQ-KIO-${currentYear}-${String(month).padStart(2, '0')}`,
          },
        });
      }
    }
    console.log(`  ✓ Alquileres de kiosko creados para ${currentMonth} meses`);
  }

  // 12. Resumen final
  console.log('\n' + '═'.repeat(50));
  console.log('✅ SEED FINANCIERO COMPLETADO');
  console.log('═'.repeat(50));

  const stats = await prisma.$transaction([
    prisma.financialCategory.count({ where: { institutionId: institution.id } }),
    prisma.chargeConcept.count({ where: { institutionId: institution.id } }),
    prisma.financialThirdParty.count({ where: { institutionId: institution.id } }),
    prisma.financialObligation.count({ where: { institutionId: institution.id } }),
    prisma.financialPayment.count({ where: { institutionId: institution.id } }),
    prisma.financialExpense.count({ where: { institutionId: institution.id } }),
  ]);

  console.log(`
📊 Resumen:
   - Categorías: ${stats[0]}
   - Conceptos de cobro: ${stats[1]}
   - Terceros: ${stats[2]}
   - Obligaciones: ${stats[3]}
   - Pagos: ${stats[4]}
   - Egresos: ${stats[5]}
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
