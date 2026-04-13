import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET — Payment detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const paiement = await db.paiementHebdo.findUnique({
      where: { id },
      include: {
        journalier: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            specialite: true,
            telephone: true,
          },
        },
        validePar: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    })

    if (!paiement) {
      return NextResponse.json(
        { error: 'Paiement non trouvé' },
        { status: 404 }
      )
    }

    // Fetch related pointages for this journalier+chantier+week
    const weekStart = new Date(paiement.semaineDebut)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(paiement.semaineFin)
    weekEnd.setHours(23, 59, 59, 999)

    const pointages = await db.pointage.findMany({
      where: {
        journalierId: paiement.journalierId,
        chantierId: paiement.chantierId,
        dateTravail: { gte: weekStart, lte: weekEnd },
        present: true,
      },
      orderBy: { dateTravail: 'asc' },
      select: {
        id: true,
        dateTravail: true,
        tauxJournalier: true,
        valide: true,
        observation: true,
      },
    })

    return NextResponse.json({ paiement, pointages })
  } catch (error) {
    console.error('GET /api/paie/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du paiement' },
      { status: 500 }
    )
  }
}

// PUT — Validate payment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { montantVerse, modePaiement, datePaiement, differenceComment, valideParId } = body

    // Validate required fields
    if (montantVerse === undefined || montantVerse === null) {
      return NextResponse.json(
        { error: 'Le montant versé est requis' },
        { status: 400 }
      )
    }

    if (!modePaiement) {
      return NextResponse.json(
        { error: 'Le mode de paiement est requis' },
        { status: 400 }
      )
    }

    if (!datePaiement) {
      return NextResponse.json(
        { error: 'La date de paiement est requise' },
        { status: 400 }
      )
    }

    // Fetch existing paiement
    const existing = await db.paiementHebdo.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Paiement non trouvé' },
        { status: 404 }
      )
    }

    if (existing.statut !== 'EN_ATTENTE') {
      return NextResponse.json(
        { error: 'Ce paiement a déjà été validé ou annulé' },
        { status: 400 }
      )
    }

    // Determine statut based on montantVerse vs montantCalcule
    const verse = Number(montantVerse)
    const calcule = existing.montantCalcule
    const statut = verse >= calcule ? 'VALIDE' : 'PARTIELLEMENT_VERSE'

    // Update the paiement
    const paiement = await db.paiementHebdo.update({
      where: { id },
      data: {
        montantVerse: verse,
        modePaiement,
        datePaiement: new Date(datePaiement),
        statut,
        valideParId: valideParId || null,
        differenceComment: differenceComment?.trim() || null,
      },
      include: {
        journalier: {
          select: { id: true, nom: true, prenom: true, specialite: true },
        },
        validePar: {
          select: { id: true, name: true },
        },
      },
    })

    // Mark related pointages as validated
    const weekStart = new Date(existing.semaineDebut)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(existing.semaineFin)
    weekEnd.setHours(23, 59, 59, 999)

    const { count } = await db.pointage.updateMany({
      where: {
        journalierId: existing.journalierId,
        chantierId: existing.chantierId,
        dateTravail: { gte: weekStart, lte: weekEnd },
        present: true,
        valide: false,
      },
      data: { valide: true },
    })

    // Create notification for chef de chantier
    // Find the chef de chantier for this chantier
    const chefChantier = await db.user.findFirst({
      where: {
        role: 'CHEF_CHANTIER',
        active: true,
      },
    })

    if (chefChantier) {
      await db.notification.create({
        data: {
          userId: chefChantier.id,
          titre: 'Paiement validé',
          message: `Le paiement de ${paiement.journalier.prenom} ${paiement.journalier.nom} pour la semaine du ${formatDateShort(existing.semaineDebut)} a été ${statut === 'VALIDE' ? 'validé' : 'partiellement versé'}. Montant: ${verse.toLocaleString('fr-FR')} FCFA.`,
          type: 'PAIEMENT',
          lien: `/paie`,
        },
      })
    }

    return NextResponse.json({
      paiement,
      pointagesValidated: count,
    })
  } catch (error) {
    console.error('PUT /api/paie/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la validation du paiement' },
      { status: 500 }
    )
  }
}

// DELETE — Cancel/delete payment (revert validation)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.paiementHebdo.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Paiement non trouvé' },
        { status: 404 }
      )
    }

    // If validated, revert related pointages
    if (existing.statut === 'VALIDE' || existing.statut === 'PARTIELLEMENT_VERSE') {
      const weekStart = new Date(existing.semaineDebut)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(existing.semaineFin)
      weekEnd.setHours(23, 59, 59, 999)

      await db.pointage.updateMany({
        where: {
          journalierId: existing.journalierId,
          chantierId: existing.chantierId,
          dateTravail: { gte: weekStart, lte: weekEnd },
          valide: true,
        },
        data: { valide: false },
      })
    }

    await db.paiementHebdo.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/paie/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du paiement' },
      { status: 500 }
    )
  }
}

// Helper
function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
