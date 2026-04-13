'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useSession } from 'next-auth/react'
import {
  Settings, User, Building2, Palette, Info, Sun, Moon, Monitor,
  Mail, Phone, Shield, Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface UserInfo {
  id: string
  email: string
  name: string
  role: string
  telephone: string | null
  active: boolean
  createdAt: string
  entreprise: {
    id: string
    nom: string
    adresse: string | null
    telephone: string | null
    email: string | null
  } | null
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrateur',
  CHEF_ENTREPRISE: "Chef d'entreprise",
  CONDUCTEUR: 'Conducteur de travaux',
  CHEF_CHANTIER: 'Chef de chantier',
  SOUS_TRAITANT: 'Sous-traitant',
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
  CHEF_ENTREPRISE: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/30',
  CONDUCTEUR: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
  CHEF_CHANTIER: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
  SOUS_TRAITANT: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30',
}

export function ParametresView() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await fetch('/api/parametres')
        if (res.ok) {
          const json = await res.json()
          setUserInfo(json.user)
        }
      } catch (err) {
        console.error('Paramètres fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUserInfo()
  }, [])

  const userInitials = session?.user?.name
    ? session.user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'OP'

  const getThemeLabel = () => {
    if (!mounted) return 'Système'
    if (theme === 'light') return 'Clair'
    if (theme === 'dark') return 'Sombre'
    return 'Système'
  }

  const cycleTheme = () => {
    if (!mounted) return
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Settings className="w-7 h-7 text-amber-500" />
          Paramètres
        </h2>
        <p className="text-muted-foreground mt-1">
          Gérez votre profil, votre entreprise et les préférences de l&apos;application.
        </p>
      </div>

      {/* Profile section */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="w-4.5 h-4.5 text-amber-500" />
            Mon profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            </div>
          ) : userInfo ? (
            <>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-amber-500/50">
                  <AvatarFallback className="bg-amber-600 text-white text-lg font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-foreground truncate">
                    {userInfo.name}
                  </h3>
                  <Badge
                    variant="outline"
                    className={`mt-1 ${roleColors[userInfo.role] || ''}`}
                  >
                    {roleLabels[userInfo.role] || userInfo.role}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Email */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="w-4.5 h-4.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-medium">Email</p>
                    <p className="text-sm text-foreground truncate">{userInfo.email}</p>
                  </div>
                </div>

                {/* Telephone */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Phone className="w-4.5 h-4.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-medium">Téléphone</p>
                    <p className="text-sm text-foreground">
                      {userInfo.telephone || <span className="italic text-muted-foreground">Non renseigné</span>}
                    </p>
                  </div>
                </div>

                {/* Role */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Shield className="w-4.5 h-4.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-medium">Rôle</p>
                    <p className="text-sm text-foreground">{roleLabels[userInfo.role] || userInfo.role}</p>
                  </div>
                </div>

                {/* Member since */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Calendar className="w-4.5 h-4.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-medium">Inscrit le</p>
                    <p className="text-sm text-foreground">
                      {format(new Date(userInfo.createdAt), 'd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Entreprise section */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Building2 className="w-4.5 h-4.5 text-amber-500" />
            Entreprise
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : userInfo?.entreprise ? (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="text-base font-semibold text-foreground">{userInfo.entreprise.nom}</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {userInfo.entreprise.adresse && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">Adresse</p>
                      <p className="text-sm text-foreground">{userInfo.entreprise.adresse}</p>
                    </div>
                  </div>
                )}
                {userInfo.entreprise.telephone && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">Téléphone</p>
                      <p className="text-sm text-foreground">{userInfo.entreprise.telephone}</p>
                    </div>
                  </div>
                )}
                {userInfo.entreprise.email && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">Email</p>
                      <p className="text-sm text-foreground">{userInfo.entreprise.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Building2 className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Aucune entreprise associée à votre compte</p>
              <p className="text-xs mt-1">Contactez votre administrateur pour plus d&apos;informations.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Theme section */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Palette className="w-4.5 h-4.5 text-amber-500" />
            Apparence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Light / Dark / System options */}
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Thème</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    theme === 'light'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                      : 'border-border hover:border-amber-300 dark:hover:border-amber-500/30'
                  }`}
                >
                  <Sun className={`w-6 h-6 ${theme === 'light' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <span className={`text-xs font-medium ${theme === 'light' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                    Clair
                  </span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                      : 'border-border hover:border-amber-300 dark:hover:border-amber-500/30'
                  }`}
                >
                  <Moon className={`w-6 h-6 ${theme === 'dark' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <span className={`text-xs font-medium ${theme === 'dark' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                    Sombre
                  </span>
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    theme === 'system'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10'
                      : 'border-border hover:border-amber-300 dark:hover:border-amber-500/30'
                  }`}
                >
                  <Monitor className={`w-6 h-6 ${theme === 'system' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <span className={`text-xs font-medium ${theme === 'system' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
                    Système
                  </span>
                </button>
              </div>
            </div>

            <Separator />

            {/* Dark mode quick toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="w-4.5 h-4.5 text-muted-foreground" />
                <Label htmlFor="dark-mode" className="text-sm font-medium text-foreground cursor-pointer">
                  Mode sombre
                </Label>
              </div>
              <Switch
                id="dark-mode"
                checked={mounted ? theme === 'dark' : false}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info section */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Info className="w-4.5 h-4.5 text-amber-500" />
            Informations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Application</span>
            <span className="text-sm font-medium text-foreground">O.P.U.C.</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Version</span>
            <Badge variant="outline" className="font-mono text-xs">v1.0.0</Badge>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Module</span>
            <span className="text-sm text-foreground">Pilotage de Chantier</span>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground text-center pt-1">
            © {new Date().getFullYear()} O.P.U.C. — Outil de Pilotage Unifié de Chantier. Tous droits réservés.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
