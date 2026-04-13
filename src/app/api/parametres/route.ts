import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hash } from 'bcryptjs'

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const body = await request.json()
    const { name, telephone } = body

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Le nom doit contenir au moins 2 caractères' }, { status: 400 })
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        name: name.trim(),
        telephone: telephone?.trim() || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        telephone: true,
        active: true,
        createdAt: true,
        entreprise: {
          select: {
            id: true,
            nom: true,
            adresse: true,
            telephone: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('Paramètres PUT error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Mot de passe actuel et nouveau mot de passe requis' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { password: true },
    })

    if (!user?.password) {
      return NextResponse.json({ error: 'Compte non trouvé' }, { status: 404 })
    }

    const { compare } = await import('bcryptjs')
    const isMatch = await compare(currentPassword, user.password)
    if (!isMatch) {
      return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 400 })
    }

    const hashedPassword = await hash(newPassword, 12)
    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Password PATCH error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
