'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
import { useSession } from '@/lib/auth-session'
import { toast } from 'sonner'
import {
  Settings, User, Building2, Palette, Info, Sun, Moon, Monitor,
  Mail, Phone, Shield, Calendar, Lock, KeyRound, Eye, EyeOff,
  Check, AlertTriangle, Keyboard, Bell, Globe, Database,
  HardHat, Zap, ChevronRight, Loader2, Save, RotateCcw,
  Users, Languages, Trash2, Download, ShieldCheck, MonitorSmartphone,
  Fingerprint, Clock, Sparkles, ExternalLink, ClipboardList, FileText, Camera, UserCog,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OpucLogo } from '@/components/layout/opuc-logo'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'

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
  SUPER_ADMIN: 'Super Administrateur',
  GERANT: 'Gérant',
  CHEF_PROJET: 'Chef de Projet',
  SOUS_TRAITANT: 'Sous-traitant',
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
  GERANT: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
  CHEF_PROJET: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
  SOUS_TRAITANT: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30',
}

/* ═════════════════════════════════════════
   Navigation Sections
   ═════════════════════════════════════════ */
const navSections = [
  {
    group: 'Compte',
    items: [
      { id: 'profil', label: 'Profil', icon: User, description: 'Informations personnelles' },
      { id: 'securite', label: 'Sécurité', icon: Shield, description: 'Mot de passe et sessions' },
    ],
  },
  {
    group: 'Application',
    items: [
      { id: 'apparence', label: 'Apparence', icon: Palette, description: 'Thème et disposition' },
      { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Alertes et rappels' },
      { id: 'langue', label: 'Langue & Région', icon: Globe, description: 'Préférences régionales' },
    ],
  },
  {
    group: 'Avancé',
    items: [
      { id: 'raccourcis', label: 'Raccourcis clavier', icon: Keyboard, description: 'Navigation rapide' },
      { id: 'donnees', label: 'Données', icon: Database, description: 'Export et stockage' },
      { id: 'apropos', label: 'À propos', icon: Info, description: 'Informations système' },
    ],
  },
]

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
      const res = await fetch('/api/v1/parametres')
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
      const res = await fetch('/api/v1/parametres', {
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
      const res = await fetch('/api/v1/parametres', {
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
   Loading State
   ═════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="flex gap-8">
        <div className="hidden lg:block w-60 shrink-0">
          <Skeleton className="h-10 w-48 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-6">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    )
  }

  /* ═════════════════════════════════════════
   RENDER
   ═════════════════════════════════════════ */
  return (
    <div className="flex gap-8 -m-4 lg:-m-6">
      {/* ══════════════════════════════════
          LEFT NAVIGATION (sticky sidebar)
          ══════════════════════════════════ */}
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 self-start max-h-[calc(100vh-4rem)] overflow-y-auto py-1">
        {/* Settings title */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            Paramètres
          </h2>
          <p className="text-sm text-muted-foreground mt-1 ml-[42px]">Configuration du compte</p>
        </div>

        <nav className="space-y-1">
          {navSections.map((section) => (
            <div key={section.group} className="mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 mb-1.5">
                {section.group}
              </p>
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-150',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    )}
                  >
                    <Icon className={cn(
                      'w-4 h-4 shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground/60'
                    )} />
                    <span className="text-[15px]">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* ══════════════════════════════════
          RIGHT CONTENT AREA
          ══════════════════════════════════ */}
      <div className="flex-1 min-w-0 space-y-6 pb-8">
        {/* Mobile: Tab selector dropdown */}
        <div className="lg:hidden">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            Paramètres
          </h2>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
            {navSections.flatMap(s => s.items).map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all shrink-0',
                    isActive
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ══════════════════════════════════
            TAB: PROFIL
            ══════════════════════════════════ */}
        {activeTab === 'profil' && (
          <div className="space-y-6 animate-fade-in">
            {/* Section Header */}
            <div>
              <h3 className="text-xl font-bold text-foreground">Profil utilisateur</h3>
              <p className="text-muted-foreground mt-1">Gérez vos informations personnelles et professionnelles.</p>
            </div>

            {/* Profile Header Card */}
            <Card className="border shadow-sm overflow-hidden">
              {/* Banner */}
              <div className="h-28 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 relative">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0di00aC0ydjRoLTRoNHYyaDR2NGgydi00aDR2LTJoLTR6bTAtMzBWMGgtMnY0aC00djJoNHY0aDJWNmg0VjRoLTR6TTYgMzR2LTRINGg0VjBoLTJ2NEgwdjJoNHY0aDJ2LTRoNHYtMkgtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
                <div className="absolute bottom-3 right-4 opacity-20">
                  <HardHat className="w-20 h-20 text-white" />
                </div>
              </div>
              <CardContent className="pt-0">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
                  <Avatar className="h-24 w-24 border-4 border-background shadow-lg shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white text-2xl font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 pb-2">
                    <h4 className="text-xl font-bold text-foreground truncate">{userInfo?.name || 'Utilisateur'}</h4>
                    <p className="text-[15px] text-muted-foreground truncate">{userInfo?.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className={roleColors[userInfo?.role || '']}>
                        {roleLabels[userInfo?.role || ''] || userInfo?.role}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        <Check className="w-3 h-3 mr-1 text-emerald-500" />
                        Actif
                      </Badge>
                      {userInfo?.createdAt && (
                        <span className="text-xs text-muted-foreground/70">
                          Membre depuis {format(new Date(userInfo.createdAt), 'MMM yyyy', { locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Edit Form + Details in 2 columns */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Edit Form */}
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[17px] font-semibold">Informations personnelles</CardTitle>
                  <CardDescription>Modifiez votre nom et vos coordonnées.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
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
                  <div className="flex items-center gap-3 pt-1">
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

              {/* Account Details (read-only) */}
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[17px] font-semibold">Détails du compte</CardTitle>
                  <CardDescription>Informations en lecture seule.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted/80 flex items-center justify-center">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-[13px] text-muted-foreground">Email</p>
                          <p className="text-[15px] font-mono text-foreground">{userInfo?.email}</p>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted/80 flex items-center justify-center">
                          <Shield className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-[13px] text-muted-foreground">Rôle</p>
                          <Badge variant="outline" className={roleColors[userInfo?.role || '']}>
                            {roleLabels[userInfo?.role || ''] || userInfo?.role}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-muted/80 flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-[13px] text-muted-foreground">Inscription</p>
                          <p className="text-[15px] text-foreground">
                            {userInfo?.createdAt ? format(new Date(userInfo.createdAt), 'd MMMM yyyy', { locale: fr }) : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Enterprise Card */}
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                  <Building2 className="w-4.5 h-4.5 text-amber-500" />
                  Entreprise
                </CardTitle>
                <CardDescription>Votre entreprise associée.</CardDescription>
              </CardHeader>
              <CardContent>
                {userInfo?.entreprise ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                      { icon: Building2, label: 'Nom', value: userInfo.entreprise.nom },
                      { icon: Globe, label: 'Adresse', value: userInfo.entreprise.adresse },
                      { icon: Phone, label: 'Téléphone', value: userInfo.entreprise.telephone },
                      { icon: Mail, label: 'Email', value: userInfo.entreprise.email },
                    ].filter(item => item.value).map((item) => {
                      const Icon = item.icon
                      return (
                        <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                          <div className="w-8 h-8 rounded-md bg-background flex items-center justify-center shrink-0 shadow-sm">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] text-muted-foreground font-medium">{item.label}</p>
                            <p className="text-[15px] text-foreground truncate">{item.value}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
                      <Building2 className="w-7 h-7 opacity-40" />
                    </div>
                    <p className="text-sm font-medium">Aucune entreprise associée</p>
                    <p className="text-xs mt-1 text-muted-foreground/70">Contactez votre administrateur.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: SÉCURITÉ
            ══════════════════════════════════ */}
        {activeTab === 'securite' && (
          <div className="space-y-6 animate-fade-in">
            {/* Section Header */}
            <div>
              <h3 className="text-xl font-bold text-foreground">Sécurité</h3>
              <p className="text-muted-foreground mt-1">Protégez votre compte avec un mot de passe fort.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Change Password */}
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                    <KeyRound className="w-4.5 h-4.5 text-amber-500" />
                    Changer le mot de passe
                  </CardTitle>
                  <CardDescription>Utilisez un mot de passe unique et robuste.</CardDescription>
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
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
                    className="gap-2 w-full sm:w-auto"
                  >
                    {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Mettre à jour le mot de passe
                  </Button>
                </CardContent>
              </Card>

              {/* Active Sessions + Security tips */}
              <div className="space-y-6">
                <Card className="border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                      <Fingerprint className="w-4.5 h-4.5 text-amber-500" />
                      Session active
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/20">
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <MonitorSmartphone className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-foreground">Navigateur actuel</p>
                        <p className="text-xs text-muted-foreground">Session active • Connecté en tant que {userInfo?.name}</p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30">
                        <Check className="w-3 h-3 mr-1" />
                        Actif
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Security Tips */}
                <Card className="border shadow-sm bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-500/5 dark:to-orange-500/5">
                  <CardHeader>
                    <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                      <ShieldCheck className="w-4.5 h-4.5 text-amber-500" />
                      Conseils de sécurité
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { icon: KeyRound, text: 'Utilisez un mot de passe de 10+ caractères avec des chiffres et symboles' },
                        { icon: Fingerprint, text: 'Ne partagez jamais votre mot de passe ou votre session' },
                        { icon: Clock, text: 'Déconnectez-vous après utilisation sur un appareil partagé' },
                      ].map((tip) => {
                        const Icon = tip.icon
                        return (
                          <div key={tip.text} className="flex items-start gap-3">
                            <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-foreground/80">{tip.text}</p>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: APPARENCE
            ══════════════════════════════════ */}
        {activeTab === 'apparence' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-xl font-bold text-foreground">Apparence</h3>
              <p className="text-muted-foreground mt-1">Personnalisez l&apos;interface selon vos préférences.</p>
            </div>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                  <Palette className="w-4.5 h-4.5 text-amber-500" />
                  Thème
                </CardTitle>
                <CardDescription>Choisissez l&apos;apparence de l&apos;interface.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { value: 'light', icon: Sun, label: 'Clair', desc: 'Fond blanc, texte sombre', preview: 'bg-white border' },
                    { value: 'dark', icon: Moon, label: 'Sombre', desc: 'Fond sombre, texte clair', preview: 'bg-slate-900 border-slate-700' },
                    { value: 'system', icon: Monitor, label: 'Système', desc: 'Suit les paramètres OS', preview: 'bg-gradient-to-br from-white to-slate-900 border' },
                  ].map((t) => {
                    const Icon = t.icon
                    const active = mounted && theme === t.value
                    return (
                      <button
                        key={t.value}
                        onClick={() => setTheme(t.value)}
                        className={`relative flex flex-col items-center gap-4 p-6 rounded-xl border-2 transition-all cursor-pointer group ${
                          active
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/40 hover:bg-muted/30'
                        }`}
                      >
                        {active && (
                          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-primary-foreground" />
                          </div>
                        )}
                        {/* Preview mini window */}
                        <div className={cn('w-20 h-14 rounded-lg overflow-hidden shadow-sm', t.preview)}>
                          <div className={cn(
                            'h-2.5',
                            t.value === 'dark' ? 'bg-slate-800' : 'bg-gray-100'
                          )} />
                          <div className="p-1.5 space-y-1">
                            <div className={cn(
                              'h-1 rounded-full w-3/4',
                              t.value === 'dark' ? 'bg-slate-700' : 'bg-gray-200'
                            )} />
                            <div className={cn(
                              'h-1 rounded-full w-1/2',
                              t.value === 'dark' ? 'bg-slate-700' : 'bg-gray-200'
                            )} />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className={`text-[15px] font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>
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
              <CardHeader>
                <CardTitle className="text-[17px] font-semibold">Disposition</CardTitle>
                <CardDescription>Configurez la disposition de l&apos;interface.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40">
                  <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center shadow-sm">
                    <HardHat className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-foreground">Barre latérale</p>
                    <p className="text-sm text-muted-foreground">Utilisez les contrôles en bas de la sidebar pour changer le mode d&apos;affichage.</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    3 modes disponibles
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: NOTIFICATIONS
            ══════════════════════════════════ */}
        {activeTab === 'notifications' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-xl font-bold text-foreground">Notifications</h3>
              <p className="text-muted-foreground mt-1">Choisissez les alertes que vous souhaitez recevoir.</p>
            </div>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                  <Bell className="w-4.5 h-4.5 text-amber-500" />
                  Préférences de notification
                </CardTitle>
                <CardDescription>Activez ou désactivez chaque type d&apos;alerte.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {[
                    { key: 'stockAlerts' as const, icon: AlertTriangle, label: 'Alertes de stock', desc: 'Quand un matériau atteint le seuil minimum', color: 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400' },
                    { key: 'budgetAlerts' as const, icon: Zap, label: 'Alertes budget', desc: 'Quand le budget dépasse 80% de la prévision', color: 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
                    { key: 'taskReminders' as const, icon: Calendar, label: 'Rappels de tâches', desc: 'Pour les tâches en retard ou à venir', color: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
                    { key: 'paymentAlerts' as const, icon: Lock, label: 'Paiements', desc: 'Confirmation des paiements hebdomadaires', color: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
                    { key: 'dailyReport' as const, icon: Mail, label: 'Rapport quotidien', desc: 'Résumé journalier par email', color: 'bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400' },
                  ].map((item, idx, arr) => {
                    const Icon = item.icon
                    return (
                      <div key={item.key}>
                        <div className="flex items-center justify-between py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', item.color)}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium text-foreground">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                          </div>
                          <Switch
                            checked={notifPrefs[item.key]}
                            onCheckedChange={(checked) =>
                              saveNotifPrefs({ ...notifPrefs, [item.key]: checked })
                            }
                          />
                        </div>
                        {idx < arr.length - 1 && <Separator />}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: LANGUE & RÉGION
            ══════════════════════════════════ */}
        {activeTab === 'langue' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-xl font-bold text-foreground">Langue & Région</h3>
              <p className="text-muted-foreground mt-1">Configurez la langue et les préférences régionales.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                    <Languages className="w-4.5 h-4.5 text-amber-500" />
                    Langue
                  </CardTitle>
                  <CardDescription>Langue de l&apos;interface utilisateur.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select defaultValue="fr">
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">🇫🇷 Français</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                      <SelectItem value="ar">🇸🇦 العربية</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    D&apos;autres langues seront bientôt disponibles
                  </p>
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                    <Globe className="w-4.5 h-4.5 text-amber-500" />
                    Fuseau horaire
                  </CardTitle>
                  <CardDescription>Utilisé pour les dates et heures.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select defaultValue="africa-dakar">
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="africa-dakar">GMT+0 (Dakar)</SelectItem>
                      <SelectItem value="europe-paris">GMT+1 (Paris)</SelectItem>
                      <SelectItem value="africa-casablanca">GMT+1 (Casablanca)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="border shadow-sm xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                    <Calendar className="w-4.5 h-4.5 text-amber-500" />
                    Format de date
                  </CardTitle>
                  <CardDescription>Comment les dates sont affichées dans l&apos;application.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { value: 'dmy', label: 'JJ/MM/AAAA', example: '25/12/2024', active: true },
                      { value: 'mdy', label: 'MM/JJ/AAAA', example: '12/25/2024', active: false },
                      { value: 'ymd', label: 'AAAA-MM-JJ', example: '2024-12-25', active: false },
                    ].map((fmt) => (
                      <button
                        key={fmt.value}
                        className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          fmt.active
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40 hover:bg-muted/30'
                        }`}
                      >
                        <p className={`text-[15px] font-semibold ${fmt.active ? 'text-primary' : 'text-foreground'}`}>
                          {fmt.label}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 font-mono">{fmt.example}</p>
                        {fmt.active && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                            <Check className="w-3 h-3" />
                            Actif
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: RACCOURCIS CLAVIER
            ══════════════════════════════════ */}
        {activeTab === 'raccourcis' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-xl font-bold text-foreground">Raccourcis clavier</h3>
              <p className="text-muted-foreground mt-1">Naviguez plus rapidement avec le clavier.</p>
            </div>

            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                  <Keyboard className="w-4.5 h-4.5 text-amber-500" />
                  Raccourcis disponibles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {[
                    { keys: ['⌘', 'K'], label: 'Recherche globale', desc: 'Rechercher une page ou une action' },
                    { keys: ['⌘', 'B'], label: 'Basculer la sidebar', desc: 'Afficher/masquer la barre latérale' },
                    { keys: ['Esc'], label: 'Fermer', desc: 'Fermer les dialogues et menus' },
                    { keys: ['Tab'], label: 'Navigation', desc: 'Se déplacer entre les éléments' },
                    { keys: ['⌘', '.'], label: 'Thème', desc: 'Basculer entre clair et sombre' },
                  ].map((shortcut, idx, arr) => (
                    <div key={shortcut.label}>
                      <div className="flex items-center justify-between py-3.5">
                        <div>
                          <p className="text-[15px] font-medium text-foreground">{shortcut.label}</p>
                          <p className="text-xs text-muted-foreground">{shortcut.desc}</p>
                        </div>
                        <div className="flex gap-1">
                          {shortcut.keys.map((key) => (
                            <kbd
                              key={key}
                              className="min-w-[32px] h-8 px-2.5 rounded-lg border border-border bg-muted text-xs font-mono text-muted-foreground flex items-center justify-center shadow-sm"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                      {idx < arr.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: DONNÉES
            ══════════════════════════════════ */}
        {activeTab === 'donnees' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-xl font-bold text-foreground">Données</h3>
              <p className="text-muted-foreground mt-1">Gérez les données de votre application.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                    <Download className="w-4.5 h-4.5 text-amber-500" />
                    Export des données
                  </CardTitle>
                  <CardDescription>Téléchargez vos données au format CSV ou JSON.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: 'Chantiers', icon: Building2, count: '—' },
                      { label: 'Personnel', icon: Users, count: '—' },
                      { label: 'Pointages', icon: ClipboardList, count: '—' },
                    ].map((item) => {
                      const Icon = item.icon
                      return (
                        <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-[15px] text-foreground">{item.label}</span>
                          </div>
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                            <Download className="w-3 h-3" />
                            Export
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2">
                    <Database className="w-4.5 h-4.5 text-amber-500" />
                    Base de données
                  </CardTitle>
                  <CardDescription>État de la base de données locale.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-500/5 border border-emerald-200/50 dark:border-emerald-500/20">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-emerald-700 dark:text-emerald-400">Connectée</p>
                        <p className="text-xs text-muted-foreground">SQLite — Base locale active</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Tables actives</span>
                        <span className="font-mono text-foreground">15</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-mono text-foreground">SQLite</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Statut</span>
                        <Badge variant="outline" className="text-xs gap-1">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          Opérationnelle
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="border-2 border-red-200 dark:border-red-500/30 xl:col-span-2">
                <CardHeader>
                  <CardTitle className="text-[17px] font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
                    <Trash2 className="w-4.5 h-4.5" />
                    Zone de danger
                  </CardTitle>
                  <CardDescription>Actions irréversibles. Procédez avec prudence.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-red-50/60 dark:bg-red-500/5 border border-red-200/50 dark:border-red-500/20">
                    <div>
                      <p className="text-[15px] font-semibold text-foreground">Réinitialiser les données</p>
                      <p className="text-sm text-muted-foreground">Supprimer toutes les données de l&apos;application. Cette action est irréversible.</p>
                    </div>
                    <Button variant="destructive" className="gap-2 shrink-0 w-full sm:w-auto">
                      <Trash2 className="w-4 h-4" />
                      Réinitialiser
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════
            TAB: À PROPOS
            ══════════════════════════════════ */}
        {activeTab === 'apropos' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-xl font-bold text-foreground">À propos</h3>
              <p className="text-muted-foreground mt-1">Informations sur l&apos;application O.P.U.C.</p>
            </div>

            {/* App Identity */}
            <Card className="border shadow-sm overflow-hidden">
              <div className="bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-amber-500/5 p-8 flex items-center gap-5">
                <OpucLogo size={72} />
                <div>
                  <h4 className="text-2xl font-bold text-foreground">O.P.U.C.</h4>
                  <p className="text-[15px] text-muted-foreground mt-0.5">Outil de Pilotage Unifié de Chantier</p>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="outline" className="font-mono text-xs">v1.0.0</Badge>
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Production
                    </Badge>
                  </div>
                </div>
              </div>
              <CardContent className="p-0">
                <div className="px-6 space-y-1">
                  {[
                    { icon: HardHat, label: 'Module', value: 'Pilotage de Chantier' },
                    { icon: Globe, label: 'Langue', value: 'Français (FR)' },
                    { icon: Calendar, label: 'Licence', value: 'Propriétaire' },
                    { icon: Database, label: 'Base de données', value: 'SQLite locale' },
                    { icon: Zap, label: 'Framework', value: 'Next.js 16 + TypeScript' },
                  ].map((item, idx, arr) => {
                    const Icon = item.icon
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <span className="text-[15px] text-muted-foreground">{item.label}</span>
                          </div>
                          <span className="text-[15px] font-medium text-foreground">{item.value}</span>
                        </div>
                        {idx < arr.length - 1 && <Separator />}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Modules */}
            <Card className="border shadow-sm">
              <CardHeader>
                <CardTitle className="text-[17px] font-semibold">Modules activés</CardTitle>
                <CardDescription>Fonctionnalités disponibles dans votre application.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {[
                    { name: 'Tableau de bord', icon: Settings },
                    { name: 'Chantiers', icon: Building2 },
                    { name: 'Personnel', icon: Users },
                    { name: 'Pointage', icon: ClipboardList },
                    { name: 'Paie', icon: Lock },
                    { name: 'Stocks', icon: HardHat },
                    { name: 'Budget', icon: Zap },
                    { name: 'Planning', icon: Calendar },
                    { name: 'Rapports', icon: FileText },
                    { name: 'Photos', icon: Camera },
                    { name: 'Documents', icon: ExternalLink },
                    { name: 'Sous-traitants', icon: UserCog },
                    { name: 'Paramètres', icon: Settings },
                  ].map((mod) => {
                    const Icon = mod.icon
                    return (
                      <div
                        key={mod.name}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-sm text-foreground truncate">{mod.name}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Copyright */}
            <div className="text-center py-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <OpucLogo size={20} />
                <span className="text-sm font-semibold text-foreground">O.P.U.C.</span>
              </div>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} O.P.U.C. — Outil de Pilotage Unifié de Chantier
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">Tous droits réservés. Conçu avec passion pour la construction.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
