import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/entreprises/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const entreprise = await db.entreprise.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            chantiers: true,
            journaliers: true,
          },
        },
      },
    })

    if (!entreprise) {
      return NextResponse.json({ error: 'Entreprise non trouvée' }, { status: 404 })
    }

    return NextResponse.json({ entreprise })
  } catch (error) {
    console.error('GET /api/entreprises/[id] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/entreprises/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { nom, adresse, telephone, email } = body

    const existing = await db.entreprise.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Entreprise non trouvée' }, { status: 404 })
    }

    const entreprise = await db.entreprise.update({
      where: { id },
      data: {
        ...(nom ? { nom: nom.trim() } : {}),
        ...(adresse !== undefined ? { adresse: adresse?.trim() || null } : {}),
        ...(telephone !== undefined ? { telephone: telephone?.trim() || null } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: (session.user as { id: string }).id,
        action: 'UPDATE',
        module: 'entreprises',
        entityType: 'Entreprise',
        entityId: id,
        details: `Modification de l'entreprise "${entreprise.nom}"`,
      },
    })

    return NextResponse.json({ entreprise })
  } catch (error) {
    console.error('PUT /api/entreprises/[id] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/entreprises/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    const existing = await db.entreprise.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Entreprise non trouvée' }, { status: 404 })
    }

    await db.entreprise.delete({ where: { id } })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: (session.user as { id: string }).id,
        action: 'DELETE',
        module: 'entreprises',
        entityType: 'Entreprise',
        entityId: id,
        details: `Suppression de l'entreprise "${existing.nom}"`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/entreprises/[id] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
