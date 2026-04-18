'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { OpucLogo } from '@/components/layout/opuc-logo'

export function LoginForm({ onForgotPassword, onBack }: { onForgotPassword?: () => void; onBack?: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Email ou mot de passe incorrect')
      } else {
        // Force full page reload to pick up the new session cookie
        window.location.href = '/'
      }
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="w-full max-w-md relative">
        {/* Back to landing link */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
          >
            <svg className="size-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Retour à l'accueil
          </button>
        )}

        {/* Logo & Title */}
        <div className="text-center mb-8">
          <OpucLogo size={64} className="mb-4" />
          <h1 className="text-3xl font-bold text-foreground tracking-tight">O.P.U.C.</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Outil de Pilotage Unifié de Chantier
          </p>
        </div>

        <Card className="shadow-xl shadow-black/5 border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4 px-6 pt-6">
            <CardTitle className="text-xl">Connexion</CardTitle>
            <CardDescription>
              Entrez vos identifiants pour accéder au tableau de bord
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
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
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium shadow-md shadow-amber-500/25 transition-all duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  'Se connecter'
                )}
              </Button>

              {onForgotPassword && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}
            </form>

            {/* Demo credentials — only visible in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-6 p-3 rounded-lg bg-amber-50/50 border border-amber-200/50">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  Comptes de démonstration :
                </p>
                <div className="space-y-1.5 text-sm text-amber-700">
                  <div className="flex justify-between">
                    <span className="font-medium">Super Admin</span>
                    <span className="font-mono text-xs">superadmin@opuc.demo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Gérant</span>
                    <span className="font-mono text-xs">chef-entreprise@opuc.demo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Admin Entreprise</span>
                    <span className="font-mono text-xs">admin@opuc.demo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Conducteur</span>
                    <span className="font-mono text-xs">conducteur@opuc.demo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Chef de chantier</span>
                    <span className="font-mono text-xs">chef-chantier@opuc.demo</span>
                  </div>
                  <p className="text-center pt-1 border-t border-amber-200/50 text-amber-600">
                    Mot de passe : <code className="font-mono bg-amber-100 px-1 rounded">demo123</code>
                  </p>
                  <p className="text-center text-amber-600">
                    SA : <code className="font-mono bg-amber-100 px-1 rounded">Admin@123456</code>
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          OPUC v1.0 — Gestion intelligente de chantiers
        </p>
      </div>
    </div>
  )
}
