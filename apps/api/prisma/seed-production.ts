/**
 * SEED DE PRODUCCIÓN - MÍNIMO PARA SAAS
 * 
 * Solo crea:
 * - Roles del sistema
 * - Usuario SuperAdmin
 * 
 * Los permisos se crean con el seed de permisos existente.
 * NO crea instituciones ni datos de prueba.
 */

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Roles del sistema
const ROLES = [
  'SUPER_ADMIN',
  'ADMIN_INSTITUTIONAL',
  'RECTOR',
  'COORDINADOR',
  'DOCENTE',
  'SECRETARIA',
]

async function seedProduction() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('🌱 SEED DE PRODUCCIÓN - EDUSYN SAAS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  try {
    // ═══════════════════════════════════════════════════════════════════════════
    // PASO 1: Crear roles
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.log('📋 Creando roles del sistema...')
    
    for (const roleName of ROLES) {
      await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      })
    }
    console.log(`   ✅ ${ROLES.length} roles creados/actualizados`)

    // ═══════════════════════════════════════════════════════════════════════════
    // PASO 2: Crear SuperAdmin
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.log('👤 Creando usuario SuperAdmin...')
    
    const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } })
    
    if (!superAdminRole) {
      throw new Error('Rol SUPER_ADMIN no encontrado')
    }

    // Contraseña segura para producción (cambiar después del primer login)
    const hashedPassword = await bcrypt.hash('EdusynAdmin2026!', 10)
    
    const superAdmin = await prisma.user.upsert({
      where: { email: 'superadmin@edusyn.co' },
      update: {},
      create: {
        email: 'superadmin@edusyn.co',
        username: 'superadmin',
        passwordHash: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        isActive: true,
        isSuperAdmin: true,
      },
    })

    // Asignar rol SuperAdmin
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: superAdmin.id,
          roleId: superAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: superAdmin.id,
        roleId: superAdminRole.id,
      },
    })
    
    console.log(`   ✅ SuperAdmin creado: superadmin@edusyn.co`)

    // ═══════════════════════════════════════════════════════════════════════
    // RESUMEN
    // ═══════════════════════════════════════════════════════════════════════
    
    console.log('')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('✅ SEED DE PRODUCCIÓN COMPLETADO')
    console.log('═══════════════════════════════════════════════════════════════')
    console.log('')
    console.log('📧 CREDENCIALES SUPERADMIN:')
    console.log('   Email:    superadmin@edusyn.co')
    console.log('   Usuario:  superadmin')
    console.log('   Password: EdusynAdmin2026!')
    console.log('')
    console.log('💡 Puede ingresar con email O usuario')
    console.log('⚠️  IMPORTANTE: Cambiar la contraseña después del primer login')
    console.log('═══════════════════════════════════════════════════════════════')

  } catch (error) {
    console.error('❌ Error durante el seed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedProduction()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
