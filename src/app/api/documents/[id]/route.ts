import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'

// ─── GET ────────────────────────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const document = await db.documentChantier.findUnique({
      where: { id },
      include: {
        auteur: {
          select: { id: true, name: true, email: true },
        },
        chantier: {
          select: { id: true, nom: true },
        },
        phase: {
          select: { id: true, nom: true },
        },
      },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document non trouvé' },
        { status: 404 }
      )
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('GET /api/documents/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du document' },
      { status: 500 }
    )
  }
}

// ─── PUT ────────────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      titre,
      type,
      categorie,
      numeroReference,
      description,
      statut,
      tags,
      phaseId,
      dateDocument,
    } = body

    const existing = await db.documentChantier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Document non trouvé' },
        { status: 404 }
      )
    }

    // Validate phaseId belongs to the same chantier
    if (phaseId && phaseId !== existing.phaseId) {
      const phase = await db.phase.findUnique({
        where: { id: phaseId },
        select: { chantierId: true },
      })
      if (phase && phase.chantierId !== existing.chantierId) {
        return NextResponse.json(
          { error: 'La phase n\'appartient pas au même chantier' },
          { status: 400 }
        )
      }
    }

    const document = await db.documentChantier.update({
      where: { id },
      data: {
        ...(titre !== undefined ? { titre: titre.trim() || existing.titre } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(categorie !== undefined ? { categorie: categorie?.trim() || null } : {}),
        ...(numeroReference !== undefined ? { numeroReference: numeroReference?.trim() || null } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(statut !== undefined ? { statut } : {}),
        ...(tags !== undefined ? { tags: tags?.trim() || null } : {}),
        ...(phaseId !== undefined ? { phaseId: phaseId || null } : {}),
        ...(dateDocument !== undefined ? { dateDocument: dateDocument ? new Date(dateDocument) : null } : {}),
      },
      include: {
        auteur: {
          select: { id: true, name: true },
        },
        chantier: {
          select: { id: true, nom: true },
        },
        phase: {
          select: { id: true, nom: true },
        },
      },
    })

    return NextResponse.json({ document })
  } catch (error) {
    console.error('PUT /api/documents/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du document' },
      { status: 500 }
    )
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.documentChantier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Document non trouvé' },
        { status: 404 }
      )
    }

    // Attempt to delete the physical file if it's a local upload
    if (existing.fichierUrl.startsWith('/uploads/documents/')) {
      try {
        const filePath = path.join(
          process.cwd(),
          'public',
          existing.fichierUrl
        )
        await unlink(filePath)
      } catch {
        // File may have already been deleted — ignore error and proceed
      }
    }

    await db.documentChantier.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/documents/[id] error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du document' },
      { status: 500 }
    )
  }
}
