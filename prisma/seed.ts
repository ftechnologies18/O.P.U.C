import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding OPUC database...')

  // Clean up existing data
  console.log('🗑️  Cleaning existing data...')
  await prisma.notification.deleteMany()
  await prisma.photo.deleteMany()
  await prisma.sortieStock.deleteMany()
  await prisma.entreeStock.deleteMany()
  await prisma.stockMateriel.deleteMany()
  await prisma.rapportJournalier.deleteMany()
  await prisma.contratST.deleteMany()
  await prisma.locationEngin.deleteMany()
  await prisma.equipementAffectation.deleteMany()
  await prisma.equipement.deleteMany()
  await prisma.paiementHebdo.deleteMany()
  await prisma.pointage.deleteMany()
  await prisma.journalierAffectation.deleteMany()
  await prisma.journalier.deleteMany()
  await prisma.tache.deleteMany()
  await prisma.phase.deleteMany()
  await prisma.chantier.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()
  await prisma.entreprise.deleteMany()

  // Hash password for all demo users
  const hashedPassword = await bcrypt.hash('demo123', 12)

  // 1. Create default Entreprise
  console.log('🏢 Creating Entreprise...')
  const entreprise = await prisma.entreprise.create({
    data: {
      nom: 'OPUC Démo SARL',
      adresse: '45 Avenue Pasteur, Dakar, Sénégal',
      telephone: '+221 33 800 0000',
      email: 'contact@opuc-demo.sn',
    },
  })

  // 2. Create demo users
  console.log('👤 Creating demo users...')
  const admin = await prisma.user.create({
    data: {
      email: 'admin@opuc.demo',
      password: hashedPassword,
      name: 'Admin Système',
      role: 'ADMIN',
      telephone: '+221 77 100 0001',
      entrepriseId: entreprise.id,
      active: true,
    },
  })

  const chefEntreprise = await prisma.user.create({
    data: {
      email: 'chef-entreprise@opuc.demo',
      password: hashedPassword,
      name: 'Ahmed Benali',
      role: 'CHEF_ENTREPRISE',
      telephone: '+221 77 100 0002',
      entrepriseId: entreprise.id,
      active: true,
    },
  })

  const conducteur = await prisma.user.create({
    data: {
      email: 'conducteur@opuc.demo',
      password: hashedPassword,
      name: 'Karim Mensah',
      role: 'CONDUCTEUR',
      telephone: '+221 77 100 0003',
      entrepriseId: entreprise.id,
      active: true,
    },
  })

  const chefChantier = await prisma.user.create({
    data: {
      email: 'chef-chantier@opuc.demo',
      password: hashedPassword,
      name: 'Moussa Traoré',
      role: 'CHEF_CHANTIER',
      telephone: '+221 77 100 0004',
      entrepriseId: entreprise.id,
      active: true,
    },
  })

  // 3. Create demo Chantiers
  console.log('🏗️  Creating Chantiers...')
  const chantier1 = await prisma.chantier.create({
    data: {
      nom: 'Résidence Les Palmiers - Dakar',
      adresse: 'Route de Ngor, Dakar, Sénégal',
      maitreOuvrage: 'SCI Les Palmiers',
      dateDebut: new Date('2025-09-01'),
      dateFinPrevue: new Date('2026-12-31'),
      budgetPrevisionnel: 150000000,
      statut: 'EN_COURS',
      description: 'Construction d\'une résidence de 24 appartements T3/T4 sur 4 étages avec parking souterrain.',
      entrepriseId: entreprise.id,
    },
  })

  const chantier2 = await prisma.chantier.create({
    data: {
      nom: 'Centre Commercial Almadies',
      adresse: 'Corniche Ouest, Almadies, Dakar',
      maitreOuvrage: 'Groupe Almadies Investissement',
      dateDebut: new Date('2026-03-01'),
      dateFinPrevue: new Date('2027-09-30'),
      budgetPrevisionnel: 250000000,
      statut: 'EN_PREPARATION',
      description: 'Centre commercial de 3 niveaux avec 45 boutiques, espace alimentaire et parking de 200 places.',
      entrepriseId: entreprise.id,
    },
  })

  // 4. Create demo Journaliers
  console.log('👷 Creating Journaliers...')
  const journaliers = await Promise.all([
    prisma.journalier.create({
      data: {
        nom: 'Diop',
        prenom: 'Ibrahima',
        telephone: '+221 78 200 0001',
        specialite: 'Maçon',
        entrepriseId: entreprise.id,
      },
    }),
    prisma.journalier.create({
      data: {
        nom: 'Ndiaye',
        prenom: 'Ousmane',
        telephone: '+221 78 200 0002',
        specialite: 'Ferrailleur',
        entrepriseId: entreprise.id,
      },
    }),
    prisma.journalier.create({
      data: {
        nom: 'Sow',
        prenom: 'Mamadou',
        telephone: '+221 78 200 0003',
        specialite: 'Électricien',
        entrepriseId: entreprise.id,
      },
    }),
    prisma.journalier.create({
      data: {
        nom: 'Fall',
        prenom: 'Abdoulaye',
        telephone: '+221 78 200 0004',
        specialite: 'Plombier',
        entrepriseId: entreprise.id,
      },
    }),
    prisma.journalier.create({
      data: {
        nom: 'Ba',
        prenom: 'Cheikh',
        telephone: '+221 78 200 0005',
        specialite: 'Peintre',
        entrepriseId: entreprise.id,
      },
    }),
  ])

  // 5. Assign journaliers to chantier 1
  console.log('📋 Creating Journalier affectations...')
  for (const j of journaliers) {
    await prisma.journalierAffectation.create({
      data: {
        journalierId: j.id,
        chantierId: chantier1.id,
        dateDebut: new Date('2025-09-01'),
        actif: true,
      },
    })
  }

  // 6. Create phases for chantier 1
  console.log('📊 Creating Phases...')
  const phases = await Promise.all([
    prisma.phase.create({
      data: {
        nom: 'Fondations',
        ordre: 1,
        description: 'Travaux de fondations profondes et semelles',
        avancement: 100,
        dateDebut: new Date('2025-09-01'),
        dateFin: new Date('2025-10-31'),
        chantierId: chantier1.id,
      },
    }),
    prisma.phase.create({
      data: {
        nom: 'Gros œuvre',
        ordre: 2,
        description: 'Élévation des murs, dalles et structure en béton armé',
        avancement: 65,
        dateDebut: new Date('2025-11-01'),
        dateFin: new Date('2026-04-30'),
        chantierId: chantier1.id,
      },
    }),
    prisma.phase.create({
      data: {
        nom: 'Second œuvre',
        ordre: 3,
        description: 'Menuiseries, plomberie, électricité, cloisons',
        avancement: 0,
        dateDebut: new Date('2026-05-01'),
        dateFin: new Date('2026-08-31'),
        chantierId: chantier1.id,
      },
    }),
    prisma.phase.create({
      data: {
        nom: 'Finitions',
        ordre: 4,
        description: 'Peinture, carrelage, revêtements de sol',
        avancement: 0,
        dateDebut: new Date('2026-09-01'),
        dateFin: new Date('2026-11-15'),
        chantierId: chantier1.id,
      },
    }),
    prisma.phase.create({
      data: {
        nom: 'Réception',
        ordre: 5,
        description: 'Nettoyage, contrôles techniques et réception des travaux',
        avancement: 0,
        dateDebut: new Date('2026-11-16'),
        dateFin: new Date('2026-12-31'),
        chantierId: chantier1.id,
      },
    }),
  ])

  // 7. Create tasks within phases
  console.log('✅ Creating Tâches...')
  await prisma.tache.createMany({
    data: [
      // Phase 1 - Fondations (all completed)
      { nom: 'Terrassement', description: 'Terrassement général du terrain', ordre: 1, avancement: 100, statut: 'TERMINEE', dateDebut: new Date('2025-09-01'), dateFin: new Date('2025-09-15'), phaseId: phases[0].id },
      { nom: 'Fouilles et semelles', description: 'Fouilles des semelles et coulage béton', ordre: 2, avancement: 100, statut: 'TERMINEE', dateDebut: new Date('2025-09-16'), dateFin: new Date('2025-10-15'), phaseId: phases[0].id },
      { nom: 'Radiers', description: 'Couverture des radiers en béton armé', ordre: 3, avancement: 100, statut: 'TERMINEE', dateDebut: new Date('2025-10-16'), dateFin: new Date('2025-10-31'), phaseId: phases[0].id },
      // Phase 2 - Gros œuvre
      { nom: 'Voiles RDC', description: 'Coulage des voiles du rez-de-chaussée', ordre: 1, avancement: 100, statut: 'TERMINEE', dateDebut: new Date('2025-11-01'), dateFin: new Date('2025-11-30'), phaseId: phases[1].id },
      { nom: 'Dalle RDC', description: 'Coulage de la dalle du rez-de-chaussée', ordre: 2, avancement: 100, statut: 'TERMINEE', dateDebut: new Date('2025-12-01'), dateFin: new Date('2025-12-20'), phaseId: phases[1].id },
      { nom: 'Voiles 1er étage', description: 'Coulage des voiles du 1er étage', ordre: 3, avancement: 100, statut: 'TERMINEE', dateDebut: new Date('2026-01-05'), dateFin: new Date('2026-01-31'), phaseId: phases[1].id },
      { nom: 'Dalle 1er étage', description: 'Coulage de la dalle du 1er étage', ordre: 4, avancement: 85, statut: 'EN_COURS', dateDebut: new Date('2026-02-01'), dateFin: new Date('2026-02-20'), phaseId: phases[1].id, responsableId: chefChantier.id },
      { nom: 'Voiles 2ème étage', description: 'Coulage des voiles du 2ème étage', ordre: 5, avancement: 10, statut: 'EN_COURS', dateDebut: new Date('2026-02-21'), dateFin: new Date('2026-03-20'), phaseId: phases[1].id, responsableId: conducteur.id },
    ],
  })

  // 8. Create demo pointages
  console.log('📝 Creating Pointages...')
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const twoDaysAgo = new Date(today)
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const threeDaysAgo = new Date(today)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  const pointageDates = [today, yesterday, twoDaysAgo, threeDaysAgo]

  for (const date of pointageDates) {
    for (const j of journaliers.slice(0, 4)) {
      await prisma.pointage.create({
        data: {
          journalierId: j.id,
          chantierId: chantier1.id,
          chefChantierId: chefChantier.id,
          dateTravail: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          tauxJournalier: 5000,
          present: true,
          observation: '',
          valide: date < today,
        },
      })
    }
  }

  // 9. Create demo stock materials
  console.log('📦 Creating Stock materials...')
  const stocks = [
    { reference: 'CIM-CEM42', designation: 'Ciment CEM II 42.5', categorie: 'gros_oeuvre', unite: 'sac', seuilAlerte: 50, quantiteInitiale: 320 },
    { reference: 'GRV-10/12', designation: 'Gravier 10/12mm', categorie: 'gros_oeuvre', unite: 'm3', seuilAlerte: 5, quantiteInitiale: 18 },
    { reference: 'SAB-LAV', designation: 'Sable de lavage', categorie: 'gros_oeuvre', unite: 'm3', seuilAlerte: 5, quantiteInitiale: 12 },
    { reference: 'FER-HA12', designation: 'Fer à béton HA12', categorie: 'gros_oeuvre', unite: 'kg', seuilAlerte: 500, quantiteInitiale: 2800 },
    { reference: 'FER-HA10', designation: 'Fer à béton HA10', categorie: 'gros_oeuvre', unite: 'kg', seuilAlerte: 300, quantiteInitiale: 1500 },
    { reference: 'FER-HA8', designation: 'Fer à béton HA8', categorie: 'gros_oeuvre', unite: 'kg', seuilAlerte: 200, quantiteInitiale: 800 },
    { reference: 'BET-CPJ35', designation: 'Béton CPJ 35 prêt à l\'emploi', categorie: 'gros_oeuvre', unite: 'm3', seuilAlerte: 10, quantiteInitiale: 45 },
    { reference: 'BRQ-PLE', designation: 'Briques pleines 20x20x40', categorie: 'gros_oeuvre', unite: 'u', seuilAlerte: 500, quantiteInitiale: 3200 },
  ]

  for (const stock of stocks) {
    const stockItem = await prisma.stockMateriel.create({
      data: {
        reference: stock.reference,
        designation: stock.designation,
        categorie: stock.categorie,
        unite: stock.unite,
        seuilAlerte: stock.seuilAlerte,
        chantierId: chantier1.id,
      },
    })

    // Create initial stock entry
    await prisma.entreeStock.create({
      data: {
        stockId: stockItem.id,
        chantierId: chantier1.id,
        quantite: stock.quantiteInitiale,
        prixUnitaire: stock.unite === 'sac' ? 7500 : stock.unite === 'm3' ? 35000 : stock.unite === 'kg' ? 650 : 175,
        fournisseur: 'SOGEA-SATOM',
        numeroBL: `BL-${new Date().getFullYear()}-001`,
        dateEntree: new Date('2025-09-01'),
      },
    })
  }

  // 10. Create a demo daily report
  console.log('📋 Creating Rapport Journalier...')
  await prisma.rapportJournalier.create({
    data: {
      chantierId: chantier1.id,
      auteurId: chefChantier.id,
      dateRapport: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      meteo: 'ensoleillé',
      effectifPresent: 4,
      travauxRealises: 'Couverture voiles 2ème étage - Avancement ferraillage et coffrage. Continuité coulage dalle 1er étage. Contrôle qualité béton effectué.',
      incidents: '',
      observations: 'Livraison ciment prévue demain matin. Vérifier stock de fer HA10.',
    },
  })

  // 11. Create demo notifications
  console.log('🔔 Creating Notifications...')
  await prisma.notification.createMany({
    data: [
      {
        userId: admin.id,
        titre: 'Stock critique',
        message: 'Le stock de Sable de lavage est proche du seuil d\'alerte (12 m3 restants, seuil: 5 m3).',
        type: 'STOCK_ALERT',
        lu: false,
      },
      {
        userId: chefEntreprise.id,
        titre: 'Nouveau rapport journalier',
        message: 'Moussa Traoré a soumis le rapport journalier du chantier Résidence Les Palmiers.',
        type: 'DOCUMENT',
        lu: false,
      },
      {
        userId: chefChantier.id,
        titre: 'Tâche en retard',
        message: 'La tâche "Voiles 2ème étage" accuse un retard estimé à 3 jours.',
        type: 'TACHE_RETARD',
        lu: false,
      },
      {
        userId: admin.id,
        titre: 'Budget - Alerte',
        message: 'Le chantier Résidence Les Palmiers a consommé 42% du budget prévisionnel.',
        type: 'BUDGET_ALERT',
        lu: true,
      },
    ],
  })

  console.log('✅ Seeding completed successfully!')
  console.log('')
  console.log('📧 Demo credentials:')
  console.log('   Admin:           admin@opuc.demo / demo123')
  console.log('   Chef entreprise: chef-entreprise@opuc.demo / demo123')
  console.log('   Conducteur:      conducteur@opuc.demo / demo123')
  console.log('   Chef chantier:   chef-chantier@opuc.demo / demo123')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
