'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { goApi, ApiError } from '@/lib/go-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, AlertCircle, Eye, EyeOff, Building2, HardHat, Clock, ShieldCheck, ArrowRight } from 'lucide-react'
import { OpucLogo } from '@/components/layout/opuc-logo'

// ─── Animation variants ──────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
}

const featureVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 200, damping: 20, delay: 0.5 + i * 0.15 },
  }),
}

// ─── Floating shapes (background animation) ─────────────────────

function FloatingShape({ className, delay = 0, duration = 20 }: { className: string; delay?: number; duration?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full ${className}`}
      animate={{
        y: [0, -30, 0],
        x: [0, 15, 0],
        scale: [1, 1.1, 1],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

// ─── Branding panel (left) ───────────────────────────────────────

function BrandingPanel() {
  const features = [
    { icon: Building2, title: 'Gestion chantiers', desc: 'Pilotez tous vos projets BTP' },
    { icon: HardHat, title: 'Pointage mobile', desc: 'Suivez vos équipes en temps réel' },
    { icon: Clock, title: 'PWA offline', desc: 'Travaillez sans connexion' },
    { icon: ShieldCheck, title: 'Multi-tenant sécurisé', desc: 'RLS PostgreSQL natif' },
  ]

  return (
    <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-amber-600 via-orange-600 to-amber-800">
      {/* Animated gradient overlay */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            'radial-gradient(circle at 20% 30%, rgba(255,200,100,0.4) 0%, transparent 50%)',
            'radial-gradient(circle at 80% 70%, rgba(255,150,50,0.4) 0%, transparent 50%)',
            'radial-gradient(circle at 40% 80%, rgba(255,180,80,0.4) 0%, transparent 50%)',
            'radial-gradient(circle at 20% 30%, rgba(255,200,100,0.4) 0%, transparent 50%)',
          ],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating shapes */}
      <FloatingShape className="w-72 h-72 bg-white/5 top-10 -left-20" delay={0} duration={25} />
      <FloatingShape className="w-48 h-48 bg-white/10 top-1/2 right-10" delay={2} duration={20} />
      <FloatingShape className="w-32 h-32 bg-amber-300/20 bottom-20 left-1/3" delay={4} duration={18} />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 text-white w-full">
        {/* Logo + Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <OpucLogo size={56} className="drop-shadow-lg" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">O.P.U.C.</h1>
              <p className="text-sm text-amber-100/90">Outil de Pilotage Unifié de Chantier</p>
            </div>
          </div>
        </motion.div>

        {/* Hero text */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="space-y-2"
        >
          <h2 className="text-4xl xl:text-5xl font-bold leading-tight">
            La gestion de<br />
            <span className="bg-gradient-to-r from-yellow-200 to-amber-100 bg-clip-text text-transparent">
              chantier simplifiée
            </span>
          </h2>
          <p className="text-lg text-amber-100/80 max-w-md">
            Plateforme SaaS BTP — pointage, paie, stock, carburant, facturation.
          </p>
        </motion.div>

        {/* Features list */}
        <div className="space-y-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={featureVariants}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-3 group"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 group-hover:bg-white/20 transition-colors">
                <f.icon className="w-5 h-5 text-amber-100" />
              </div>
              <div>
                <p className="font-semibold text-sm">{f.title}</p>
                <p className="text-xs text-amber-100/70">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          className="flex items-center gap-6 pt-6 border-t border-white/20"
        >
          {[
            { value: '17', label: 'Modules' },
            { value: '4', label: 'Rôles RBAC' },
            { value: '0€', label: 'Coût/mois' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-amber-100/70">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

// ─── Login form (right) ──────────────────────────────────────────

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
      await goApi.login(email, password)
      window.location.href = '/'
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) {
          setError('Email ou mot de passe incorrect')
        } else if (e.status === 423) {
          setError('Compte temporairement verrouillé. Réessayez plus tard.')
        } else {
          setError(e.message || 'Une erreur est survenue.')
        }
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/50">
      {/* Panneau branding animé (gauche) — visible uniquement sur desktop */}
      <BrandingPanel />

      {/* Panneau formulaire (droite) */}
      <div className="flex items-center justify-center w-full lg:w-1/2 p-4 relative">
      {/* Subtle background pattern (mobile only) */}
      <div className="fixed inset-0 opacity-[0.03] lg:hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        {/* Back link */}
        {onBack && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
          >
            <motion.svg
              className="size-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              whileHover={{ x: -3 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </motion.svg>
            Retour à l'accueil
          </motion.button>
        )}

        {/* Mobile logo */}
        <div className="lg:hidden text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="inline-block"
          >
            <OpucLogo size={56} className="mx-auto mb-3" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground">O.P.U.C.</h1>
          <p className="text-sm text-muted-foreground mt-1">Outil de Pilotage Unifié de Chantier</p>
        </div>

        {/* Glassmorphism card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative"
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-200 via-orange-200 to-amber-200 rounded-3xl blur-lg opacity-30 group-hover:opacity-40 transition-opacity" />

          <div className="relative bg-white/70 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl shadow-amber-500/10 overflow-hidden">
            {/* Card header */}
            <div className="px-8 pt-8 pb-4">
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-2xl font-bold text-foreground"
              >
                Connexion
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-sm text-muted-foreground mt-1"
              >
                Entrez vos identifiants pour accéder au tableau de bord
              </motion.p>
            </div>

            {/* Form */}
            <motion.form
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              onSubmit={handleSubmit}
              className="px-8 pb-8 space-y-5"
            >
              {/* Error banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50/80 border border-red-200/60 text-red-700 text-sm">
                      <motion.div
                        animate={{ rotate: [0, -10, 10, 0] }}
                        transition={{ duration: 0.5, repeat: 2 }}
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      </motion.div>
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <motion.div variants={itemVariants} className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 bg-white/50 backdrop-blur-sm border-white/60 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                />
              </motion.div>

              {/* Password */}
              <motion.div variants={itemVariants} className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 pr-12 bg-white/50 backdrop-blur-sm border-white/60 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                  />
                  <motion.button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    whileTap={{ scale: 0.9 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </motion.button>
                </div>
              </motion.div>

              {/* Submit button */}
              <motion.div variants={itemVariants}>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium shadow-lg shadow-amber-500/25 transition-all duration-200 relative overflow-hidden group"
                >
                  {/* Shimmer effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
                  />
                  {loading ? (
                    <motion.div
                      className="flex items-center gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Connexion...
                    </motion.div>
                  ) : (
                    <motion.div
                      className="flex items-center gap-2"
                      whileHover={{ gap: 8 }}
                    >
                      Se connecter
                      <ArrowRight className="w-4 h-4" />
                    </motion.div>
                  )}
                </Button>
              </motion.div>

              {/* Forgot password */}
              {onForgotPassword && (
                <motion.div variants={itemVariants} className="text-center">
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-sm text-muted-foreground hover:text-amber-600 underline-offset-4 hover:underline transition-colors"
                  >
                    Mot de passe oublié ?
                  </button>
                </motion.div>
              )}
            </motion.form>

            {/* Demo credentials (dev only) */}
            <AnimatePresence>
              {process.env.NODE_ENV === 'development' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="px-8 pb-8"
                >
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/40 backdrop-blur-sm">
                    <p className="text-sm font-semibold text-amber-800 mb-2">Comptes de démonstration :</p>
                    <div className="grid grid-cols-1 gap-1.5 text-xs text-amber-700">
                      {[
                        { role: 'Super Admin', email: 'superadmin@opuc.demo', pwd: 'Admin@123456' },
                        { role: 'Gérant', email: 'gerant@opuc.demo', pwd: 'demo123' },
                        { role: 'Chef Projet', email: 'chef-projet@opuc.demo', pwd: 'demo123' },
                        { role: 'Sous-traitant', email: 'sous-traitant@opuc.demo', pwd: 'demo123' },
                      ].map((acc) => (
                        <div key={acc.role} className="flex justify-between items-center">
                          <span className="font-medium">{acc.role}</span>
                          <div className="flex gap-2">
                            <code className="font-mono bg-amber-100/60 px-1.5 py-0.5 rounded">{acc.email}</code>
                            <code className="font-mono bg-amber-100/60 px-1.5 py-0.5 rounded">{acc.pwd}</code>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-center text-sm text-muted-foreground mt-6"
        >
          O.P.U.C v1.0 — Gestion intelligente de chantiers BTP 🇨🇮
        </motion.p>
      </motion.div>
      </div>
    </div>
  )
}
