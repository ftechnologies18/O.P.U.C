'use client'

import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  HardHat,
  Clock,
  ShieldCheck,
  Wallet,
  Package,
  Fuel,
  FileText,
  LifeBuoy,
  Menu,
  X,
  ArrowRight,
  Play,
  Check,
  Plus,
  Minus,
  Star,
  Sparkles,
  TrendingUp,
  Users,
  ChevronDown,
  Quote,
  Layers,
  Server,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OpucLogo } from '@/components/layout/opuc-logo'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface LandingPageProps {
  onLoginClick: () => void
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Smooth-scroll to an element by ID */
function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

const EASE_OUT = [0.22, 1, 0.36, 1] as const

const containerStagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT },
  },
}

const slideInLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.65, ease: EASE_OUT },
  },
}

const slideInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.65, ease: EASE_OUT },
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

const NAV_LINKS: { label: string; target: string }[] = [
  { label: 'Fonctionnalités', target: 'fonctionnalites' },
  { label: 'Tarifs', target: 'tarifs' },
  { label: 'Témoignages', target: 'temoignages' },
  { label: 'FAQ', target: 'faq' },
]

const FEATURES: {
  icon: typeof Building2
  title: string
  description: string
  color: string
}[] = [
  {
    icon: Clock,
    title: 'Pointage mobile',
    description:
      'Pointage chantier en temps réel depuis le smartphone, mode hors-ligne inclus. Géolocalisation et QR code.',
    color: 'from-amber-400 to-orange-500',
  },
  {
    icon: Wallet,
    title: 'Paie automatique',
    description:
      'Génération automatique des bulletins de paie à partir des pointages. Conformité droit du travail ivoirien.',
    color: 'from-orange-400 to-amber-600',
  },
  {
    icon: Package,
    title: 'Stock multi-chantier',
    description:
      'Suivi des stocks par chantier, transferts inter-sites, alertes de seuil et gestion des fournisseurs.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    icon: Fuel,
    title: 'Carburant & engins',
    description:
      'Suivi de la consommation carburant par engin, kilométrage, maintenance préventive et coûts horaires.',
    color: 'from-orange-500 to-amber-700',
  },
  {
    icon: FileText,
    title: 'Devis & facturation',
    description:
      'Création de devis, conversion en factures, suivi des règlements et relances clients automatisées.',
    color: 'from-amber-400 to-orange-600',
  },
  {
    icon: LifeBuoy,
    title: 'Support tickets',
    description:
      'Système de tickets intégré, base de connaissances, suivi SLA et support prioritaire pour les abonnés Pro.',
    color: 'from-orange-400 to-amber-500',
  },
]

const PRICING_PLANS = [
  {
    name: 'Starter',
    monthly: 0,
    annual: 0,
    description: 'Pour démarrer et tester la plateforme',
    features: [
      'Jusqu’à 3 utilisateurs',
      '1 chantier actif',
      'Pointage mobile',
      'Stock basique',
      'Support par email',
    ],
    cta: 'Commencer gratuitement',
    popular: false,
  },
  {
    name: 'Pro',
    monthly: 29000,
    annual: 279000,
    description: 'Pour les PME du BTP en croissance',
    features: [
      'Utilisateurs illimités',
      'Chantiers illimités',
      'Tous les 17 modules',
      'Paie automatique',
      'Mode hors-ligne',
      'Support prioritaire 7j/7',
    ],
    cta: 'Démarrer l’essai 14 jours',
    popular: true,
  },
  {
    name: 'Enterprise',
    monthly: null,
    annual: null,
    description: 'Pour les grands groupes et sur-mesure',
    features: [
      'SSO & SAML',
      'Multi-sociétés',
      'API & webhooks',
      'Hébergement dédié',
      'Onboarding personnalisé',
      'Account manager dédié',
    ],
    cta: 'Contacter l’équipe',
    popular: false,
  },
] as const

const TESTIMONIALS: {
  name: string
  role: string
  initials: string
  quote: string
}[] = [
  {
    name: 'Konan Yao',
    role: 'Directeur Général, BTP Côte d’Ivoire SARL',
    initials: 'KY',
    quote:
      'Depuis O.P.U.C, nos pointages sont fiables et la paie se fait en 2 jours au lieu de 8. Un gain de temps spectaculaire pour nos chantiers d’Abidjan.',
  },
  {
    name: 'Aminata Traoré',
    role: 'Chef Comptable, Groupe SOTCI',
    initials: 'AT',
    quote:
      'Le suivi multi-chantier nous a changé la vie. On sait enfin où va chaque sac de ciment, chaque litre de gasoil. La transparence est totale.',
  },
  {
    name: 'Marc-André Kouassi',
    role: 'Conducteur de travaux, KBC Construction',
    initials: 'MK',
    quote:
      'L’appli mobile fonctionne même sans réseau sur mes chantiers de l’intérieur. La synchronisation auto est redoutable. Plus aucune excuse pour rater un pointage.',
  },
]

const FAQS: { question: string; answer: string }[] = [
  {
    question: 'O.P.U.C fonctionne-t-il hors connexion sur le chantier ?',
    answer:
      'Oui. L’application mobile dispose d’un mode hors-ligne complet. Les pointages, photos et entrées de stock sont enregistrés localement puis synchronisés automatiquement dès que la connexion revient. Aucune donnée n’est perdue.',
  },
  {
    question: 'Combien de temps prend la mise en place ?',
    answer:
      'La création du compte prend 2 minutes. L’import de votre personnel, chantiers et stocks peut être réalisé via CSV ou accompagné par notre équipe. La plupart de nos clients sont opérationnels en moins de 48h.',
  },
  {
    question: 'Mes données sont-elles sécurisées ?',
    answer:
      'Toutes les données sont chiffrées en transit (TLS 1.3) et au repos (AES-256). Les sauvegardes sont quotidiennes avec rétention 30 jours. Nous hébergeons sur des infrastructures certifiées et offrons l’authentification à deux facteurs.',
  },
  {
    question: 'Puis-je changer d’offre ou résilier à tout moment ?',
    answer:
      'Absolument. Vous pouvez upgrader, downgrader ou résilier votre abonnement à tout moment depuis l’interface. Aucun engagement de durée, aucun frais caché. Le prorata est calculé automatiquement.',
  },
  {
    question: 'Proposez-vous un accompagnement à la prise en main ?',
    answer:
      'Oui. L’offre Pro inclut une session de formation de 2h pour vos équipes. L’offre Enterprise inclut un onboarding personnalisé sur site et un account manager dédié pour accompagner la transformation digitale de votre entreprise.',
  },
]

const FOOTER_COLUMNS: {
  title: string
  links: { label: string; target?: string; action?: 'login' }[]
}[] = [
  {
    title: 'Produit',
    links: [
      { label: 'Fonctionnalités', target: 'fonctionnalites' },
      { label: 'Tarifs', target: 'tarifs' },
      { label: 'Témoignages', target: 'temoignages' },
      { label: 'FAQ', target: 'faq' },
    ],
  },
  {
    title: 'Entreprise',
    links: [
      { label: 'À propos' },
      { label: 'Blog' },
      { label: 'Carrières' },
      { label: 'Contact' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { label: 'Conditions d’utilisation' },
      { label: 'Politique de confidentialité' },
      { label: 'Mentions légales' },
      { label: 'RGPD' },
    ],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// FLOATING ORBS (Hero background)
// ═══════════════════════════════════════════════════════════════════════════════

function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <motion.div
        animate={{
          x: [0, 60, 0],
          y: [0, -40, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-amber-400/30 blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, -50, 0],
          y: [0, 50, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-20 -right-32 w-[32rem] h-[32rem] rounded-full bg-orange-500/25 blur-3xl"
      />
      <motion.div
        animate={{
          x: [0, 40, 0],
          y: [0, -60, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-0 left-1/3 w-[26rem] h-[26rem] rounded-full bg-amber-300/30 blur-3xl"
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════════════════════

function Navbar({ onLoginClick }: { onLoginClick: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: EASE_OUT }}
      className="fixed top-0 inset-x-0 z-50"
    >
      <nav className="backdrop-blur-xl bg-white/70 border-b border-white/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <button
              onClick={() => scrollTo('hero')}
              className="flex items-center gap-2.5 group"
            >
              <OpucLogo
                size={40}
                className="transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3"
              />
              <div className="hidden sm:flex flex-col leading-none">
                <span className="text-lg font-bold text-slate-900 tracking-tight">
                  O.P.U.C
                </span>
                <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-[0.2em]">
                  BTP SaaS
                </span>
              </div>
            </button>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.target}
                  onClick={() => scrollTo(link.target)}
                  className="relative px-4 py-2 text-sm font-medium text-slate-700 hover:text-amber-700 rounded-lg transition-colors group"
                >
                  {link.label}
                  <span className="absolute inset-x-3 -bottom-0.5 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                </button>
              ))}
            </div>

            {/* Desktop CTAs */}
            <div className="hidden lg:flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={onLoginClick}
                className="text-slate-700 hover:text-amber-700 hover:bg-amber-50/60"
              >
                Se connecter
              </Button>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  onClick={onLoginClick}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg shadow-amber-500/30 border-0"
                >
                  Essai gratuit
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -mr-2 text-slate-700 rounded-lg hover:bg-amber-50/60 transition-colors"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm lg:hidden z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-white/95 backdrop-blur-xl border-l border-amber-100 lg:hidden z-50 p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2.5">
                  <OpucLogo size={36} />
                  <span className="text-lg font-bold text-slate-900">O.P.U.C</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 text-slate-600 rounded-lg hover:bg-amber-50 transition-colors"
                  aria-label="Fermer le menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {NAV_LINKS.map((link, i) => (
                  <motion.button
                    key={link.target}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.06 }}
                    onClick={() => {
                      scrollTo(link.target)
                      setMobileOpen(false)
                    }}
                    className="text-left px-4 py-3 text-base font-medium text-slate-700 hover:text-amber-700 hover:bg-amber-50/60 rounded-lg transition-colors"
                  >
                    {link.label}
                  </motion.button>
                ))}
              </div>

              <div className="mt-auto flex flex-col gap-3 pt-6 border-t border-amber-100">
                <Button
                  variant="outline"
                  onClick={() => {
                    onLoginClick()
                    setMobileOpen(false)
                  }}
                  className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  Se connecter
                </Button>
                <Button
                  onClick={() => {
                    onLoginClick()
                    setMobileOpen(false)
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                >
                  Essai gratuit
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO — Mock Dashboard Preview
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardPreview() {
  const bars = [40, 65, 50, 80, 60, 95, 72]
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: 2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.8, delay: 0.3, ease: EASE_OUT }}
      className="relative w-full"
    >
      {/* Glow halo */}
      <div className="absolute -inset-4 bg-gradient-to-br from-amber-400/30 via-orange-400/20 to-transparent rounded-3xl blur-2xl" />

      {/* Glass card */}
      <div className="relative backdrop-blur-xl bg-white/70 border border-white/60 rounded-2xl shadow-2xl shadow-amber-900/10 overflow-hidden">
        {/* Window top bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-100/60 bg-white/50">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="w-3 h-3 rounded-full bg-orange-400" />
            <span className="w-3 h-3 rounded-full bg-amber-300" />
          </div>
          <div className="flex-1 mx-2 h-6 rounded-md bg-amber-50/80 border border-amber-100 flex items-center justify-center">
            <span className="text-[10px] font-mono text-amber-700/70">
              app.opuc.ci/chantier/cocody
            </span>
          </div>
        </div>

        {/* Dashboard body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Tableau de bord</p>
              <h3 className="text-base font-bold text-slate-900">
                Chantier Cocody Bay
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              En cours
            </span>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Pointages', value: '142', icon: Users, color: 'amber' },
              { label: 'Heures', value: '1 248h', icon: Clock, color: 'orange' },
              { label: 'Alertes', value: '3', icon: ShieldCheck, color: 'amber' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="rounded-xl bg-white/70 border border-amber-100 p-2.5"
              >
                <div className="flex items-center gap-1.5 text-amber-600 mb-1">
                  <stat.icon className="w-3 h-3" />
                  <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wide">
                    {stat.label}
                  </span>
                </div>
                <p className="text-base font-bold text-slate-900">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Chart */}
          <div className="rounded-xl bg-white/60 border border-amber-100 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-600">
                Heures travaillées / jour
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                <TrendingUp className="w-3 h-3" />
                +12%
              </span>
            </div>
            <div className="flex items-end justify-between gap-1.5 h-16">
              {bars.map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 0.7 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-amber-500 to-orange-400"
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {days.map((d, i) => (
                <span key={i} className="text-[8px] text-slate-400 flex-1 text-center">
                  {d}
                </span>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="rounded-xl bg-white/60 border border-amber-100 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-600">
                Avancement chantier
              </span>
              <span className="text-[10px] font-bold text-amber-700">67%</span>
            </div>
            <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '67%' }}
                transition={{ delay: 1, duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating mini cards */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="absolute -top-4 -right-4 sm:-right-6 backdrop-blur-xl bg-white/80 border border-white/70 rounded-xl shadow-lg p-2.5 hidden sm:block"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[9px] text-slate-500">Pointage validé</p>
            <p className="text-[10px] font-bold text-slate-900">Équipe B - 06h42</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.4, duration: 0.5 }}
        className="absolute -bottom-4 -left-4 sm:-left-6 backdrop-blur-xl bg-white/80 border border-white/70 rounded-xl shadow-lg p-2.5 hidden sm:block"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[9px] text-slate-500">Paie générée</p>
            <p className="text-[10px] font-bold text-slate-900">2,4M FCFA · 28 employés</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HERO SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function Hero({ onLoginClick }: { onLoginClick: () => void }) {
  const stats = [
    { value: '17', label: 'Modules', icon: Layers },
    { value: '4', label: 'Rôles', icon: Users },
    { value: '111+', label: 'Endpoints API', icon: Server },
    { value: '0€', label: '/ mois pour démarrer', icon: Sparkles },
  ]

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center pt-24 pb-16 overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50/40 to-white"
    >
      <FloatingOrbs />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left content */}
          <motion.div
            variants={containerStagger}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-start text-left"
          >
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur border border-amber-200 text-amber-700 text-xs font-medium mb-6 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Nouveau · Pointage mobile hors-ligne 2.0
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-slate-900 leading-[1.05] mb-6"
            >
              La gestion de{' '}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                  chantier
                </span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.8, duration: 0.6, ease: 'easeOut' }}
                  className="absolute -bottom-1 inset-x-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full origin-left"
                />
              </span>{' '}
              simplifiée.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-base sm:text-lg text-slate-600 max-w-xl mb-8 leading-relaxed"
            >
              O.P.U.C est la plateforme SaaS tout-en-un pour les entreprises BTP en
              Côte d’Ivoire. Pointage mobile, paie automatique, stock multi-chantier,
              carburant et devis — réunis dans une interface unique, accessible
              même hors-ligne.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mb-8"
            >
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto"
              >
                <Button
                  onClick={onLoginClick}
                  size="lg"
                  className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-xl shadow-amber-500/30 border-0 h-12 px-7 text-base"
                >
                  Essai gratuit 14 jours
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto"
              >
                <Button
                  onClick={() => scrollTo('fonctionnalites')}
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto backdrop-blur-xl bg-white/60 border-amber-200/80 text-slate-800 hover:bg-white/80 hover:text-amber-700 h-12 px-7 text-base"
                >
                  <Play className="w-4 h-4" />
                  Voir la démo
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600"
            >
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-amber-600" />
                Sans carte bancaire
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-amber-600" />
                Setup en 2 minutes
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-amber-600" />
                Support en français
              </div>
            </motion.div>
          </motion.div>

          {/* Right visual */}
          <div className="relative">
            <DashboardPreview />
          </div>
        </div>

        {/* Stats bar */}
        <motion.div
          variants={containerStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="mt-16 lg:mt-24 grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="backdrop-blur-xl bg-white/60 border border-white/70 rounded-2xl p-4 lg:p-6 text-center shadow-sm"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700 mb-2">
                <stat.icon className="w-5 h-5" />
              </div>
              <div className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-xs lg:text-sm text-slate-500 mt-0.5">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION HEADER (shared)
// ═══════════════════════════════════════════════════════════════════════════════

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: ReactNode
  subtitle: string
}) {
  return (
    <motion.div
      variants={containerStagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      className="text-center max-w-2xl mx-auto mb-12 lg:mb-16"
    >
      <motion.div
        variants={fadeUp}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100/70 border border-amber-200 text-amber-700 text-xs font-semibold uppercase tracking-wider mb-4"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {eyebrow}
      </motion.div>
      <motion.h2
        variants={fadeUp}
        className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-4"
      >
        {title}
      </motion.h2>
      <motion.p
        variants={fadeUp}
        className="text-base lg:text-lg text-slate-600"
      >
        {subtitle}
      </motion.p>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function FeaturesSection() {
  return (
    <section
      id="fonctionnalites"
      className="relative py-20 lg:py-28 bg-gradient-to-b from-white to-amber-50/50 overflow-hidden"
    >
      {/* Decorative blurred blobs */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-orange-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Fonctionnalités"
          title={
            <>
              Tout ce dont vous avez{' '}
              <span className="bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
                besoin
              </span>
            </>
          }
          subtitle="17 modules intégrés pour piloter l’intégralité de votre activité BTP, du pointage à la facturation."
        />

        <motion.div
          variants={containerStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6"
        >
          {FEATURES.map((feature) => (
            <motion.div
              key={feature.title}
              variants={fadeUp}
              whileHover={{ y: -8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="group relative backdrop-blur-xl bg-white/70 border border-white/70 rounded-2xl p-6 shadow-sm hover:shadow-2xl hover:shadow-amber-500/10 transition-shadow"
            >
              {/* Glow on hover */}
              <div
                className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500 pointer-events-none`}
              />

              <div
                className={`relative inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} text-white shadow-lg mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}
              >
                <feature.icon className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function formatPrice(amount: number | null): string {
  if (amount === null) return 'Sur mesure'
  if (amount === 0) return '0€'
  return `${amount.toLocaleString('fr-FR')} FCFA`
}

function PricingSection({ onLoginClick }: { onLoginClick: () => void }) {
  const [annual, setAnnual] = useState(false)

  return (
    <section
      id="tarifs"
      className="relative py-20 lg:py-28 bg-gradient-to-b from-amber-50/50 to-white overflow-hidden"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40rem] h-80 bg-amber-300/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Tarifs"
          title={
            <>
              Des tarifs{' '}
              <span className="bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
                adaptés
              </span>{' '}
              à votre croissance
            </>
          }
          subtitle="Commencez gratuitement, évoluez quand vous êtes prêt. Sans engagement, sans carte bancaire."
        />

        {/* Billing toggle */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-3 mb-10"
        >
          <span
            className={`text-sm font-medium transition-colors ${
              !annual ? 'text-slate-900' : 'text-slate-500'
            }`}
          >
            Mensuel
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative w-14 h-7 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 p-1 shadow-inner"
            aria-label="Basculer mensuel / annuel"
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`block w-5 h-5 rounded-full bg-white shadow-md ${
                annual ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium transition-colors ${
              annual ? 'text-slate-900' : 'text-slate-500'
            }`}
          >
            Annuel
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
            -20%
          </span>
        </motion.div>

        {/* Pricing cards */}
        <motion.div
          variants={containerStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid lg:grid-cols-3 gap-6 lg:gap-8 items-stretch"
        >
          {PRICING_PLANS.map((plan) => (
            <motion.div
              key={plan.name}
              variants={fadeUp}
              whileHover={{ y: -8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`relative rounded-2xl p-[1.5px] ${
                plan.popular
                  ? 'bg-gradient-to-b from-amber-400 via-orange-500 to-amber-600 shadow-2xl shadow-amber-500/30 lg:scale-105'
                  : 'bg-white/70 border border-white/70'
              }`}
            >
              <div
                className={`relative h-full rounded-2xl p-6 lg:p-7 flex flex-col ${
                  plan.popular
                    ? 'bg-white/90 backdrop-blur-xl'
                    : 'backdrop-blur-xl bg-white/70'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
                      <Star className="w-3 h-3 fill-current" />
                      Populaire
                    </span>
                  </div>
                )}

                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {plan.name}
                </h3>
                <p className="text-xs text-slate-500 mb-5 min-h-[2rem]">
                  {plan.description}
                </p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl lg:text-4xl font-bold text-slate-900">
                      {formatPrice(annual ? plan.annual : plan.monthly)}
                    </span>
                    {plan.monthly !== null && plan.monthly !== 0 && (
                      <span className="text-sm text-slate-500">
                        / {annual ? 'an' : 'mois'}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  onClick={onLoginClick}
                  className={`w-full mb-6 h-11 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-lg shadow-amber-500/30'
                      : 'bg-white border border-amber-200 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {plan.cta}
                </Button>

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-2.5 text-sm text-slate-700"
                    >
                      <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-amber-700" />
                      </span>
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTIMONIALS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function TestimonialsSection() {
  return (
    <section
      id="temoignages"
      className="relative py-20 lg:py-28 bg-gradient-to-b from-white to-amber-50/50 overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-80 h-80 bg-orange-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Témoignages"
          title={
            <>
              Ils nous font{' '}
              <span className="bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
                confiance
              </span>
            </>
          }
          subtitle="Des entreprises BTP ivoiriennes de toutes tailles pilotent leurs chantiers avec O.P.U.C au quotidien."
        />

        <motion.div
          variants={containerStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid md:grid-cols-3 gap-6"
        >
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              variants={i % 2 === 0 ? slideInLeft : slideInRight}
              whileHover={{ y: -6 }}
              className="relative backdrop-blur-xl bg-white/70 border border-white/70 rounded-2xl p-6 lg:p-7 shadow-sm hover:shadow-xl hover:shadow-amber-500/10 transition-shadow"
            >
              <Quote className="w-8 h-8 text-amber-300 mb-4" />

              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, s) => (
                  <Star
                    key={s}
                    className="w-4 h-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              <p className="text-sm text-slate-700 leading-relaxed mb-6">
                « {t.quote} »
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-amber-100">
                <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold flex items-center justify-center text-sm shadow-md">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FAQ SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
  index,
}: {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay: index * 0.05 }}
      className={`backdrop-blur-xl bg-white/70 border rounded-2xl overflow-hidden transition-colors ${
        isOpen
          ? 'border-amber-300 shadow-lg shadow-amber-500/10'
          : 'border-white/70 hover:border-amber-200'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 lg:px-6 py-4 lg:py-5 text-left"
      >
        <span className="text-sm lg:text-base font-semibold text-slate-900">
          {question}
        </span>
        <span
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            isOpen
              ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {isOpen ? (
            <Minus className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="px-5 lg:px-6 pb-5 text-sm text-slate-600 leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section
      id="faq"
      className="relative py-20 lg:py-28 bg-gradient-to-b from-amber-50/50 to-white overflow-hidden"
    >
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="FAQ"
          title={
            <>
              Questions{' '}
              <span className="bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
                fréquentes
              </span>
            </>
          }
          subtitle="Tout ce que vous devez savoir sur la plateforme O.P.U.C avant de vous lancer."
        />

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <FaqItem
              key={i}
              index={i}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>

        {/* Help banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-10 text-center"
        >
          <p className="text-sm text-slate-600">
            Une autre question ?{' '}
            <a
              href="mailto:contact@opuc.ci"
              className="font-semibold text-amber-700 hover:text-amber-800 underline-offset-2 hover:underline"
            >
              Écrivez-nous
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CTA BANNER
// ═══════════════════════════════════════════════════════════════════════════════

function CtaBanner({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <section className="relative py-20 lg:py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 px-6 py-14 lg:px-16 lg:py-20 text-center shadow-2xl shadow-orange-500/30"
        >
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-20" aria-hidden>
            <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-white/30 blur-2xl" />
            <div className="absolute top-1/2 -right-12 w-64 h-64 rounded-full bg-amber-200/40 blur-3xl" />
            <div className="absolute -bottom-16 left-1/3 w-56 h-56 rounded-full bg-orange-300/30 blur-3xl" />
          </div>

          <div className="relative">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4 max-w-3xl mx-auto"
            >
              Prêt à transformer la gestion de vos chantiers ?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-base lg:text-lg text-amber-50 max-w-xl mx-auto mb-8"
            >
              Rejoignez les entreprises BTP ivoiriennes qui digitalisent leur
              opérationnel avec O.P.U.C. Aucune carte bancaire requise.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                <Button
                  onClick={onLoginClick}
                  size="lg"
                  className="bg-white text-amber-700 hover:bg-amber-50 hover:text-amber-800 shadow-xl h-12 px-8 text-base border-0"
                >
                  Démarrer l’essai gratuit
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                <Button
                  onClick={() => scrollTo('tarifs')}
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white hover:border-white h-12 px-8 text-base"
                >
                  Voir les tarifs
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════════════

function SocialIcon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-4 h-4"
      aria-hidden
    >
      <path d={path} />
    </svg>
  )
}

const SOCIAL_LINKS = [
  {
    label: 'Facebook',
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  },
  {
    label: 'Twitter',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    label: 'LinkedIn',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  },
  {
    label: 'YouTube',
    path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
]

function Footer({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <footer className="relative bg-slate-900 text-slate-300 overflow-hidden">
      {/* Top glow line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        <div className="grid gap-10 lg:gap-12 lg:grid-cols-5 mb-12">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <OpucLogo size={44} />
              <div className="flex flex-col leading-none">
                <span className="text-xl font-bold text-white tracking-tight">
                  O.P.U.C
                </span>
                <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-[0.2em]">
                  BTP SaaS
                </span>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm mb-6">
              La plateforme tout-en-un pour la gestion de chantier BTP en
              Côte d’Ivoire. Pointage, paie, stock, carburant et facturation —
              réunis dans une seule application.
            </p>

            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => (
                <motion.a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  whileHover={{ scale: 1.12, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/40 hover:bg-slate-800/80 flex items-center justify-center transition-colors"
                >
                  <SocialIcon path={social.path} />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                {col.title}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => {
                        if (link.target) {
                          scrollTo(link.target)
                        } else if (link.action === 'login') {
                          onLoginClick()
                        }
                      }}
                      className="text-sm text-slate-400 hover:text-amber-400 transition-colors text-left"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} O.P.U.C — Tous droits réservés.
            Conçu en Côte d’Ivoire 🇨🇮
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Tous les systèmes opérationnels
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function LandingPage({ onLoginClick }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased overflow-x-hidden">
      <Navbar onLoginClick={onLoginClick} />
      <main>
        <Hero onLoginClick={onLoginClick} />
        <FeaturesSection />
        <PricingSection onLoginClick={onLoginClick} />
        <TestimonialsSection />
        <FaqSection />
        <CtaBanner onLoginClick={onLoginClick} />
      </main>
      <Footer onLoginClick={onLoginClick} />
    </div>
  )
}
