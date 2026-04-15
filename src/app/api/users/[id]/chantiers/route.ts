import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/users/[id]/chantiers — Get chantier accesses for a user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { id } = await params

    // Check user exists
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    // Get chantier accesses with chantier details
    const accesses = await db.userChantierAccess.findMany({
      where: { userId: id },
      include: {
        chantier: {
          select: {
            id: true,
            nom: true,
            statut: true,
            adresse: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      user,
      accesses,
    })
  } catch (error) {
    console.error('GET /api/users/[id]/chantiers error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la récupération des accès chantier" },
      { status: 500 }
    )
  }
}

// PUT /api/users/[id]/chantiers — Set chantier accesses for a user
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
    const sessionUserId = (session.user as { id: string }).id

    // Check user exists
    const user = await db.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { chantiers } = body

    if (!chantiers || !Array.isArray(chantiers)) {
      return NextResponse.json(
        { error: 'Le champ "chantiers" est requis et doit être un tableau' },
        { status: 400 }
      )
    }

    // Validate each chantier access entry
    const validRolesAcces = ['LECTURE', 'ECRITURE', 'GESTION']

    for (const entry of chantiers) {
      if (!entry.chantierId || typeof entry.chantierId !== 'string') {
        return NextResponse.json(
          { error: 'Chaque accès doit avoir un chantierId valide' },
          { status: 400 }
        )
      }

      // Check chantier exists
      const chantier = await db.chantier.findUnique({
        where: { id: entry.chantierId },
      })
      if (!chantier) {
        return NextResponse.json(
          { error: `Chantier avec l'ID "${entry.chantierId}" non trouvé` },
          { status: 404 }
        )
      }

      const roleAcces = entry.roleAcces || 'LECTURE'
      if (!validRolesAcces.includes(roleAcces)) {
        return NextResponse.json(
          { error: `Rôle d'accès invalide "${roleAcces}". Valeurs acceptées : ${validRolesAcces.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Delete existing accesses
    await db.userChantierAccess.deleteMany({
      where: { userId: id },
    })

    // Create new accesses
    if (chantiers.length > 0) {
      await db.userChantierAccess.createMany({
        data: chantiers.map((entry: { chantierId: string; roleAcces: string }) => ({
          userId: id,
          chantierId: entry.chantierId,
          roleAcces: entry.roleAcces || 'LECTURE',
        })),
      })
    }

    // Fetch the newly created accesses for response
    const newAccesses = await db.userChantierAccess.findMany({
      where: { userId: id },
      include: {
        chantier: {
          select: {
            id: true,
            nom: true,
            statut: true,
            adresse: true,
          },
        },
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: sessionUserId,
        entrepriseId: (session.user as { entrepriseId?: string }).entrepriseId || null,
        action: 'UPDATE',
        module: 'users',
        entityType: 'User',
        entityId: id,
        details: `Mise à jour des accès chantier de l'utilisateur "${user.name}" (${user.email}): ${chantiers.length} accès définis`,
      },
    })

    return NextResponse.json({
      success: true,
      accesses: newAccesses,
    })
  } catch (error) {
    console.error('PUT /api/users/[id]/chantiers error:', error)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour des accès chantier" },
      { status: 500 }
    )
  }
}
