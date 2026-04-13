import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Count active chantiers
    const chantiersActifs = await db.chantier.count({
      where: { statut: 'EN_COURS' },
    })

    // Count workers currently assigned
    const journaliersSurSite = await db.journalierAffectation.count({
      where: { actif: true },
    })

    // Count today's pointages
    const pointagesAujourdhui = await db.pointage.count({
      where: { dateTravail: today },
    })

    // Count active alerts (unread notifications for this user)
    const alertesActives = await db.notification.count({
      where: { userId: (session.user as { id: string }).id, lu: false },
    })

    // Budget data for chart
    const chantiers = await db.chantier.findMany({
      select: {
        id: true,
        nom: true,
        budgetPrevisionnel: true,
        statut: true,
      },
    })

    // Phase progress data
    const phasesProgress = await db.phase.findMany({
      where: { chantierId: chantiers[0]?.id },
      select: { nom: true, avancement: true, ordre: true },
      orderBy: { ordre: 'asc' },
    })

    // Recent notifications
    const recentNotifications = await db.notification.findMany({
      where: { userId: (session.user as { id: string }).id },
      select: { id: true, titre: true, message: true, type: true, lu: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    return NextResponse.json({
      chantiersActifs,
      journaliersSurSite,
      pointagesAujourdhui,
      alertesActives,
      chantiers,
      phasesProgress,
      recentNotifications,
      userName: session.user.name,
      userRole: (session.user as { role: string }).role,
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
