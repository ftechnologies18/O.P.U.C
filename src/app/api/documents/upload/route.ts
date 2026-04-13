import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// Allowed MIME type categories for construction site documents
const ALLOWED_CATEGORIES = [
  'application/pdf',
  // Office documents
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  // CAD / technical
  'application/dxf',
  'application/dwg',
  'model/vnd.dwf',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  // Text
  'text/plain',
  'text/csv',
  'text/xml',
]

const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

// ─── POST ───────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Le fichier dépasse la taille maximale de 50 Mo' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_CATEGORIES.includes(file.type) && file.size > 0) {
      return NextResponse.json(
        { error: `Le type de fichier "${file.type}" n'est pas autorisé` },
        { status: 400 }
      )
    }

    // Build unique filename
    const ext = path.extname(file.name) || ''
    const uniqueName = `${crypto.randomUUID()}${ext}`
    const fichierUrl = `/uploads/documents/${uniqueName}`

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'documents')
    await mkdir(uploadDir, { recursive: true })

    // Write file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(path.join(uploadDir, uniqueName), buffer)

    return NextResponse.json({
      url: fichierUrl,
      nom: file.name,
      taille: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error('POST /api/documents/upload error:', error)
    return NextResponse.json(
      { error: 'Erreur lors du téléversement du fichier' },
      { status: 500 }
    )
  }
}
