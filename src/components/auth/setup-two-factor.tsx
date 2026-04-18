'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ShieldCheck, Copy, Check, AlertTriangle, Loader2, QrCode } from 'lucide-react'
import { toast } from 'sonner'

interface SetupTwoFactorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

type SetupStep = 1 | 2 | 3

export function SetupTwoFactor({ open, onOpenChange, onComplete }: SetupTwoFactorProps) {
  const [step, setStep] = useState<SetupStep>(1)
  const [secret, setSecret] = useState('')
  const [authUri, setAuthUri] = useState('')
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(false)
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [copiedUri, setCopiedUri] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const allDigitsFilled = digits.every((d) => d !== '')

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep(1)
      setSecret('')
      setAuthUri('')
      setDigits(Array(6).fill(''))
      setBackupCodes([])
      setError(false)
      fetchSetupData()
    }
  }, [open])

  // Focus first digit input when step changes to 2
  useEffect(() => {
    if (step === 2 && inputRefs.current[0]) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    }
  }, [step])

  const fetchSetupData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Erreur lors de la génération du secret.')
      }
      const data = await res.json()
      setSecret(data.secret || '')
      setAuthUri(data.uri || '')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Une erreur est survenue.'
      )
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (value.length > 1) value = value[value.length - 1]
      if (!/^\d*$/.test(value)) return

      const newDigits = [...digits]
      newDigits[index] = value
      setDigits(newDigits)

      if (value && index < 5 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus()
      }
    },
    [digits]
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    },
    [digits]
  )

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pastedData.length === 0) return

    const newDigits = [...Array(6).fill('')]
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i]
    }
    setDigits(newDigits)
    const focusIndex = Math.min(pastedData.length, 5)
    inputRefs.current[focusIndex]?.focus()
  }, [])

  const copyToClipboard = async (text: string, type: 'secret' | 'uri' | 'codes') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'secret') setCopiedSecret(true)
      if (type === 'uri') setCopiedUri(true)
      if (type === 'codes') setCopiedCodes(true)
      toast.success('Copié dans le presse-papiers')
      setTimeout(() => {
        if (type === 'secret') setCopiedSecret(false)
        if (type === 'uri') setCopiedUri(false)
        if (type === 'codes') setCopiedCodes(false)
      }, 2000)
    } catch {
      toast.error('Impossible de copier. Veuillez copier manuellement.')
    }
  }

  const handleVerify = async () => {
    if (!allDigitsFilled) return

    setVerifying(true)
    setError(false)
    try {
      const res = await fetch('/api/auth/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: digits.join('') }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Code invalide')
      }

      const data = await res.json()
      setBackupCodes(data.backupCodes || [])
      setStep(3)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Code invalide. Veuillez réessayer.'
      )
      setError(true)
      setDigits(Array(6).fill(''))
      inputRefs.current[0]?.focus()
      setTimeout(() => setError(false), 600)
    } finally {
      setVerifying(false)
    }
  }

  const handleComplete = () => {
    onComplete()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        {/* Progress indicator */}
        <div className="flex items-center gap-2 pt-1">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-200 ${
                  s < step
                    ? 'bg-emerald-500 text-white'
                    : s === step
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
              >
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 flex-1 rounded-full transition-colors duration-200 ${
                    s < step ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground -mt-1 mb-1 px-1">
          <span>Scanner</span>
          <span>Vérifier</span>
          <span>Codes</span>
        </div>

        {/* Step 1: Show secret & URI */}
        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Configurer l&apos;authentification à deux facteurs
              </DialogTitle>
              <DialogDescription>
                Scannez ce code QR avec votre application d&apos;authentification ou saisissez la clé manuellement.
              </DialogDescription>
            </DialogHeader>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* QR Code placeholder */}
                <div className="flex justify-center">
                  <div className="w-48 h-48 bg-white border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2">
                    <QrCode className="w-12 h-12 text-slate-400" />
                    <span className="text-xs text-slate-500 font-medium">Code QR</span>
                    <span className="text-[10px] text-slate-400 text-center px-2 leading-tight">
                      Utilisez l&apos;URI ci-dessous si vous ne pouvez pas scanner
                    </span>
                  </div>
                </div>

                {/* Secret key */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Clé secrète</label>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(secret, 'secret')}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      {copiedSecret ? (
                        <><Check className="w-3 h-3 text-emerald-500" /> Copié</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Copier</>
                      )}
                    </button>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-3 font-mono text-sm text-center tracking-wider select-all break-all">
                    {secret}
                  </div>
                </div>

                {/* Auth URI */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">URI d&apos;authentification</label>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(authUri, 'uri')}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      {copiedUri ? (
                        <><Check className="w-3 h-3 text-emerald-500" /> Copié</>
                      ) : (
                        <><Copy className="w-3 h-3" /> Copier</>
                      )}
                    </button>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-3 text-xs text-muted-foreground break-all select-all max-h-20 overflow-y-auto">
                    {authUri}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="text-muted-foreground"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={() => setStep(2)}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/25"
                  >
                    Continuer
                  </Button>
                </DialogFooter>
              </div>
            )}
          </>
        )}

        {/* Step 2: Verify code */}
        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                Vérification
              </DialogTitle>
              <DialogDescription>
                Entrez le code à 6 chiffres affiché dans votre application d&apos;authentification pour confirmer la configuration.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex justify-center gap-2 sm:gap-3">
                {digits.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    disabled={verifying}
                    className={`w-11 h-12 text-center text-xl font-bold tracking-widest sm:w-12 sm:h-14 sm:text-2xl transition-colors duration-200 ${
                      error
                        ? 'border-red-500 focus-visible:ring-red-500/30'
                        : digit
                          ? 'border-emerald-500 focus-visible:ring-emerald-500/30'
                          : ''
                    }`}
                    aria-label={`Chiffre ${index + 1}`}
                  />
                ))}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep(1)
                    setDigits(Array(6).fill(''))
                    setError(false)
                  }}
                  className="text-muted-foreground"
                >
                  Retour
                </Button>
                <Button
                  onClick={handleVerify}
                  disabled={verifying || !allDigitsFilled}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/25"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Vérification...
                    </>
                  ) : (
                    'Vérifier'
                  )}
                </Button>
              </DialogFooter>
            </div>
          </>
        )}

        {/* Step 3: Backup codes */}
        {step === 3 && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600" />
                Codes de secours
              </DialogTitle>
              <DialogDescription>
                Enregistrez ces codes dans un endroit sûr. Vous pourrez les utiliser si vous perdez l&apos;accès à votre application.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Warning */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Important</p>
                  <p className="text-amber-700 mt-0.5">
                    Chaque code ne peut être utilisé qu&apos;une seule fois. Sauvegardez-les maintenant — vous ne pourrez plus les voir après avoir fermé cette fenêtre.
                  </p>
                </div>
              </div>

              {/* Backup codes grid */}
              <div className="bg-slate-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">
                    Codes de secours ({backupCodes.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(backupCodes.join('\n'), 'codes')}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    {copiedCodes ? (
                      <><Check className="w-3 h-3 text-emerald-500" /> Copié</>
                    ) : (
                      <><Copy className="w-3 h-3" /> Copier tout</>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code) => (
                    <div
                      key={code}
                      className="bg-white rounded-md px-3 py-2 font-mono text-sm text-center tracking-widest border border-slate-200 select-all"
                    >
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={handleComplete}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md shadow-emerald-500/25"
                >
                  J&apos;ai sauvegardé mes codes — Terminer
                </Button>
              </DialogFooter>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
