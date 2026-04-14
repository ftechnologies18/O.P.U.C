import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const salaire = await db.salaireMensuel.findUnique({
      where: { id },
      include: {
        journalier: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            specialite: true,
            typeContrat: true,
            poste: true,
            departement: true,
            salaireMensuel: true,
            statutContrat: true,
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

    if (!salaire) {
      return NextResponse.json(
        { error: 'Salaire non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json(salaire)
  } catch (error) {
    console.error('GET /api/salaires/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du salaire' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      salaireBase,
      primes,
      heuresSupp,
      montantHeuresSupp,
      retenuesCNPS,
      retenuesIR,
      avances,
      absences,
      retenueAbsences,
      statut,
      datePaiement,
      modePaiement,
      observation,
      valideParId,
    } = body

    const existing = await db.salaireMensuel.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Salaire non trouvé' },
        { status: 404 }
      )
    }

    // Validate statut change
    if (statut && !['EN_ATTENTE', 'PAYE', 'PARTIEL'].includes(statut)) {
      return NextResponse.json(
        { error: "Le statut doit être EN_ATTENTE, PAYE ou PARTIEL" },
        { status: 400 }
      )
    }

    // If changing to PAYE or PARTIEL, validate required fields
    if (statut === 'PAYE' || statut === 'PARTIEL') {
      if (!datePaiement) {
        return NextResponse.json(
          { error: 'La date de paiement est requise pour valider le paiement' },
          { status: 400 }
        )
      }
    }

    // Calculate netAPayer with new values or existing ones
    const newSalaireBase = salaireBase !== undefined ? salaireBase : existing.salaireBase
    const newPrimes = primes !== undefined ? primes : existing.primes
    const newMontantHeuresSupp = montantHeuresSupp !== undefined ? montantHeuresSupp : existing.montantHeuresSupp
    const newRetenuesCNPS = retenuesCNPS !== undefined ? retenuesCNPS : existing.retenuesCNPS
    const newRetenuesIR = retenuesIR !== undefined ? retenuesIR : existing.retenuesIR
    const newAvances = avances !== undefined ? avances : existing.avances
    const newRetenueAbsences = retenueAbsences !== undefined ? retenueAbsences : existing.retenueAbsences

    const netAPayer =
      newSalaireBase +
      newPrimes +
      newMontantHeuresSupp -
      newRetenuesCNPS -
      newRetenuesIR -
      newAvances -
      newRetenueAbsences

    const salaire = await db.salaireMensuel.update({
      where: { id },
      data: {
        ...(salaireBase !== undefined ? { salaireBase } : {}),
        ...(primes !== undefined ? { primes } : {}),
        ...(heuresSupp !== undefined ? { heuresSupp } : {}),
        ...(montantHeuresSupp !== undefined ? { montantHeuresSupp } : {}),
        ...(retenuesCNPS !== undefined ? { retenuesCNPS } : {}),
        ...(retenuesIR !== undefined ? { retenuesIR } : {}),
        ...(avances !== undefined ? { avances } : {}),
        ...(absences !== undefined ? { absences } : {}),
        ...(retenueAbsences !== undefined ? { retenueAbsences } : {}),
        ...(statut !== undefined ? { statut } : {}),
        ...(datePaiement !== undefined ? { datePaiement: datePaiement ? new Date(datePaiement) : null } : {}),
        ...(modePaiement !== undefined ? { modePaiement: modePaiement || null } : {}),
        ...(observation !== undefined ? { observation: observation || null } : {}),
        ...(valideParId !== undefined ? { valideParId: valideParId || null } : {}),
        netAPayer,
      },
      include: {
        journalier: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            specialite: true,
            typeContrat: true,
            poste: true,
            departement: true,
          },
        },
        validePar: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(salaire)
  } catch (error) {
    console.error('PUT /api/salaires/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du salaire' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.salaireMensuel.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Salaire non trouvé' },
        { status: 404 }
      )
    }

    await db.salaireMensuel.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/salaires/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du salaire' },
      { status: 500 }
    )
  }
}
