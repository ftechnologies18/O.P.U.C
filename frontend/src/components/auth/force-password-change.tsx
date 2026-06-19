'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Eye, EyeOff, Loader2, ShieldAlert, Lock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface ForcePasswordChangeProps {
  userId: string
  open: boolean
  onComplete: () => void
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

export function ForcePasswordChange({ userId, open, onComplete }: ForcePasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword])
  const passwordErrors = useMemo(() => getPasswordErrors(newPassword), [newPassword])

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword
  const passwordsDontMatch = confirmPassword.length > 0 && newPassword !== confirmPassword
  const isStrongEnough = strength.score >= 70

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    passwordsMatch &&
    isStrongEnough &&
    newPassword !== currentPassword

  const passwordsSameAsOld = newPassword.length > 0 && newPassword === currentPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    try {
      const res = await fetch(`/api/v1/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Une erreur est survenue.')
      }

      toast.success('Mot de passe modifié avec succès.')
      onComplete()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.'
      )
    } finally {
      setLoading(false)
    }
  }

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Don't allow closing — the dialog should remain open
      return
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-2">
            <Lock className="w-7 h-7 text-amber-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            Première connexion
          </DialogTitle>
          <DialogDescription className="text-center">
            Pour votre sécurité, vous devez définir un nouveau mot de passe avant de continuer.
          </DialogDescription>
        </DialogHeader>

        {/* Warning banner */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Vous ne pourrez pas accéder à l&apos;application tant que votre mot de passe n&apos;aura pas été modifié.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current password */}
          <div className="space-y-2">
            <Label htmlFor="force-current-password">Mot de passe actuel</Label>
            <div className="relative">
              <Input
                id="force-current-password"
                type={showCurrent ? 'text' : 'password'}
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={loading}
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-2">
            <Label htmlFor="force-new-password">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="force-new-password"
                type={showNew ? 'text' : 'password'}
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                className={`h-11 pr-10 ${passwordsSameAsOld ? 'border-red-500 focus-visible:ring-red-500/30' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {passwordsSameAsOld && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Le nouveau mot de passe doit être différent de l&apos;actuel.
              </p>
            )}

            {/* Strength indicator */}
            {newPassword.length > 0 && !passwordsSameAsOld && (
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
            <Label htmlFor="force-confirm-password">Confirmer le nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="force-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
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

          <DialogFooter>
            <Button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium shadow-md shadow-amber-500/25 transition-all duration-200"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mise à jour...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Mettre à jour le mot de passe
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
