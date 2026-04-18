// ─────────────────────────────────────────────────────────────
// O.P.U.C — Database Seed Script
// Creates SUPER_ADMIN + demo entreprise + demo users.
// Run: bun run db:seed
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/password'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding O.P.U.C database...\n')

  // ─── 1. Clean existing data (dev only) ──────────────────────
  console.log('🗑️  Cleaning existing data...')
  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.loginAttemptLog.deleteMany()
  await prisma.passwordResetToken.deleteMany()
  await prisma.invitationToken.deleteMany()
  await prisma.userChantierAccess.deleteMany()
  await prisma.permissionConfig.deleteMany()
  await prisma.systemSetting.deleteMany()

  // Clean business data
  await prisma.releveCompteurEngin.deleteMany()
  await prisma.bonAchatCarburant.deleteMany()
  await prisma.sortieCarburant.deleteMany()
  await prisma.entreeCarburant.deleteMany()
  await prisma.stockCarburant.deleteMany()
  await prisma.sortieStock.deleteMany()
  await prisma.entreeStock.deleteMany()
  await prisma.stockMateriel.deleteMany()
  await prisma.contratST.deleteMany()
  await prisma.locationEngin.deleteMany()
  await prisma.equipementAffectation.deleteMany()
  await prisma.equipement.deleteMany()
  await prisma.sousTraitant.deleteMany()
  await prisma.salaireMensuel.deleteMany()
  await prisma.paiementHebdo.deleteMany()
  await prisma.pointage.deleteMany()
  await prisma.journalierAffectation.deleteMany()
  await prisma.journalier.deleteMany()
  await prisma.phase.deleteMany()
  await prisma.photo.deleteMany()
  await prisma.rapportJournalier.deleteMany()
  await prisma.tache.deleteMany()
  await prisma.documentChantier.deleteMany()
  await prisma.chantier.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.verificationToken.deleteMany()

  // Clean users then entreprises
  await prisma.user.deleteMany()
  await prisma.entreprise.deleteMany()

  console.log('✅ Data cleaned.\n')

  // ─── 2. Create demo Entreprise ──────────────────────────────
  console.log('🏢 Creating demo entreprise...')
  const entreprise = await prisma.entreprise.create({
    data: {
      nom: 'SARL CONSTRUBAT',
      adresse: 'Route de l\'Aéroport, Dakar, Sénégal',
      telephone: '+221 33 800 00 00',
      email: 'contact@construbat.sn',
    },
  })
  console.log(`   ✅ Entreprise: ${entreprise.nom} (ID: ${entreprise.id})\n`)

  // ─── 3. Create SUPER_ADMIN (platform level) ─────────────────
  console.log('👤 Creating SUPER_ADMIN...')
  const superAdminPassword = await hashPassword('Admin@123456')
  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@opuc.demo',
      name: 'Super Administrateur',
      password: superAdminPassword,
      role: 'SUPER_ADMIN',
      entrepriseId: null, // No tenant — platform-wide
      active: true,
      twoFactorEnabled: false,
      premiereConnexion: false,
      telephone: '+221 77 000 00 00',
    },
  })
  console.log(`   ✅ SUPER_ADMIN: ${superAdmin.email}\n`)

  // ─── 4. Create GERANT (entreprise owner) ────────────────────
  console.log('👤 Creating GERANT...')
  const gerantPassword = await hashPassword('demo123')
  const gerant = await prisma.user.create({
    data: {
      email: 'chef-entreprise@opuc.demo',
      name: 'Moussa Diallo',
      password: gerantPassword,
      role: 'GERANT',
      entrepriseId: entreprise.id,
      active: true,
      twoFactorEnabled: false,
      premiereConnexion: false,
      telephone: '+221 77 100 00 00',
    },
  })
  console.log(`   ✅ GERANT: ${gerant.email}\n`)

  // ─── 5. Create ADMIN_ENTREPRISE ─────────────────────────────
  console.log('👤 Creating ADMIN_ENTREPRISE...')
  const adminPassword = await hashPassword('demo123')
  const admin = await prisma.user.create({
    data: {
      email: 'admin@opuc.demo',
      name: 'Fatou Ndiaye',
      password: adminPassword,
      role: 'ADMIN_ENTREPRISE',
      entrepriseId: entreprise.id,
      active: true,
      twoFactorEnabled: false,
      premiereConnexion: false,
      telephone: '+221 77 200 00 00',
    },
  })
  console.log(`   ✅ ADMIN_ENTREPRISE: ${admin.email}\n`)

  // ─── 6. Create CONDUCTEUR ───────────────────────────────────
  console.log('👤 Creating CONDUCTEUR...')
  const conducteurPassword = await hashPassword('demo123')
  const conducteur = await prisma.user.create({
    data: {
      email: 'conducteur@opuc.demo',
      name: 'Ibrahim Sow',
      password: conducteurPassword,
      role: 'CONDUCTEUR',
      entrepriseId: entreprise.id,
      active: true,
      twoFactorEnabled: false,
      premiereConnexion: false,
      telephone: '+221 77 300 00 00',
    },
  })
  console.log(`   ✅ CONDUCTEUR: ${conducteur.email}\n`)

  // ─── 7. Create CHEF_CHANTIER ────────────────────────────────
  console.log('👤 Creating CHEF_CHANTIER...')
  const chefPassword = await hashPassword('demo123')
  const chefChantier = await prisma.user.create({
    data: {
      email: 'chef-chantier@opuc.demo',
      name: 'Omar Ba',
      password: chefPassword,
      role: 'CHEF_CHANTIER',
      entrepriseId: entreprise.id,
      active: true,
      twoFactorEnabled: false,
      premiereConnexion: false,
      telephone: '+221 77 400 00 00',
    },
  })
  console.log(`   ✅ CHEF_CHANTIER: ${chefChantier.email}\n`)

  // ─── 8. Create SOUS_TRAITANT ────────────────────────────────
  console.log('👤 Creating SOUS_TRAITANT...')
  const stPassword = await hashPassword('demo123')
  const sousTraitant = await prisma.user.create({
    data: {
      email: 'sous-traitant@opuc.demo',
      name: 'Aliou Diop',
      password: stPassword,
      role: 'SOUS_TRAITANT',
      entrepriseId: entreprise.id,
      active: true,
      twoFactorEnabled: false,
      premiereConnexion: false,
      telephone: '+221 77 500 00 00',
    },
  })
  console.log(`   ✅ SOUS_TRAITANT: ${sousTraitant.email}\n`)

  // ─── 9. Create demo chantier ────────────────────────────────
  console.log('🏗️  Creating demo chantier...')
  const chantier = await prisma.chantier.create({
    data: {
      nom: 'Centres Commerciaux Almadies',
      adresse: 'Almadies, Dakar',
      maitreOuvrage: 'Groupe IMF',
      dateDebut: new Date('2025-01-15'),
      dateFinPrevue: new Date('2025-12-31'),
      budgetPrevisionnel: 250000000,
      statut: 'EN_COURS',
      description: 'Construction de 3 immeubles R+5 avec parking souterrain',
      entrepriseId: entreprise.id,
    },
  })
  console.log(`   ✅ Chantier: ${chantier.nom} (ID: ${chantier.id})\n`)

  // ─── 10. Create demo phases ─────────────────────────────────
  console.log('📋 Creating demo phases...')
  const phases = [
    { nom: 'Gros Œuvre', ordre: 1, avancement: 65 },
    { nom: 'Second Œuvre', ordre: 2, avancement: 20 },
    { nom: 'Finitions', ordre: 3, avancement: 0 },
    { nom: 'Aménagement Extérieur', ordre: 4, avancement: 0 },
  ]

  for (const phase of phases) {
    await prisma.phase.create({
      data: {
        ...phase,
        dateDebut: new Date('2025-01-15'),
        chantierId: chantier.id,
      },
    })
  }
  console.log(`   ✅ ${phases.length} phases created\n`)

  // ─── 11. Create demo journaliers ────────────────────────────
  console.log('👷 Creating demo journaliers...')
  const journaliers = [
    { nom: 'Fall', prenom: 'Mamadou', specialite: 'Maçon', tauxJournalier: 5000 },
    { nom: 'Sy', prenom: 'Abdoulaye', specialite: 'Ferrailleur', tauxJournalier: 5500 },
    { nom: 'Diop', prenom: 'Cheikh', specialite: 'Électricien', tauxJournalier: 7000 },
    { nom: 'Niang', prenom: 'Pape', specialite: 'Plombier', tauxJournalier: 6500 },
    { nom: 'Camara', prenom: 'Moussa', specialite: 'Peintre', tauxJournalier: 5000 },
  ]

  for (const j of journaliers) {
    await prisma.journalier.create({
      data: {
        ...j,
        typeContrat: 'JOURNALIER',
        statutContrat: 'ACTIF',
        entrepriseId: entreprise.id,
      },
    })
  }
  console.log(`   ✅ ${journaliers.length} journaliers created\n`)

  // ─── 12. Create default permission configs ──────────────────
  console.log('🔐 Creating default permission configs...')
  const roles = ['SUPER_ADMIN', 'GERANT', 'ADMIN_ENTREPRISE', 'CONDUCTEUR', 'CHEF_CHANTIER', 'SOUS_TRAITANT']
  for (const role of roles) {
    await prisma.permissionConfig.upsert({
      where: { role },
      update: {},
      create: { role },
    })
  }
  console.log(`   ✅ ${roles.length} permission configs created\n`)

  // ─── 13. Create default system settings ─────────────────────
  console.log('⚙️  Creating default system settings...')
  const settings = [
    { cle: 'security.maxLoginAttempts', valeur: '5' },
    { cle: 'security.lockoutDuration', valeur: '15' },
    { cle: 'security.passwordMinLength', valeur: '8' },
    { cle: 'security.require2faForAdmin', valeur: 'false' },
    { cle: 'general.defaultCurrency', valeur: 'XOF' },
    { cle: 'general.dateFormat', valeur: 'dd/MM/yyyy' },
    { cle: 'general.language', valeur: 'fr' },
  ]

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: {
        entrepriseId_cle: {
          entrepriseId: entreprise.id,
          cle: setting.cle,
        },
      },
      update: { valeur: setting.valeur },
      create: {
        ...setting,
        entrepriseId: entreprise.id,
      },
    })
  }
  console.log(`   ✅ ${settings.length} system settings created\n`)

  // ─── Summary ────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════')
  console.log('✅ Seed completed successfully!')
  console.log('═══════════════════════════════════════════════')
  console.log('')
  console.log('📋 Demo Accounts:')
  console.log('   ┌─────────────────────┬────────────────────────────┬────────────┐')
  console.log('   │ Role                │ Email                       │ Password   │')
  console.log('   ├─────────────────────┼────────────────────────────┼────────────┤')
  console.log('   │ Super Admin         │ superadmin@opuc.demo         │ Admin@1234 │')
  console.log('   │ Gérant              │ chef-entreprise@opuc.demo   │ demo123    │')
  console.log('   │ Admin Entreprise    │ admin@opuc.demo             │ demo123    │')
  console.log('   │ Conducteur          │ conducteur@opuc.demo        │ demo123    │')
  console.log('   │ Chef Chantier       │ chef-chantier@opuc.demo     │ demo123    │')
  console.log('   │ Sous-traitant       │ sous-traitant@opuc.demo     │ demo123    │')
  console.log('   └─────────────────────┴────────────────────────────┴────────────┘')
  console.log('')
  console.log(`🏢 Entreprise: ${entreprise.nom}`)
  console.log(`🏗️  Chantier: ${chantier.nom}`)
  console.log(`👷 Journaliers: ${journaliers.length}`)
  console.log(`📋 Phases: ${phases.length}`)
  console.log('')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
