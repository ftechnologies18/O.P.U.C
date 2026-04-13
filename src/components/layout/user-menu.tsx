'use client'

import { useSession, signOut } from 'next-auth/react'
import { useAppStore } from '@/store/app-store'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  HardHat,
  Building2,
} from 'lucide-react'

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrateur',
  CHEF_ENTREPRISE: "Chef d'entreprise",
  CONDUCTEUR: 'Conducteur de travaux',
  CHEF_CHANTIER: 'Chef de chantier',
  SOUS_TRAITANT: 'Sous-traitant',
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  CHEF_ENTREPRISE: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  CONDUCTEUR: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  CHEF_CHANTIER: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  SOUS_TRAITANT: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-400',
}

export function UserMenu() {
  const { data: session } = useSession()
  const { setCurrentView } = useAppStore()

  const user = session?.user as { name?: string; email?: string; role?: string } | undefined
  const role = user?.role || 'USER'
  const roleName = roleLabels[role] || role.replace('_', ' ')

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'OP'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
            <span className={`text-[11px] font-medium leading-tight px-1.5 py-0 rounded ${roleColors[role] || 'text-muted-foreground'}`}>
              {roleName}
            </span>
          </div>
          <ChevronDown className="hidden md:block w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64" align="end" sideOffset={8}>
        {/* User header */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1.5 py-1">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-amber-400/50">
                <AvatarFallback className="bg-amber-500 text-white text-sm font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-foreground leading-tight truncate">
                  {user?.name || 'Utilisateur'}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {user?.email || ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-[52px]">
              <Shield className={`w-3.5 h-3.5 ${roleColors[role]?.includes('text-') ? roleColors[role].split(' ')[1] : 'text-muted-foreground'}`} />
              <span className={`text-sm font-medium ${roleColors[role] || 'text-muted-foreground'}`}>
                {roleName}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Menu items */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => setCurrentView('parametres')}
            className="text-[15px] py-2.5 cursor-pointer"
          >
            <User className="w-4 h-4 mr-2.5" />
            Mon profil
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setCurrentView('parametres')}
            className="text-[15px] py-2.5 cursor-pointer"
          >
            <Building2 className="w-4 h-4 mr-2.5" />
            Mon entreprise
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setCurrentView('parametres')}
            className="text-[15px] py-2.5 cursor-pointer"
          >
            <Settings className="w-4 h-4 mr-2.5" />
            Paramètres
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => signOut()}
          variant="destructive"
          className="text-[15px] py-2.5 cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-2.5" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
