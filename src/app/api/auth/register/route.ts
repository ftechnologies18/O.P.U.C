import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, validatePasswordStrength } from '@/lib/password'
import { rateLimitByRequest } from '@/lib/rate-limiter'

// ═══════════════════════════════════════════════════════════
// POST /api/auth/register — Self-registration (onboarding)
// Creates a new entreprise + GERANT account in one shot.
// This is the public onboarding flow — no auth required.
//
// Body: {
//   entrepriseNom: string,  (required)
//   name: string,           (required — gérant name)
//   email: string,          (required)
//   password: string,       (required — must pass strength validation)
//   telephone?: string,
//   adresse?: string,
// }
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  // ── Rate limiting: 3 registrations per hour per IP ──
  const rateResult = rateLimitByRequest(request, 'register', {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
  })

  if (!rateResult.success) {
    const retryAfterSeconds = Math.ceil(rateResult.retryAfterMs / 1000)
    return NextResponse.json(
      { error: 'Trop de tentatives d\'inscription. Veuillez réessayer plus tard.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      }
    )
  }

  try {
    const body = await request.json()
    const { entrepriseNom, name, email, password, telephone, adresse } = body

    // ── Validation ──

    if (!entrepriseNom || typeof entrepriseNom !== 'string' || entrepriseNom.trim() === '') {
      return NextResponse.json(
        { error: 'Le nom de l\'entreprise est requis.' },
        { status: 400 }
      )
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Votre nom est requis.' },
        { status: 400 }
      )
    }

    if (!email || typeof email !== 'string' || email.trim() === '') {
      return NextResponse.json(
        { error: 'L\'email est requis.' },
        { status: 400 }
      )
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Format d\'email invalide.' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return NextResponse.json(
        { error: 'Le mot de passe est requis.' },
        { status: 400 }
      )
    }

    // Password strength validation
    const strength = validatePasswordStrength(password)
    if (!strength.valid) {
      return NextResponse.json(
        { error: 'Mot de passe trop faible.', details: strength.errors },
        { status: 400 }
      )
    }

    // ── Uniqueness checks ──

    const normalizedEmail = email.trim().toLowerCase()

    // Check email uniqueness
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Un compte avec cet email existe déjà. Veuillez vous connecter.' },
        { status: 409 }
      )
    }

    // Check entreprise name uniqueness
    const existingEntreprise = await db.entreprise.findFirst({
      where: { nom: entrepriseNom.trim() },
    })

    if (existingEntreprise) {
      return NextResponse.json(
        { error: 'Une entreprise avec ce nom existe déjà.' },
        { status: 409 }
      )
    }

    // ── Create entreprise ──

    const entreprise = await db.entreprise.create({
      data: {
        nom: entrepriseNom.trim(),
        adresse: adresse?.trim() || null,
        status: 'active',
      },
    })

    // ── Create GERANT user ──

    const hashedPassword = await hashPassword(password.trim())

    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: 'CHEF_ENTREPRISE', // maps to GERANT via tenant.ts LEGACY_ROLE_MAP
        telephone: telephone?.trim() || null,
        entrepriseId: entreprise.id,
        active: true,
        premiereConnexion: false, // They set their own password
        invitationAcceptedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        telephone: true,
        active: true,
        entrepriseId: true,
        createdAt: true,
      },
    })

    // ── Audit log ──

    await db.auditLog.create({
      data: {
        userId: user.id,
        entrepriseId: entreprise.id,
        action: 'CREATE',
        module: 'entreprises',
        entityType: 'Entreprise',
        entityId: entreprise.id,
        details: `Inscription automatique: création de l'entreprise "${entreprise.nom}" avec le gérant "${user.name}" (${user.email})`,
      },
    })

    await db.auditLog.create({
      data: {
        userId: user.id,
        entrepriseId: entreprise.id,
        action: 'CREATE',
        module: 'users',
        entityType: 'User',
        entityId: user.id,
        details: `Inscription automatique: création du compte gérant "${user.name}" (${user.email})`,
      },
    })

    // ── Response ──

    return NextResponse.json(
      {
        success: true,
        message: 'Entreprise et compte créés avec succès. Vous pouvez maintenant vous connecter.',
        entreprise: {
          id: entreprise.id,
          nom: entreprise.nom,
        },
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('POST /api/auth/register error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'inscription. Veuillez réessayer.' },
      { status: 500 }
    )
  }
}
