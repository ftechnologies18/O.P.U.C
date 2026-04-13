'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  Settings, User, Building2, Palette, Info, Sun, Moon, Monitor,
  Mail, Phone, Shield, Calendar, Lock, KeyRound, Eye, EyeOff,
  Check, AlertTriangle, Keyboard, Bell, Globe, Database,
  HardHat, Zap, ChevronRight, Loader2, Save, RotateCcw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OpucLogo } from '@/components/layout/opuc-logo'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

/* ═════════════════════════════════════════
   Types
   ═════════════════════════════════════════ */
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

interface NotificationPrefs {
  stockAlerts: boolean
  budgetAlerts: boolean
  taskReminders: boolean
  paymentAlerts: boolean
  dailyReport: boolean
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

/* ═════════════════════════════════════════
   Main Component
   ═════════════════════════════════════════ */
export function ParametresView() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('profil')

  // Profile edit state
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password change state
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    stockAlerts: true,
    budgetAlerts: true,
    taskReminders: true,
    paymentAlerts: true,
    dailyReport: false,
  })

  useEffect(() => { setMounted(true) }, [])

  const fetchUserInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/parametres')
      if (res.ok) {
        const json = await res.json()
        setUserInfo(json.user)
        setEditName(json.user.name)
        setEditPhone(json.user.telephone || '')
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUserInfo() }, [fetchUserInfo])

  // Load saved notification preferences
  useEffect(() => {
    try {
      const saved = localStorage.getItem('opuc-notif-prefs')
      if (saved) setNotifPrefs(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  const saveNotifPrefs = (prefs: NotificationPrefs) => {
    setNotifPrefs(prefs)
    try { localStorage.setItem('opuc-notif-prefs', JSON.stringify(prefs)) } catch { /* ignore */ }
  }

  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'OP'

  /* ─── Profile Save ─── */
  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/parametres', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, telephone: editPhone }),
      })
      if (res.ok) {
        const json = await res.json()
        setUserInfo(json.user)
        toast.success('Profil mis à jour avec succès')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur lors de la mise à jour')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSavingProfile(false)
    }
  }

  /* ─── Password Save ─── */
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    setSavingPassword(true)
    try {
      const res = await fetch('/api/parametres', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (res.ok) {
        toast.success('Mot de passe modifié avec succès')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur lors du changement')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSavingPassword(false)
    }
  }

  /* ═════════════════════════════════════════
   Settings Row Component (reusable)
   ═════════════════════════════════════════ */
  function SettingRow({ icon: Icon, label, description, children, separator = true }: {
    icon: React.ElementType
    label: string
    description?: string
    children: React.ReactNode
    separator?: boolean
  }) {
    return (
      <>
        <div className="flex items-center justify-between py-4 gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-muted/80 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-4.5 h-4.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-foreground">{label}</p>
              {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
            </div>
          </div>
          <div className="shrink-0">{children}</div>
        </div>
        {separator && <Separator />}
      </>
    )
  }

  /* ═════════════════════════════════════════
   RENDER
   ═════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="max-w-4xl space-y-6">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Settings className="w-7 h-7 text-amber-500" />
          Paramètres
        </h2>
        <p className="text-muted-foreground mt-1">
          Gérez votre compte, vos préférences et la configuration de l&apos;application.
        </p>
      </div>

      {/* ═══ Tabbed Settings ═══ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 h-auto flex-wrap gap-1">
          <TabsTrigger value="profil" className="gap-2 data-[state=active]:bg-background text-[15px] px-4 py-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profil</span>
          </TabsTrigger>
          <TabsTrigger value="securite" className="gap-2 data-[state=active]:bg-background text-[15px] px-4 py-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Sécurité</span>
          </TabsTrigger>
          <TabsTrigger value="apparence" className="gap-2 data-[state=active]:bg-background text-[15px] px-4 py-2">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Apparence</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 data-[state=active]:bg-background text-[15px] px-4 py-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="raccourcis" className="gap-2 data-[state=active]:bg-background text-[15px] px-4 py-2">
            <Keyboard className="w-4 h-4" />
            <span className="hidden sm:inline">Raccourcis</span>
          </TabsTrigger>
          <TabsTrigger value="apropos" className="gap-2 data-[state=active]:bg-background text-[15px] px-4 py-2">
            <Info className="w-4 h-4" />
            <span className="hidden sm:inline">À propos</span>
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════
            TAB: PROFIL
            ══════════════════════════════════ */}
        <TabsContent value="profil" className="space-y-6 animate-fade-in">
          {/* Profile Header Card */}
          <Card className="border shadow-sm overflow-hidden">
            {/* Banner */}
            <div className="h-24 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 relative">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0di00aC0ydjRoLTRoNHYyaDR2NGgydi00aDR2LTJoLTR6bTAtMzBWMGgtMnY0aC00djJoNHY0aDJWNmg0VjRoLTR6TTYgMzR2LTRINGg0VjBoLTJ2NEgwdjJoNHY0aDJ2LTRoNHYtMkgtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
            </div>
            <CardContent className="pt-0">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
                <Avatar className="h-20 w-20 border-4 border-background shadow-lg shrink-0">
                  <AvatarFallback className="bg-amber-600 text-white text-xl font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 pb-1">
                  <h3 className="text-lg font-bold text-foreground truncate">{userInfo?.name || 'Utilisateur'}</h3>
                  <p className="text-sm text-muted-foreground truncate">{userInfo?.email}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className={roleColors[userInfo?.role || '']}>
                      {roleLabels[userInfo?.role || ''] || userInfo?.role}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Check className="w-3 h-3 mr-1 text-emerald-500" />
                      Actif
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Form */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[17px] font-semibold">Informations personnelles</CardTitle>
              <CardDescription>Modifiez votre nom et vos coordonnées.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-[15px] font-medium">Nom complet</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Votre nom"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone" className="text-[15px] font-medium">Téléphone</Label>
                  <Input
                    id="edit-phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+221 77 123 45 67"
                    className="h-11"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={savingProfile || (editName === userInfo?.name && editPhone === (userInfo?.telephone || ''))}
                  className="gap-2"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setEditName(userInfo?.name || ''); setEditPhone(userInfo?.telephone || '') }}
                  disabled={editName === userInfo?.name && editPhone === (userInfo?.telephone || '')}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info Grid (read-only) */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[17px] font-semibold">Détails du compte</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-6">
                <SettingRow icon={Mail} label="Adresse email" description="Utilisée pour la connexion">
                  <span className="text-[15px] text-muted-foreground font-mono">{userInfo?.email}</span>
                </SettingRow>
                <SettingRow icon={Shield} label="Rôle" description="Défini par votre administrateur">
                  <Badge variant="outline" className={roleColors[userInfo?.role || '']}>
                    {roleLabels[userInfo?.role || ''] || userInfo?.role}
                  </Badge>
                </SettingRow>
                <SettingRow icon={Calendar} label="Inscrit le" separator={false}>
                  <span className="text-[15px] text-muted-foreground">
                    {userInfo?.createdAt ? format(new Date(userInfo.createdAt), 'd MMMM yyyy', { locale: fr }) : '—'}
                  </span>
                </SettingRow>
              </div>
            </CardContent>
          </Card>

          {/* Enterprise */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Building2 className="w-4.5 h-4.5 text-amber-500" />
                Entreprise
              </CardTitle>
              <CardDescription>Votre entreprise associée.</CardDescription>
            </CardHeader>
            <CardContent>
              {userInfo?.entreprise ? (
                <div className="p-0">
                  <div className="px-6">
                    <SettingRow icon={Building2} label="Nom">
                      <span className="text-[15px] font-medium text-foreground">{userInfo.entreprise.nom}</span>
                    </SettingRow>
                    {userInfo.entreprise.adresse && (
                      <SettingRow icon={Globe} label="Adresse">
                        <span className="text-[15px] text-muted-foreground">{userInfo.entreprise.adresse}</span>
                      </SettingRow>
                    )}
                    {userInfo.entreprise.telephone && (
                      <SettingRow icon={Phone} label="Téléphone">
                        <span className="text-[15px] text-muted-foreground">{userInfo.entreprise.telephone}</span>
                      </SettingRow>
                    )}
                    {userInfo.entreprise.email && (
                      <SettingRow icon={Mail} label="Email" separator={false}>
                        <span className="text-[15px] text-muted-foreground">{userInfo.entreprise.email}</span>
                      </SettingRow>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Building2 className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Aucune entreprise associée</p>
                  <p className="text-xs mt-1">Contactez votre administrateur.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════
            TAB: SÉCURITÉ
            ══════════════════════════════════ */}
        <TabsContent value="securite" className="space-y-6 animate-fade-in">
          {/* Change Password */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <KeyRound className="w-4.5 h-4.5 text-amber-500" />
                Changer le mot de passe
              </CardTitle>
              <CardDescription>Modifiez votre mot de passe de connexion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-pw" className="text-[15px] font-medium">Mot de passe actuel</Label>
                <div className="relative">
                  <Input
                    id="current-pw"
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="new-pw" className="text-[15px] font-medium">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="new-pw"
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Password strength indicator */}
                {newPassword.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            newPassword.length >= i * 3
                              ? newPassword.length >= 10
                                ? 'bg-emerald-500'
                                : newPassword.length >= 6
                                  ? 'bg-amber-500'
                                  : 'bg-red-400'
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {newPassword.length < 6
                        ? 'Trop court — minimum 6 caractères'
                        : newPassword.length < 10
                          ? 'Faible — ajoutez des chiffres ou symboles'
                          : 'Fort ✓'}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-pw" className="text-[15px] font-medium">Confirmer le mot de passe</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`h-11 ${confirmPassword && confirmPassword !== newPassword ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Les mots de passe ne correspondent pas
                  </p>
                )}
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="gap-2"
              >
                {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Mettre à jour
              </Button>
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Shield className="w-4.5 h-4.5 text-amber-500" />
                Session active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-foreground">Navigateur actuel</p>
                  <p className="text-xs text-muted-foreground">Session active • Connecté en tant que {userInfo?.name}</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30">
                  Actif
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════
            TAB: APPARENCE
            ══════════════════════════════════ */}
        <TabsContent value="apparence" className="space-y-6 animate-fade-in">
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Palette className="w-4.5 h-4.5 text-amber-500" />
                Thème
              </CardTitle>
              <CardDescription>Choisissez l&apos;apparence de l&apos;interface.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'light', icon: Sun, label: 'Clair', desc: 'Fond blanc, texte sombre' },
                  { value: 'dark', icon: Moon, label: 'Sombre', desc: 'Fond sombre, texte clair' },
                  { value: 'system', icon: Monitor, label: 'Système', desc: 'Suit les paramètres OS' },
                ].map((t) => {
                  const Icon = t.icon
                  const active = mounted && theme === t.value
                  return (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={`relative flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all cursor-pointer group ${
                        active
                          ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-500/10 shadow-sm'
                          : 'border-border hover:border-amber-300 dark:hover:border-amber-500/30 hover:bg-muted/30'
                      }`}
                    >
                      {active && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                        active
                          ? 'bg-amber-500/15'
                          : 'bg-muted/80 group-hover:bg-muted'
                      }`}>
                        <Icon className={`w-6 h-6 ${active ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground group-hover:text-foreground'}`} />
                      </div>
                      <div className="text-center">
                        <p className={`text-[15px] font-semibold ${active ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
                          {t.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sidebar preference */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[17px] font-semibold">Disposition</CardTitle>
              <CardDescription>Configurez la disposition de l&apos;interface.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-6">
                <SettingRow
                  icon={HardHat}
                  label="Barre latérale"
                  description="Utilisez les contrôles en bas de la sidebar"
                  separator={false}
                >
                  <Badge variant="outline" className="text-xs">
                    Contrôlable depuis la sidebar
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Badge>
                </SettingRow>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════
            TAB: NOTIFICATIONS
            ══════════════════════════════════ */}
        <TabsContent value="notifications" className="space-y-6 animate-fade-in">
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Bell className="w-4.5 h-4.5 text-amber-500" />
                Préférences de notification
              </CardTitle>
              <CardDescription>Choisissez les types de notifications que vous souhaitez recevoir.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="px-6">
                {[
                  { key: 'stockAlerts' as const, icon: AlertTriangle, label: 'Alertes de stock', desc: 'Quand un matériau atteint le seuil minimum' },
                  { key: 'budgetAlerts' as const, icon: Zap, label: 'Alertes budget', desc: 'Quand le budget dépasse 80% de la prévision' },
                  { key: 'taskReminders' as const, icon: Calendar, label: 'Rappels de tâches', desc: 'Pour les tâches en retard ou à venir' },
                  { key: 'paymentAlerts' as const, icon: Lock, label: 'Paiements', desc: 'Confirmation des paiements hebdomadaires' },
                  { key: 'dailyReport' as const, icon: Mail, label: 'Rapport quotidien', desc: 'Résumé journalier par email' },
                ].map((item, idx, arr) => {
                  const Icon = item.icon
                  return (
                    <SettingRow
                      key={item.key}
                      icon={Icon}
                      label={item.label}
                      description={item.desc}
                      separator={idx < arr.length - 1}
                    >
                      <Switch
                        checked={notifPrefs[item.key]}
                        onCheckedChange={(checked) =>
                          saveNotifPrefs({ ...notifPrefs, [item.key]: checked })
                        }
                      />
                    </SettingRow>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════
            TAB: RACCOURCIS CLAVIER
            ══════════════════════════════════ */}
        <TabsContent value="raccourcis" className="space-y-6 animate-fade-in">
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                <Keyboard className="w-4.5 h-4.5 text-amber-500" />
                Raccourcis clavier
              </CardTitle>
              <CardDescription>Naviguez plus rapidement avec le clavier.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {[
                  { keys: ['⌘', 'K'], label: 'Recherche globale', desc: 'Rechercher une page ou une action' },
                  { keys: ['⌘', 'B'], label: 'Basculer la sidebar', desc: 'Afficher/masquer la barre latérale' },
                  { keys: ['Esc'], label: 'Fermer', desc: 'Fermer les dialogues et menus' },
                  { keys: ['Tab'], label: 'Navigation', desc: 'Se déplacer entre les éléments' },
                ].map((shortcut) => (
                  <div key={shortcut.label} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-[15px] font-medium text-foreground">{shortcut.label}</p>
                      <p className="text-xs text-muted-foreground">{shortcut.desc}</p>
                    </div>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="min-w-[28px] h-7 px-2 rounded-md border border-border bg-muted text-xs font-mono text-muted-foreground flex items-center justify-center shadow-sm"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════
            TAB: À PROPOS
            ══════════════════════════════════ */}
        <TabsContent value="apropos" className="space-y-6 animate-fade-in">
          {/* App Identity */}
          <Card className="border shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-amber-500/5 p-6 flex items-center gap-4">
              <OpucLogo size={56} />
              <div>
                <h3 className="text-xl font-bold text-foreground">O.P.U.C.</h3>
                <p className="text-sm text-muted-foreground">Outil de Pilotage Unifié de Chantier</p>
              </div>
            </div>
            <CardContent className="p-0">
              <div className="px-6">
                <SettingRow icon={Info} label="Application">
                  <span className="text-[15px] font-medium text-foreground">O.P.U.C.</span>
                </SettingRow>
                <SettingRow icon={Zap} label="Version">
                  <Badge variant="outline" className="font-mono text-xs">v1.0.0</Badge>
                </SettingRow>
                <SettingRow icon={HardHat} label="Module">
                  <span className="text-[15px] text-foreground">Pilotage de Chantier</span>
                </SettingRow>
                <SettingRow icon={Database} label="Base de données">
                  <Badge variant="outline" className="text-xs gap-1">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    Connectée
                  </Badge>
                </SettingRow>
                <SettingRow icon={Globe} label="Langue">
                  <span className="text-[15px] text-foreground">Français (FR)</span>
                </SettingRow>
                <SettingRow icon={Calendar} label="Licence" separator={false}>
                  <span className="text-[15px] text-muted-foreground">Propriétaire</span>
                </SettingRow>
              </div>
            </CardContent>
          </Card>

          {/* Modules */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[17px] font-semibold">Modules activés</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {[
                  'Tableau de bord', 'Chantiers', 'Personnel', 'Pointage', 'Paie',
                  'Stocks', 'Budget', 'Planning', 'Rapports', 'Photos',
                  'Documents', 'Sous-traitants', 'Paramètres',
                ].map((mod) => (
                  <Badge key={mod} variant="secondary" className="text-[13px] py-1 px-2.5">
                    <Check className="w-3 h-3 mr-1 text-emerald-500" />
                    {mod}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Copyright */}
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} O.P.U.C. — Outil de Pilotage Unifié de Chantier
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">Tous droits réservés.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
