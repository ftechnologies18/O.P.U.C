import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// ─── GET ────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const chantierId = searchParams.get('chantierId')
    const type = searchParams.get('type')
    const statut = searchParams.get('statut')
    const search = searchParams.get('search')
    const phaseId = searchParams.get('phaseId')

    const where: Record<string, unknown> = {}

    if (chantierId) {
      where.chantierId = chantierId
    }
    if (type) {
      where.type = type
    }
    if (statut) {
      where.statut = statut
    }
    if (phaseId) {
      where.phaseId = phaseId
    }

    // Full-text style search across multiple string fields
    if (search && search.trim()) {
      const term = search.trim()
      where.OR = [
        { titre: { contains: term } },
        { description: { contains: term } },
        { tags: { contains: term } },
        { numeroReference: { contains: term } },
      ]
    }

    const documents = await db.documentChantier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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

    // ── Stats ──────────────────────────────────────────────────────────────
    const statsWhere: Record<string, unknown> = {}
    if (chantierId) statsWhere.chantierId = chantierId

    const [
      total,
      plans,
      permis,
      contrats,
      pv_reception,
      factures,
      techniques,
      rapports,
      autres,
      valideCount,
      brouillonCount,
      archiveCount,
      tailleResult,
    ] = await Promise.all([
      db.documentChantier.count({ where: statsWhere }),
      db.documentChantier.count({ where: { ...statsWhere, type: 'plan' } }),
      db.documentChantier.count({ where: { ...statsWhere, type: 'permis' } }),
      db.documentChantier.count({ where: { ...statsWhere, type: 'contrat' } }),
      db.documentChantier.count({ where: { ...statsWhere, type: 'pv_reception' } }),
      db.documentChantier.count({ where: { ...statsWhere, type: 'facture' } }),
      db.documentChantier.count({ where: { ...statsWhere, type: 'technique' } }),
      db.documentChantier.count({ where: { ...statsWhere, type: 'rapport' } }),
      db.documentChantier.count({ where: { ...statsWhere, type: 'autre' } }),
      db.documentChantier.count({ where: { ...statsWhere, statut: 'valide' } }),
      db.documentChantier.count({ where: { ...statsWhere, statut: 'brouillon' } }),
      db.documentChantier.count({ where: { ...statsWhere, statut: 'archive' } }),
      db.documentChantier.aggregate({
        where: statsWhere,
        _sum: { fichierTaille: true },
      }),
    ])

    const stats = {
      total,
      plans,
      permis,
      contrats,
      pv_reception,
      factures,
      techniques,
      rapports,
      autres,
      valideCount,
      brouillonCount,
      archiveCount,
      tailleTotale: tailleResult._sum.fichierTaille || 0,
    }

    return NextResponse.json({ documents, stats })
  } catch (error) {
    console.error('GET /api/documents error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des documents' },
      { status: 500 }
    )
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // ── FormData (file upload) ──────────────────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const titre = (formData.get('titre') as string)?.trim()
      const chantierId = formData.get('chantierId') as string | null
      const auteurId = formData.get('auteurId') as string | null
      const type = (formData.get('type') as string) || 'autre'
      const categorie = (formData.get('categorie') as string)?.trim() || null
      const numeroReference = (formData.get('numeroReference') as string)?.trim() || null
      const description = (formData.get('description') as string)?.trim() || null
      const statut = (formData.get('statut') as string) || 'brouillon'
      const tags = (formData.get('tags') as string)?.trim() || null
      const phaseId = (formData.get('phaseId') as string) || null
      const dateDocument = (formData.get('dateDocument') as string) || null

      if (!titre || !chantierId || !auteurId) {
        return NextResponse.json(
          { error: 'Le titre, le chantier et l\'auteur sont requis' },
          { status: 400 }
        )
      }

      let fichierNom = ''
      let fichierUrl = ''
      let fichierTaille = 0
      let fichierType: string | null = null

      if (file) {
        // Validate file size (50 MB max)
        const MAX_SIZE = 50 * 1024 * 1024
        if (file.size > MAX_SIZE) {
          return NextResponse.json(
            { error: 'Le fichier dépasse la taille maximale de 50 Mo' },
            { status: 400 }
          )
        }

        fichierTaille = file.size
        fichierType = file.type

        // Build unique filename: uuid + original extension
        const ext = path.extname(file.name) || ''
        const uniqueName = `${crypto.randomUUID()}${ext}`
        fichierNom = file.name
        fichierUrl = `/uploads/documents/${uniqueName}`

        // Ensure upload directory exists
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents')
        await mkdir(uploadDir, { recursive: true })

        // Write file to disk
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        await writeFile(path.join(uploadDir, uniqueName), buffer)
      }

      const document = await db.documentChantier.create({
        data: {
          titre,
          type,
          categorie,
          numeroReference,
          fichierNom: fichierNom || titre,
          fichierUrl: fichierUrl || '',
          fichierTaille,
          fichierType,
          description,
          statut,
          tags,
          chantierId,
          phaseId: phaseId || null,
          auteurId,
          dateDocument: dateDocument ? new Date(dateDocument) : null,
        },
        include: {
          auteur: { select: { id: true, name: true } },
          chantier: { select: { id: true, nom: true } },
          phase: { select: { id: true, nom: true } },
        },
      })

      return NextResponse.json({ document }, { status: 201 })
    }

    // ── JSON body (URL-based documents) ─────────────────────────────────────
    const body = await request.json()
    const {
      titre,
      type = 'autre',
      categorie,
      numeroReference,
      fichierNom,
      fichierUrl,
      fichierTaille = 0,
      fichierType,
      description,
      statut = 'brouillon',
      tags,
      chantierId,
      phaseId,
      auteurId,
      dateDocument,
    } = body

    if (!titre || !chantierId || !auteurId) {
      return NextResponse.json(
        { error: 'Le titre, le chantier et l\'auteur sont requis' },
        { status: 400 }
      )
    }

    const document = await db.documentChantier.create({
      data: {
        titre: titre.trim(),
        type,
        categorie: categorie?.trim() || null,
        numeroReference: numeroReference?.trim() || null,
        fichierNom: fichierNom || titre.trim(),
        fichierUrl: fichierUrl || '',
        fichierTaille,
        fichierType,
        description: description?.trim() || null,
        statut,
        tags: tags?.trim() || null,
        chantierId,
        phaseId: phaseId || null,
        auteurId,
        dateDocument: dateDocument ? new Date(dateDocument) : null,
      },
      include: {
        auteur: { select: { id: true, name: true } },
        chantier: { select: { id: true, nom: true } },
        phase: { select: { id: true, nom: true } },
      },
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('POST /api/documents error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la création du document' },
      { status: 500 }
    )
  }
}
