'use client'

import { useEffect, useState } from 'react'
import { Bell, CheckCircle2, AlertTriangle, Package, Wallet, ClipboardList, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Notification {
  id: string
  titre: string
  message: string
  type: string
  lu: boolean
  createdAt: string
}

const notifTypeConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  STOCK_ALERT: { icon: Package, color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-500/15' },
  BUDGET_ALERT: { icon: AlertTriangle, color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-500/15' },
  TACHE_RETARD: { icon: ClipboardList, color: 'text-amber-500', bgColor: 'bg-amber-100 dark:bg-amber-500/15' },
  PAIEMENT: { icon: Wallet, color: 'text-emerald-500', bgColor: 'bg-emerald-100 dark:bg-emerald-500/15' },
  DOCUMENT: { icon: ClipboardList, color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-500/15' },
}

function timeAgo(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "À l'instant"
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    return format(date, 'dd MMM', { locale: fr })
  } catch {
    return ''
  }
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const unreadCount = notifications.filter((n) => !n.lu).length

  useEffect(() => {
    fetchNotifications()
  }, [])

  // Refresh when popover opens
  useEffect(() => {
    if (open) {
      fetchNotifications()
    }
  }, [open])

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?limit=20')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
      }
    } catch {
      // Silently fail, use empty state
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lu: true } : n))
      )
    } catch {
      // Silently fail
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', { method: 'PATCH' })
      setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })))
    } catch {
      // Silently fail
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 hover:bg-muted/70">
          <Bell className="w-[18px] h-[18px] text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none animate-in zoom-in-50 duration-200">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 sm:w-96 p-0" align="end" sideOffset={12}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="w-4.5 h-4.5 text-amber-500" />
            <h3 className="text-[15px] font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-600 border-0 text-xs h-5 px-1.5">
                {unreadCount} nouvelles
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Tout marquer lu
            </Button>
          )}
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">Aucune notification</p>
              <p className="text-xs text-muted-foreground mt-1 text-center">
                Vous serez notifié des événements importants.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => {
                const config = notifTypeConfig[notif.type] || notifTypeConfig.DOCUMENT
                const Icon = config.icon
                return (
                  <button
                    key={notif.id}
                    onClick={() => {
                      if (!notif.lu) markAsRead(notif.id)
                    }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                      !notif.lu ? 'bg-amber-50/50 dark:bg-amber-500/5' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!notif.lu ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                        {notif.titre}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                    {!notif.lu && (
                      <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
