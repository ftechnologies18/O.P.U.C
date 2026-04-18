'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ShieldCheck, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// Shake animation via inline style
const shakeStyle = `@keyframes opuc-shake{0%,100%{transform:translateX(0)}10%,50%,90%{transform:translateX(-4px)}30%,70%{transform:translateX(4px)}}`

interface TwoFactorVerifyProps {
  userId: string
  onVerified: () => void
  onCancel: () => void
}

export function TwoFactorVerify({ userId, onVerified, onCancel }: TwoFactorVerifyProps) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [backupCode, setBackupCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const allDigitsFilled = digits.every((d) => d !== '')

  // Focus first input on mount
  useEffect(() => {
    if (!useBackup && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [useBackup])

  const triggerShake = useCallback(() => {
    setShaking(true)
    setError(true)
    setTimeout(() => {
      setShaking(false)
      setError(false)
    }, 600)
  }, [])

  const clearInputs = useCallback(() => {
    setDigits(Array(6).fill(''))
    setBackupCode('')
    if (!useBackup && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [useBackup])

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      // Only allow single digit
      if (value.length > 1) {
        value = value[value.length - 1]
      }
      if (!/^\d*$/.test(value)) return

      const newDigits = [...digits]
      newDigits[index] = value
      setDigits(newDigits)

      // Auto-focus next input
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

    // Focus the input after the last filled digit, or the last input
    const focusIndex = Math.min(pastedData.length, 5)
    inputRefs.current[focusIndex]?.focus()
  }, [])

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (allDigitsFilled && !loading && !error) {
      const timer = setTimeout(() => {
        submitCode(digits.join(''))
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [allDigitsFilled, digits, loading])

  const submitCode = async (code: string) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Code invalide')
      }

      onVerified()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Code invalide. Veuillez réessayer.'
      )
      triggerShake()
      clearInputs()
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (useBackup) {
      if (backupCode.trim().length < 8) {
        toast.error('Veuillez entrer un code de secours complet (8 caractères).')
        return
      }
      setLoading(true)
      setError(false)
      try {
        const res = await fetch('/api/auth/verify-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, code: backupCode.trim(), backupCode: true }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || 'Code de secours invalide')
        }

        onVerified()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Code invalide. Veuillez réessayer.'
        )
        triggerShake()
        setBackupCode('')
      } finally {
        setLoading(false)
      }
    } else if (allDigitsFilled) {
      await submitCode(digits.join(''))
    }
  }

  return (
    <Card
      className="shadow-xl shadow-black/5 border-0 bg-white/80 backdrop-blur-sm w-full max-w-md"
      style={shaking ? { animation: 'opuc-shake 0.5s ease-in-out' } : undefined}
    >
      <style dangerouslySetInnerHTML={{ __html: shakeStyle }} />

      <CardHeader className="pb-4 px-6 pt-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
          <ShieldCheck className="w-7 h-7 text-emerald-600" />
        </div>
        <CardTitle className="text-xl">Vérification en deux étapes</CardTitle>
        <CardDescription>
          Entrez le code généré par votre application d&apos;authentification.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {!useBackup ? (
            <>
              {/* 6-digit OTP inputs */}
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
                    disabled={loading}
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

              {/* Verify button */}
              <Button
                type="submit"
                disabled={loading || !allDigitsFilled}
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium shadow-md shadow-amber-500/25 transition-all duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Vérifier
                  </>
                )}
              </Button>

              {/* Backup code toggle */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setUseBackup(true)
                    setDigits(Array(6).fill(''))
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Utiliser un code de secours
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Backup code input */}
              <div className="space-y-2">
                <label htmlFor="backup-code" className="text-sm font-medium leading-none">
                  Code de secours
                </label>
                <Input
                  id="backup-code"
                  type="text"
                  placeholder="XXXXXXXX"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  disabled={loading}
                  className="h-11 text-center font-mono text-lg tracking-[0.3em] uppercase"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center">
                  Entrez l&apos;un des 8 codes de secours fournis lors de l&apos;activation.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading || backupCode.trim().length < 8}
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium shadow-md shadow-amber-500/25 transition-all duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Vérifier le code de secours
                  </>
                )}
              </Button>

              {/* Switch back to OTP */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setUseBackup(false)
                    setBackupCode('')
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Utiliser le code de l&apos;application
                </button>
              </div>
            </>
          )}

          {/* Cancel */}
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            Annuler
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
