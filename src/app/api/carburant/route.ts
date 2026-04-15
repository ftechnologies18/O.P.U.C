import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')

    if (!chantierId) {
      return NextResponse.json(
        { error: 'Le paramètre chantierId est requis' },
        { status: 400 }
      )
    }

    // Get chantier modeCarburant
    const chantier = await db.chantier.findUnique({
      where: { id: chantierId },
      select: { id: true, nom: true, modeCarburant: true },
    })

    if (!chantier) {
      return NextResponse.json(
        { error: 'Chantier non trouvé' },
        { status: 404 }
      )
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // Get all fuel stocks for this chantier with computed quantities
    const stocksCarburant = await db.stockCarburant.findMany({
      where: { chantierId },
      include: {
        _count: { select: { entrees: true, sorties: true } },
        entrees: { select: { quantite: true } },
        sorties: { select: { quantite: true } },
      },
    })

    const stocksData = stocksCarburant.map((stock) => {
      const totalEntrees = stock.entrees.reduce((sum, e) => sum + e.quantite, 0)
      const totalSorties = stock.sorties.reduce((sum, s) => sum + s.quantite, 0)
      const quantiteDisponible = totalEntrees - totalSorties
      return {
        id: stock.id,
        chantierId: stock.chantierId,
        typeCarburant: stock.typeCarburant,
        capacite: stock.capacite,
        seuilAlerte: stock.seuilAlerte,
        createdAt: stock.createdAt,
        updatedAt: stock.updatedAt,
        quantiteDisponible,
        enAlerte: quantiteDisponible <= stock.seuilAlerte,
        _count: stock._count,
      }
    })

    // Total stock disponible (sum of all stock quantities for STOCK_PHYSIQUE mode)
    const totalStockDisponible = stocksData.reduce(
      (sum, s) => sum + Math.max(0, s.quantiteDisponible),
      0
    )

    // Total achats directs for ACHAT_DIRECT mode
    const achatsDirects = await db.bonAchatCarburant.findMany({
      where: { chantierId, dateAchat: { gte: startOfMonth, lte: endOfMonth } },
      select: { prixTotal: true, quantite: true },
    })
    const totalAchatsDirect = achatsDirects.reduce((sum, a) => sum + a.prixTotal, 0)

    // Cost calculations for current month
    const entreesMois = await db.entreeCarburant.findMany({
      where: {
        chantierId,
        dateEntree: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { prixTotal: true },
    })

    const coutEntrees = entreesMois.reduce((sum, e) => sum + e.prixTotal, 0)

    // Total litres consommes this month (sorties for stock mode + achats for direct mode)
    const sortiesMois = await db.sortieCarburant.findMany({
      where: {
        chantierId,
        dateSortie: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { quantite: true },
    })
    const litresSorties = sortiesMois.reduce((sum, s) => sum + s.quantite, 0)
    const litresAchats = achatsDirects.reduce((sum, a) => sum + a.quantite, 0)

    const coutTotal = coutEntrees + totalAchatsDirect
    const totalLitresConsommes = litresSorties + litresAchats

    // Recent items for the last 30 days
    const recentBonAchats = await db.bonAchatCarburant.findMany({
      where: { chantierId, dateAchat: { gte: thirtyDaysAgo } },
      orderBy: { dateAchat: 'desc' },
      include: {
        equipement: {
          select: { id: true, designation: true, immatriculation: true },
        },
      },
    })

    const recentSorties = await db.sortieCarburant.findMany({
      where: { chantierId, dateSortie: { gte: thirtyDaysAgo } },
      orderBy: { dateSortie: 'desc' },
      include: {
        stock: {
          select: { id: true, typeCarburant: true },
        },
        equipement: {
          select: { id: true, designation: true, immatriculation: true },
        },
      },
    })

    const recentReleves = await db.releveCompteurEngin.findMany({
      where: { chantierId, dateReleve: { gte: thirtyDaysAgo } },
      orderBy: { dateReleve: 'desc' },
      include: {
        equipement: {
          select: { id: true, designation: true, immatriculation: true },
        },
      },
    })

    return NextResponse.json({
      modeCarburant: chantier.modeCarburant,
      kpi: {
        totalStockDisponible,
        totalAchatsDirect,
        coutTotal,
        totalLitresConsommes,
      },
      stocksCarburant: stocksData,
      recentBonAchats,
      recentSorties,
      recentReleves,
    })
  } catch (error) {
    console.error('GET /api/carburant error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des données carburant' },
      { status: 500 }
    )
  }
}
