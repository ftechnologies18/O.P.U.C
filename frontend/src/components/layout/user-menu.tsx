'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession, signOut } from '@/lib/auth-session'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  User, Settings, LogOut, ChevronDown, Shield, Building2,
  Mail, Phone, Calendar, Sun, Moon, Monitor, Camera,
  Check, Eye, EyeOff, KeyRound, Bell, AlertTriangle,
  Loader2, Save, RotateCcw, Zap,
} from 'lucide-react'

/* ═════════════════════════════════════════
   Types & Constants
   ═════════════════════════════════════════ */
interface UserInfo {
  id: string
  email: string
  name: string
  role: string
  telephone: string | null
  active: boolean
  createdAt: string
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrateur',
  GERANT: 'Gérant',
  CHEF_PROJET: 'Chef de Projet',
  EMPLOYE: 'Employé',
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  GERANT: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  CHEF_PROJET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  EMPLOYE: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400',
}

type PanelTab = 'profil' | 'notifications' | 'securite' | 'apparence'

const tabs: { id: PanelTab; label: string; icon: React.ElementType }[] = [
  { id: 'profil', label: 'Profil', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'securite', label: 'Sécurité', icon: Shield },
  { id: 'apparence', label: 'Apparence', icon: Sun },
]

/* ═════════════════════════════════════════
   Main UserMenu Component
   ═════════════════════════════════════════ */
export function UserMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  const user = session?.user as { name?: string; email?: string; role?: string } | undefined
  const role = user?.role || 'USER'
  const roleName = roleLabels[role] || role.replace('_', ' ')

  const userInitials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'OP'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2.5 h-10 px-2.5 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer group">
          <Avatar className="h-8 w-8 border-2 border-amber-400/60 group-hover:border-amber-400 transition-colors">
            <AvatarFallback className="bg-amber-500 text-white text-xs font-bold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-[13px] font-semibold text-foreground leading-tight">
              {user?.name || 'Utilisateur'}
            </span>
            <span className={cn('text-[11px] font-medium leading-tight px-1.5 py-0 rounded', roleColors[role] || 'text-muted-foreground')}>
              {roleName}
            </span>
          </div>
          <ChevronDown className="hidden md:block w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[420px] sm:w-[460px] p-0 overflow-hidden shadow-xl"
        align="end"
        sideOffset={12}
      >
        <UserPanel onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

/* ═════════════════════════════════════════
   User Panel (the main content inside popover)
   ═════════════════════════════════════════ */
function UserPanel({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<PanelTab>('profil')
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Profile edit
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  // Password
  const [showPw, setShowPw] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({
    stockAlerts: true,
    budgetAlerts: true,
    taskReminders: true,
    paymentAlerts: true,
  })

  useEffect(() => { setMounted(true) }, [])

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/parametres')
      if (res.ok) {
        const json = await res.json()
        setUserInfo(json.user)
        setEditName(json.user.name)
        setEditPhone(json.user.telephone || '')
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchUser() }, [fetchUser])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('opuc-notif-prefs')
      if (saved) setNotifPrefs(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  const user = session?.user as { name?: string; email?: string; role?: string } | undefined
  const role = user?.role || 'USER'
  const roleName = roleLabels[role] || role.replace('_', ' ')
  const userInitials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'OP'

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/v1/parametres', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, telephone: editPhone }),
      })
      if (res.ok) {
        const json = await res.json()
        setUserInfo(json.user)
        setEditing(false)
        toast.success('Profil mis à jour')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur')
      }
    } catch { toast.error('Erreur de connexion') }
    finally { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { toast.error('Les mots de passe ne correspondent pas'); return }
    if (newPw.length < 6) { toast.error('Minimum 6 caractères'); return }
    setSavingPw(true)
    try {
      const res = await fetch('/api/v1/parametres', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      if (res.ok) {
        toast.success('Mot de passe modifié')
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur')
      }
    } catch { toast.error('Erreur') }
    finally { setSavingPw(false) }
  }

  const toggleNotif = (key: string) => {
    const updated = { ...notifPrefs, [key]: !(notifPrefs as Record<string, boolean>)[key] }
    setNotifPrefs(updated)
    try { localStorage.setItem('opuc-notif-prefs', JSON.stringify(updated)) } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col max-h-[70vh]">
      {/* ═══ Header ═══ */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-4">
          {/* Avatar with camera overlay */}
          <div className="relative group/avatar shrink-0">
            <Avatar className="h-14 w-14 border-2 border-amber-400/50">
              <AvatarFallback className="bg-amber-500 text-white text-lg font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-black/0 group-hover/avatar:bg-black/30 transition-colors flex items-center justify-center cursor-pointer">
              <Camera className="w-5 h-5 text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground truncate">
              {userInfo?.name || user?.name || 'Utilisateur'}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {userInfo?.email || user?.email || ''}
            </p>
            <Badge variant="outline" className={cn('mt-1 text-[11px]', roleColors[role])}>
              <Shield className="w-3 h-3 mr-1" />
              {roleName}
            </Badge>
          </div>
        </div>
      </div>

      {/* ═══ Tabs ═══ */}
      <div className="px-5">
        <div className="flex gap-0.5 border-b border-border overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  active
                    ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ Tab Content ═══ */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-4">

          {/* ─── TAB: PROFIL ─── */}
          {activeTab === 'profil' && (
            <div className="space-y-4 animate-fade-in">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-muted-foreground">Nom complet</Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={!editing}
                        className={cn('h-9 text-[15px]', !editing && 'bg-muted/50')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-muted-foreground">Téléphone</Label>
                      <Input
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        disabled={!editing}
                        placeholder="+221 77 123 45 67"
                        className={cn('h-9 text-[15px]', !editing && 'bg-muted/50')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-muted-foreground">Email</Label>
                      <Input
                        value={userInfo?.email || ''}
                        disabled
                        className="h-9 text-[15px] bg-muted/50"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Quick info row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                      <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground font-medium">Inscrit le</p>
                        <p className="text-[13px] text-foreground truncate">
                          {userInfo?.createdAt
                            ? new Date(userInfo.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground font-medium">Statut</p>
                        <p className="text-[13px] text-emerald-600 dark:text-emerald-400 font-medium">Actif</p>
                      </div>
                    </div>
                  </div>

                  {/* Edit / Save buttons */}
                  <div className="flex items-center gap-2">
                    {!editing ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(true)}
                        className="gap-1.5 text-[13px]"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Modifier
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="gap-1.5 text-[13px]"
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Enregistrer
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditName(userInfo?.name || '')
                            setEditPhone(userInfo?.telephone || '')
                            setEditing(false)
                          }}
                          className="gap-1 text-[13px]"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Annuler
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── TAB: NOTIFICATIONS ─── */}
          {activeTab === 'notifications' && (
            <div className="space-y-1 animate-fade-in">
              {[
                { key: 'stockAlerts', icon: AlertTriangle, label: 'Alertes de stock', desc: 'Matériaux sous le seuil minimum' },
                { key: 'budgetAlerts', icon: Zap, label: 'Alertes budget', desc: 'Budget > 80% de la prévision' },
                { key: 'taskReminders', icon: Calendar, label: 'Rappels de tâches', desc: 'Tâches en retard ou à venir' },
                { key: 'paymentAlerts', icon: Shield, label: 'Paiements', desc: 'Confirmation des paiements' },
              ].map((item, idx, arr) => {
                const Icon = item.icon
                return (
                  <div key={item.key}>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-foreground">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                      <Switch
                        checked={(notifPrefs as Record<string, boolean>)[item.key] ?? true}
                        onCheckedChange={() => toggleNotif(item.key)}
                      />
                    </div>
                    {idx < arr.length - 1 && <Separator />}
                  </div>
                )
              })}
            </div>
          )}

          {/* ─── TAB: SÉCURITÉ ─── */}
          {activeTab === 'securite' && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-[13px] text-muted-foreground">Modifiez votre mot de passe de connexion.</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-muted-foreground">Mot de passe actuel</Label>
                  <div className="relative">
                    <Input
                      type={showPw ? 'text' : 'password'}
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 text-[15px] pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-muted-foreground">Nouveau mot de passe</Label>
                  <Input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    className="h-9 text-[15px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-muted-foreground">Confirmer</Label>
                  <Input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="••••••••"
                    className={cn(
                      'h-9 text-[15px]',
                      confirmPw && confirmPw !== newPw && 'border-red-400 focus-visible:ring-red-400'
                    )}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleChangePassword}
                disabled={savingPw || !currentPw || !newPw || !confirmPw || newPw !== confirmPw}
                className="gap-1.5 text-[13px]"
              >
                {savingPw ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                Mettre à jour
              </Button>

              <Separator />

              {/* Active session info */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">Session active</p>
                  <p className="text-[11px] text-muted-foreground">Navigateur actuel</p>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB: APPARENCE ─── */}
          {activeTab === 'apparence' && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-[13px] text-muted-foreground">Choisissez le thème de l&apos;interface.</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'light', icon: Sun, label: 'Clair' },
                  { value: 'dark', icon: Moon, label: 'Sombre' },
                  { value: 'system', icon: Monitor, label: 'Système' },
                ].map((t) => {
                  const Icon = t.icon
                  const active = mounted && theme === t.value
                  return (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer',
                        active
                          ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-500/10'
                          : 'border-border hover:border-amber-300 dark:hover:border-amber-500/30'
                      )}
                    >
                      <div className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center',
                        active ? 'bg-amber-500/15' : 'bg-muted/80'
                      )}>
                        <Icon className={cn('w-4.5 h-4.5', active ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')} />
                      </div>
                      <span className={cn('text-[12px] font-medium', active ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                        {t.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ═══ Footer ═══ */}
      <div className="border-t border-border px-5 py-3 flex items-center justify-between bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { onClose() }}
          className="gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-3.5 h-3.5" />
          Paramètres complets
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="gap-1.5 text-[13px] text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </Button>
      </div>
    </div>
  )
}


