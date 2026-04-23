import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/tenant'
import { AuthError, ForbiddenError } from '@/lib/tenant'

// ═══════════════════════════════════════════════════════════
// GET /api/clients/[id] — Get a single client with related counts
// Multi-tenant: only accessible if client belongs to user's entreprise
// ═══════════════════════════════════════════════════════════
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

    const client = await db.client.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            chantiers: true,
            devis: true,
            contrats: true,
            factures: true,
            tickets: true,
          },
        },
        chantiers: {
          select: {
            id: true,
            nom: true,
            statut: true,
            dateDebut: true,
            dateFinPrevue: true,
            budgetPrevisionnel: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        contrats: {
          select: {
            id: true,
            numero: true,
            objet: true,
            typeContrat: true,
            montantTTC: true,
            statut: true,
            dateDebut: true,
            dateFin: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client non trouvé.' }, { status: 404 })
    }

    // Multi-tenant check: non-super-admin can only access their own entreprise's clients
    if (!ctx.isSuperAdmin && ctx.entrepriseId && client.entrepriseId !== ctx.entrepriseId) {
      return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
    }

    return NextResponse.json({ client })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/clients/[id] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════
// PUT /api/clients/[id] — Update a client
// Body: any subset of { raisonSociale, nomContact, telephone, email,
//         adresse, rccm, nif, type, statut, notes }
// ═══════════════════════════════════════════════════════════
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

    const existing = await db.client.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Client non trouvé.' }, { status: 404 })
    }

    // Multi-tenant check
    if (!ctx.isSuperAdmin && ctx.entrepriseId && existing.entrepriseId !== ctx.entrepriseId) {
      return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
    }

    const body = await request.json()
    const {
      raisonSociale,
      nomContact,
      telephone,
      email,
      adresse,
      rccm,
      nif,
      type,
      statut,
      notes,
    } = body

    // Validate type if provided
    if (type) {
      const validTypes = ['ENTREPRISE', 'PARTICULIER', 'INSTITUTION']
      if (!validTypes.includes(type.trim())) {
        return NextResponse.json(
          { error: `Type invalide. Valeurs acceptées : ${validTypes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate statut if provided
    if (statut) {
      const validStatuts = ['ACTIF', 'INACTIF', 'PROSPECT']
      if (!validStatuts.includes(statut.trim())) {
        return NextResponse.json(
          { error: `Statut invalide. Valeurs acceptées : ${validStatuts.join(', ')}` },
          { status: 400 }
        )
      }
    }

    const client = await db.client.update({
      where: { id },
      data: {
        ...(raisonSociale !== undefined ? { raisonSociale: raisonSociale.trim() } : {}),
        ...(nomContact !== undefined ? { nomContact: nomContact?.trim() || null } : {}),
        ...(telephone !== undefined ? { telephone: telephone?.trim() || null } : {}),
        ...(email !== undefined ? { email: email?.trim().toLowerCase() || null } : {}),
        ...(adresse !== undefined ? { adresse: adresse?.trim() || null } : {}),
        ...(rccm !== undefined ? { rccm: rccm?.trim() || null } : {}),
        ...(nif !== undefined ? { nif: nif?.trim() || null } : {}),
        ...(type !== undefined ? { type: type.trim() } : {}),
        ...(statut !== undefined ? { statut: statut.trim() } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: existing.entrepriseId,
        action: 'UPDATE',
        module: 'clients',
        entityType: 'Client',
        entityId: id,
        details: `Modification du client "${client.raisonSociale}"`,
      },
    })

    return NextResponse.json({ client })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PUT /api/clients/[id] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE /api/clients/[id] — Soft delete (set statut to INACTIF)
// Checks for active contracts before allowing deletion
// ═══════════════════════════════════════════════════════════
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

    const existing = await db.client.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            contrats: true,
            factures: true,
            chantiers: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Client non trouvé.' }, { status: 404 })
    }

    // Multi-tenant check
    if (!ctx.isSuperAdmin && ctx.entrepriseId && existing.entrepriseId !== ctx.entrepriseId) {
      return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
    }

    // Check for active contracts (ACTIF or EN_PREPARATION)
    if (existing._count.contrats > 0) {
      const activeContracts = await db.contrat.count({
        where: {
          clientId: id,
          statut: { in: ['ACTIF', 'EN_PREPARATION'] },
        },
      })

      if (activeContracts > 0) {
        return NextResponse.json(
          {
            error: `Impossible de désactiver ce client. Il possède ${activeContracts} contrat(s) actif(s). Veuillez d'abord clôturer ou résilier les contrats actifs.`,
          },
          { status: 409 }
        )
      }
    }

    // Soft delete: set statut to INACTIF
    const client = await db.client.update({
      where: { id },
      data: { statut: 'INACTIF' },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: ctx.userId,
        entrepriseId: existing.entrepriseId,
        action: 'DELETE',
        module: 'clients',
        entityType: 'Client',
        entityId: id,
        details: `Désactivation du client "${existing.raisonSociale}" (soft delete) — ${existing._count.contrats} contrat(s), ${existing._count.factures} facture(s), ${existing._count.chantiers} chantier(s)`,
      },
    })

    return NextResponse.json({ client, message: 'Client désactivé avec succès.' })
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('DELETE /api/clients/[id] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
