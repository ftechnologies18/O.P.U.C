import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/entreprises — List all entreprises
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || null
    const statut = searchParams.get('statut')?.trim() || null
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { nom: { contains: search } },
        { email: { contains: search } },
        { telephone: { contains: search } },
      ]
    }

    if (statut && statut !== 'TOUS') {
      where.statut = statut
    }

    const total = await db.entreprise.count({ where })

    const entreprises = await db.entreprise.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: {
            users: true,
            chantiers: true,
          },
        },
      },
    })

    return NextResponse.json({
      entreprises,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('GET /api/entreprises error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des entreprises' },
      { status: 500 }
    )
  }
}

// POST /api/entreprises — Create a new entreprise
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { nom, adresse, telephone, email, gerantName, gerantEmail, gerantPassword } = body

    if (!nom || nom.trim() === '') {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }

    const entreprise = await db.entreprise.create({
      data: {
        nom: nom.trim(),
        adresse: adresse?.trim() || null,
        telephone: telephone?.trim() || null,
        email: email?.trim() || null,
      },
    })

    // If gerant info provided, create the GERANT user
    let gerant = null
    if (gerantName && gerantEmail && gerantPassword) {
      const bcrypt = await import('bcryptjs')
      const hashedPassword = await bcrypt.hash(gerantPassword.trim(), 10)

      gerant = await db.user.create({
        data: {
          name: gerantName.trim(),
          email: gerantEmail.trim().toLowerCase(),
          password: hashedPassword,
          role: 'GERANT',
          entrepriseId: entreprise.id,
          telephone: null,
        },
      })
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: (session.user as { id: string }).id,
        action: 'CREATE',
        module: 'entreprises',
        entityType: 'Entreprise',
        entityId: entreprise.id,
        details: `Création de l'entreprise "${entreprise.nom}"`,
      },
    })

    return NextResponse.json({ entreprise, gerant }, { status: 201 })
  } catch (error) {
    console.error('POST /api/entreprises error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la création de l'entreprise" },
      { status: 500 }
    )
  }
}
