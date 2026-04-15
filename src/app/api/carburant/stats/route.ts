import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const moisParam = searchParams.get('mois')
    const anneeParam = searchParams.get('annee')

    if (!chantierId) {
      return NextResponse.json(
        { error: 'Le paramètre chantierId est requis' },
        { status: 400 }
      )
    }

    // Target month/year, default to current
    const now = new Date()
    const mois = moisParam ? parseInt(moisParam, 10) : now.getMonth() + 1
    const annee = anneeParam ? parseInt(anneeParam, 10) : now.getFullYear()

    // Build date range for target month
    const startOfMonth = new Date(annee, mois - 1, 1)
    const endOfMonth = new Date(annee, mois, 0, 23, 59, 59, 999)

    // Get chantier info for mode
    const chantier = await db.chantier.findUnique({
      where: { id: chantierId },
      select: { modeCarburant: true },
    })
    if (!chantier) {
      return NextResponse.json(
        { error: 'Chantier non trouvé' },
        { status: 404 }
      )
    }

    // === Cost totals for the target month ===
    const entreesMois = await db.entreeCarburant.findMany({
      where: {
        chantierId,
        dateEntree: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { prixTotal: true, quantite: true },
    })

    const achatsMois = await db.bonAchatCarburant.findMany({
      where: {
        chantierId,
        dateAchat: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { prixTotal: true, quantite: true, prixUnitaire: true },
    })

    const coutEntrees = entreesMois.reduce((sum, e) => sum + e.prixTotal, 0)
    const coutAchats = achatsMois.reduce((sum, a) => sum + a.prixTotal, 0)
    const litresEntrees = entreesMois.reduce((sum, e) => sum + e.quantite, 0)
    const litresAchats = achatsMois.reduce((sum, a) => sum + a.quantite, 0)

    const coutTotalMois = coutEntrees + coutAchats
    const litresTotalMois = litresEntrees + litresAchats

    // === Consumption per equipment for the target month ===
    // Sorties (stock mode)
    const sortiesMois = await db.sortieCarburant.findMany({
      where: {
        chantierId,
        dateSortie: { gte: startOfMonth, lte: endOfMonth },
        equipementId: { not: null },
      },
      include: {
        equipement: {
          select: { id: true, designation: true, immatriculation: true },
        },
      },
    })

    // Achats with equipment (direct mode)
    const achatsEnginMois = await db.bonAchatCarburant.findMany({
      where: {
        chantierId,
        dateAchat: { gte: startOfMonth, lte: endOfMonth },
        equipementId: { not: null },
      },
      include: {
        equipement: {
          select: { id: true, designation: true, immatriculation: true },
        },
      },
    })

    // Aggregate consumption per equipment
    const consoMap = new Map<string, {
      equipementId: string
      designation: string
      litresConsommes: number
      coutTotal: number
      heuresFonctionnement: number
      compteurDebut: number
      compteurFin: number
    }>()

    // Process sorties
    for (const s of sortiesMois) {
      if (!s.equipementId) continue
      const key = s.equipementId
      if (!consoMap.has(key)) {
        consoMap.set(key, {
          equipementId: key,
          designation: s.equipement?.designation || 'Inconnu',
          litresConsommes: 0,
          coutTotal: 0,
          heuresFonctionnement: 0,
          compteurDebut: Infinity,
          compteurFin: -Infinity,
        })
      }
      const entry = consoMap.get(key)!
      entry.litresConsommes += s.quantite

      if (s.compteurHeuresAvant !== null && s.compteurHeuresAvant !== undefined) {
        entry.compteurDebut = Math.min(entry.compteurDebut, s.compteurHeuresAvant)
      }
      if (s.compteurHeuresApres !== null && s.compteurHeuresApres !== undefined) {
        entry.compteurFin = Math.max(entry.compteurFin, s.compteurHeuresApres)
      }
    }

    // Process achats direct
    for (const a of achatsEnginMois) {
      if (!a.equipementId) continue
      const key = a.equipementId
      if (!consoMap.has(key)) {
        consoMap.set(key, {
          equipementId: key,
          designation: a.equipement?.designation || 'Inconnu',
          litresConsommes: 0,
          coutTotal: 0,
          heuresFonctionnement: 0,
          compteurDebut: Infinity,
          compteurFin: -Infinity,
        })
      }
      const entry = consoMap.get(key)!
      entry.litresConsommes += a.quantite
      entry.coutTotal += a.prixTotal

      if (a.compteurHeuresAvant !== null && a.compteurHeuresAvant !== undefined) {
        entry.compteurDebut = Math.min(entry.compteurDebut, a.compteurHeuresAvant)
      }
      if (a.compteurHeuresApres !== null && a.compteurHeuresApres !== undefined) {
        entry.compteurFin = Math.max(entry.compteurFin, a.compteurHeuresApres)
      }
    }

    // Calculate hours of operation and conso per hour
    const consommationParEngin = Array.from(consoMap.values()).map((entry) => {
      let heuresFonctionnement = 0
      if (entry.compteurFin !== -Infinity && entry.compteurDebut !== Infinity) {
        heuresFonctionnement = Math.max(0, entry.compteurFin - entry.compteurDebut)
      }

      const consoLitresParHeure =
        heuresFonctionnement > 0 ? entry.litresConsommes / heuresFonctionnement : 0

      return {
        equipementId: entry.equipementId,
        designation: entry.designation,
        litresConsommes: Math.round(entry.litresConsommes * 100) / 100,
        heuresFonctionnement: Math.round(heuresFonctionnement * 100) / 100,
        consoLitresParHeure: Math.round(consoLitresParHeure * 100) / 100,
        coutTotal: Math.round(entry.coutTotal * 100) / 100,
      }
    }).sort((a, b) => b.litresConsommes - a.litresConsommes)

    // === Average price per liter ===
    const totalLitres = litresEntrees + litresAchats
    const totalCout = coutEntrees + coutAchats
    const coutMoyenLitre = totalLitres > 0 ? totalCout / totalLitres : 0

    // === Monthly trend (last 6 months) ===
    const tendanceMensuelle: Array<{
      mois: number
      annee: number
      litres: number
      cout: number
    }> = []

    for (let i = 5; i >= 0; i--) {
      const trendDate = new Date(annee, mois - 1 - i, 1)
      const trendMois = trendDate.getMonth() + 1
      const trendAnnee = trendDate.getFullYear()
      const trendStart = new Date(trendAnnee, trendMois - 1, 1)
      const trendEnd = new Date(trendAnnee, trendMois, 0, 23, 59, 59, 999)

      const [trendEntrees, trendAchats] = await Promise.all([
        db.entreeCarburant.aggregate({
          where: {
            chantierId,
            dateEntree: { gte: trendStart, lte: trendEnd },
          },
          _sum: { quantite: true, prixTotal: true },
        }),
        db.bonAchatCarburant.aggregate({
          where: {
            chantierId,
            dateAchat: { gte: trendStart, lte: trendEnd },
          },
          _sum: { quantite: true, prixTotal: true },
        }),
      ])

      const litres =
        (trendEntrees._sum.quantite || 0) + (trendAchats._sum.quantite || 0)
      const cout =
        (trendEntrees._sum.prixTotal || 0) + (trendAchats._sum.prixTotal || 0)

      tendanceMensuelle.push({
        mois: trendMois,
        annee: trendAnnee,
        litres: Math.round(litres * 100) / 100,
        cout: Math.round(cout * 100) / 100,
      })
    }

    return NextResponse.json({
      mois,
      annee,
      modeCarburant: chantier.modeCarburant,
      coutTotalMois: Math.round(coutTotalMois * 100) / 100,
      litresTotalMois: Math.round(litresTotalMois * 100) / 100,
      coutMoyenLitre: Math.round(coutMoyenLitre * 100) / 100,
      consommationParEngin,
      tendanceMensuelle,
    })
  } catch (error) {
    console.error('GET /api/carburant/stats error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques carburant' },
      { status: 500 }
    )
  }
}
