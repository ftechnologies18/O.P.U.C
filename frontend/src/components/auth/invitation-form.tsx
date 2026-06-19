'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2, CheckCircle2, ShieldAlert, Mail, User, PartyPopper } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface InvitationFormProps {
  token: string
}

interface InvitationData {
  email: string
  nom: string
  prenom: string
  role: string
  entreprise: string
}

function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 2) return { score: 20, label: 'Faible', color: 'bg-red-500' }
  if (score <= 3) return { score: 40, label: 'Moyen', color: 'bg-amber-500' }
  if (score <= 4) return { score: 70, label: 'Bon', color: 'bg-yellow-500' }
  return { score: 100, label: 'Excellent', color: 'bg-emerald-500' }
}

function getPasswordErrors(password: string): string[] {
  const errors: string[] = []
  if (password.length < 8) errors.push('Au moins 8 caractères')
  if (!/[A-Z]/.test(password)) errors.push('Au moins une majuscule')
  if (!/[a-z]/.test(password)) errors.push('Au moins une minuscule')
  if (!/[0-9]/.test(password)) errors.push('Au moins un chiffre')
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Au moins un caractère spécial')
  return errors
}

export function InvitationForm({ token }: InvitationFormProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [error, setError] = useState('')

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [success, setSuccess] = useState(false)

  const strength = useMemo(() => getPasswordStrength(password), [password])
  const passwordErrors = useMemo(() => getPasswordErrors(password), [password])

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordsDontMatch = confirmPassword.length > 0 && password !== confirmPassword
  const isStrongEnough = strength.score >= 70

  const canSubmit = prenom.trim() && nom.trim() && password && passwordsMatch && isStrongEnough

  // Fetch invitation details on mount
  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const res = await fetch(`/api/v1/auth/invite?token=${encodeURIComponent(token)}`)
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || 'Invitation introuvable ou expirée.')
        }
        const data = await res.json()
        setInvitation(data)
        setPrenom(data.prenom || '')
        setNom(data.nom || '')
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Impossible de charger l\'invitation.'
        )
      } finally {
        setLoading(false)
      }
    }
    fetchInvitation()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/auth/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          prenom: prenom.trim(),
          nom: nom.trim(),
          password,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Une erreur est survenue.')
      }

      setSuccess(true)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Card className="shadow-xl shadow-black/5 border-0 bg-white/80 backdrop-blur-sm w-full max-w-md">
        <CardContent className="px-6 py-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="shadow-xl shadow-black/5 border-0 bg-white/80 backdrop-blur-sm w-full max-w-md">
        <CardContent className="px-6 py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="w-7 h-7 text-red-600" />
          </div>
          <p className="font-medium text-foreground">{error}</p>
          <Link href="/" className="inline-block mt-4">
            <Button variant="outline">
              Retour à l&apos;accueil
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (success) {
    return (
      <Card className="shadow-xl shadow-black/5 border-0 bg-white/80 backdrop-blur-sm w-full max-w-md">
        <CardContent className="px-6 py-8">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <PartyPopper className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                Bienvenue dans l&apos;équipe !
              </p>
              <p className="text-sm text-muted-foreground mt-1.5">
                Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.
              </p>
            </div>
            <Link href="/">
              <Button className="h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium shadow-md shadow-amber-500/25 transition-all duration-200 px-8">
                Aller à la connexion
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-xl shadow-black/5 border-0 bg-white/80 backdrop-blur-sm w-full max-w-md">
      <CardHeader className="pb-4 px-6 pt-6">
        <CardTitle className="text-xl">Accepter l&apos;invitation</CardTitle>
        <CardDescription>
          Créez votre compte pour rejoindre l&apos;espace de travail.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        {/* Invitation summary */}
        {invitation && (
          <div className="mb-5 p-3 rounded-lg bg-emerald-50 border border-emerald-200/50 space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-800">{invitation.email}</span>
            </div>
            {invitation.entreprise && (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-200 flex items-center justify-center text-[8px] text-emerald-700 font-bold">
                  E
                </span>
                <span>{invitation.entreprise}</span>
                {invitation.role && (
                  <span className="ml-auto text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                    {invitation.role}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="prenom"
                  type="text"
                  placeholder="Prénom"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  required
                  disabled={submitting}
                  className="h-11 pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input
                id="nom"
                type="text"
                placeholder="Nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
                disabled={submitting}
                className="h-11"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="inv-password">Mot de passe</Label>
            <div className="relative">
              <Input
                id="inv-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={submitting}
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength indicator */}
            {password.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Force du mot de passe</span>
                  <span className={`font-medium ${strength.score >= 70 ? 'text-emerald-600' : strength.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                    {strength.label}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${strength.score}%` }}
                  />
                </div>
                {passwordErrors.length > 0 && (
                  <ul className="space-y-0.5">
                    {passwordErrors.map((err) => (
                      <li key={err} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                        {err}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <Label htmlFor="inv-confirm-password">Confirmer le mot de passe</Label>
            <div className="relative">
              <Input
                id="inv-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={submitting}
                className={`h-11 pr-10 ${passwordsDontMatch ? 'border-red-500 focus-visible:ring-red-500/30' : passwordsMatch ? 'border-emerald-500 focus-visible:ring-emerald-500/30' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordsDontMatch && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Les mots de passe ne correspondent pas.
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting || !canSubmit}
            className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium shadow-md shadow-amber-500/25 transition-all duration-200"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Création du compte...
              </>
            ) : (
              'Créer mon compte'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
