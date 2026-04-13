import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const categorie = searchParams.get('categorie')

    if (!chantierId) {
      return NextResponse.json(
        { error: 'Le paramètre chantierId est requis' },
        { status: 400 }
      )
    }

    const where: Prisma.StockMaterielWhereInput = {
      chantierId,
    }

    if (categorie && categorie.trim() && categorie !== 'TOUS') {
      where.categorie = categorie.trim()
    }

    const stocks = await db.stockMateriel.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            entrees: true,
            sorties: true,
          },
        },
        entrees: {
          select: {
            quantite: true,
            prixUnitaire: true,
          },
        },
        sorties: {
          select: {
            quantite: true,
          },
        },
      },
    })

    const stockItems = stocks.map((stock) => {
      const totalEntrees = stock.entrees.reduce(
        (sum, e) => sum + e.quantite,
        0
      )
      const totalSorties = stock.sorties.reduce(
        (sum, s) => sum + s.quantite,
        0
      )
      const quantiteDisponible = totalEntrees - totalSorties

      // Average unit price from entries
      const avgPrix =
        totalEntrees > 0
          ? stock.entrees.reduce((sum, e) => sum + e.prixUnitaire * e.quantite, 0) /
            totalEntrees
          : 0

      const valeurStock = quantiteDisponible * avgPrix

      return {
        id: stock.id,
        reference: stock.reference,
        designation: stock.designation,
        categorie: stock.categorie,
        unite: stock.unite,
        seuilAlerte: stock.seuilAlerte,
        chantierId: stock.chantierId,
        createdAt: stock.createdAt,
        updatedAt: stock.updatedAt,
        quantiteDisponible,
        valeurStock,
        avgPrix,
        enAlerte: quantiteDisponible <= stock.seuilAlerte,
        _count: stock._count,
      }
    })

    // KPI stats
    const totalMateriaux = stockItems.length
    const valeurTotale = stockItems.reduce((sum, s) => sum + s.valeurStock, 0)
    const articlesEnAlerte = stockItems.filter((s) => s.enAlerte).length

    return NextResponse.json({
      stocks: stockItems,
      kpi: {
        totalMateriaux,
        valeurTotale,
        articlesEnAlerte,
      },
    })
  } catch (error) {
    console.error('GET /api/stocks error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des stocks' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { chantierId, reference, designation, categorie, unite, seuilAlerte } =
      body

    if (!chantierId) {
      return NextResponse.json(
        { error: 'Le chantier est requis' },
        { status: 400 }
      )
    }

    if (!designation || designation.trim() === '') {
      return NextResponse.json(
        { error: 'La désignation est requise' },
        { status: 400 }
      )
    }

    if (!unite || unite.trim() === '') {
      return NextResponse.json(
        { error: "L'unité est requise" },
        { status: 400 }
      )
    }

    const stock = await db.stockMateriel.create({
      data: {
        chantierId,
        reference: reference?.trim() || '',
        designation: designation.trim(),
        categorie: categorie?.trim() || null,
        unite: unite.trim(),
        seuilAlerte: seuilAlerte ?? 0,
      },
    })

    return NextResponse.json(stock, { status: 201 })
  } catch (error) {
    console.error('POST /api/stocks error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création du matériau" },
      { status: 500 }
    )
  }
}
