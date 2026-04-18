import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/entreprises/[id]/status — Get entreprise status (public)
// Used by client polling to check if entreprise is active/suspended
// No auth required for this endpoint — it's a status check
// ═══════════════════════════════════════════════════════════
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const entreprise = await db.entreprise.findUnique({
      where: { id },
      select: {
        id: true,
        nom: true,
        status: true,
      },
    })

    if (!entreprise) {
      return NextResponse.json(
        { error: 'Entreprise non trouvée.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      entrepriseId: entreprise.id,
      nom: entreprise.nom,
      status: entreprise.status,
    })
  } catch (error) {
    console.error('GET /api/entreprises/[id]/status error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la vérification du statut' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/entreprises/[id]/status — Kill Switch (SUPER_ADMIN only)
// Body: { status: 'active' | 'suspended' | 'inactive' }
//
// When suspended:
//   - All users of the entreprise are deactivated (cannot log in)
//   - The auth middleware checks entreprise status at login time
//
// When reactivated (active):
//   - Users are NOT automatically reactivated
//   - Admin must manually reactivate individual users
//   - This gives admin granular control over who gets back in
// ═══════════════════════════════════════════════════════════
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireSuperAdmin(request)
    const { id } = await params

    const body = await request.json()
    const { status } = body

    // Validate status
    const validStatuses = ['active', 'suspended', 'inactive']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Statut invalide. Valeurs acceptées : ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const entreprise = await db.entreprise.findUnique({
      where: { id },
      select: {
        id: true,
        nom: true,
        status: true,
      },
    })

    if (!entreprise) {
      return NextResponse.json(
        { error: 'Entreprise non trouvée.' },
        { status: 404 }
      )
    }

    if (entreprise.status === status) {
      return NextResponse.json(
        { error: `L'entreprise est déjà en statut "${status}".` },
        { status: 400 }
      )
    }

    const previousStatus = entreprise.status

    // Update entreprise status
    const updatedEntreprise = await db.entreprise.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        nom: true,
        status: true,
        updatedAt: true,
      },
    })

    let deactivatedCount = 0

    // When suspending, deactivate all active users
    if (status === 'suspended') {
      const result = await db.user.updateMany({
        where: {
          entrepriseId: id,
          active: true,
        },
        data: {
          active: false,
        },
      })
      deactivatedCount = result.count
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: id,
        action: status === 'suspended' ? 'BLOCK' : 'ROLE_CHANGE',
        module: 'entreprises',
        entityType: 'Entreprise',
        entityId: id,
        details: `Kill switch: entreprise "${entreprise.nom}" passée de "${previousStatus}" à "${status}"${deactivatedCount > 0 ? ` (${deactivatedCount} utilisateur(s) désactivé(s))` : ''}`,
      },
    })

    return NextResponse.json({
      entreprise: updatedEntreprise,
      deactivatedUsers: deactivatedCount,
      message:
        status === 'suspended'
          ? `Entreprise "${entreprise.nom}" suspendue. ${deactivatedCount} utilisateur(s) désactivé(s).`
          : `Entreprise "${entreprise.nom}" passée en statut "${status}".`,
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PUT /api/entreprises/[id]/status error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la modification du statut' },
      { status: 500 }
    )
  }
}
