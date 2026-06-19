'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import Image from 'next/image'
import { OpucLogo } from '@/components/layout/opuc-logo'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet'
import {
  Menu,
  X,
  Check,
  ChevronRight,
  ArrowRight,
  Shield,
  Smartphone,
  BarChart3,
  Users,
  FileText,
  Package,
  Building2,
  Star,
  Clock,
  WifiOff,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LandingPageProps {
  onLoginClick: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Smooth-scroll to an element by ID */
function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

/** IntersectionObserver hook for fade-in-up animations */
function useScrollReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(() => {
    // If user prefers reduced motion, start visible
    if (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return true
    }
    return false
  })

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Already visible (e.g. reduced motion), no need to observe
    if (isVisible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(node)
        }
      },
      { threshold }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, isVisible])

  return { ref, isVisible }
}

/** Reusable section wrapper with scroll-reveal */
function RevealSection({
  children,
  className = '',
  id,
  threshold,
}: {
  children: ReactNode
  className?: string
  id?: string
  threshold?: number
}) {
  const { ref, isVisible } = useScrollReveal(threshold)
  return (
    <section
      id={id}
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
    >
      {children}
    </section>
  )
}

// ─── Navigation Links Data ─────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Fonctionnalités', href: '#fonctionnalites' },
  { label: 'Tarifs', href: '#tarifs' },
  { label: 'Témoignages', href: '#temoignages' },
  { label: 'FAQ', href: '#faq' },
]

// ─── Main Component ────────────────────────────────────────────────────────

export function LandingPage({ onLoginClick }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Track scroll for sticky nav background
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile sheet on link click
  const handleNavClick = useCallback((href: string) => {
    setMobileOpen(false)
    const id = href.replace('#', '')
    scrollTo(id)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* ─── Skip to content (a11y) ─── */}
      <a
        href="#contenu-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm"
      >
        Aller au contenu principal
      </a>

      {/* ═══════════════════════════════════════════════════════════════════════
          1. STICKY NAVIGATION BAR
         ═══════════════════════════════════════════════════════════════════════ */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-background/95 backdrop-blur-md border-b shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          {/* Logo + brand */}
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <OpucLogo size={36} />
            <span className="text-lg font-bold tracking-tight">O.P.U.C.</span>
          </button>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNavClick(link.href)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 py-1"
              >
                {link.label}
              </button>
            ))}
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={onLoginClick}
            >
              Se connecter
            </Button>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Ouvrir le menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <OpucLogo size={28} />
                    <span>O.P.U.C.</span>
                  </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 mt-6 px-4">
                  {NAV_LINKS.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <button
                        onClick={() => handleNavClick(link.href)}
                        className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors text-left"
                      >
                        {link.label}
                        <ChevronRight className="size-4 text-muted-foreground ml-auto" />
                      </button>
                    </SheetClose>
                  ))}
                  <Separator className="my-2" />
                  <SheetClose asChild>
                    <Button
                      className="bg-amber-500 hover:bg-amber-600 text-white w-full mt-2"
                      onClick={onLoginClick}
                    >
                      Se connecter
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </header>

      {/* ─── Main Content ─── */}
      <main id="contenu-principal" className="flex-1">
        {/* ═══════════════════════════════════════════════════════════════════
            2. HERO SECTION
           ═══════════════════════════════════════════════════════════════════ */}
        <section className="relative min-h-screen flex items-center pt-16">
          {/* Subtle background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50/60 via-background to-orange-50/40 -z-10" />
          <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-amber-200/20 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-orange-200/15 rounded-full blur-3xl -z-10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full py-12 md:py-20">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left column - text */}
              <RevealSection threshold={0.05}>
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-700 border-amber-200 mb-6 px-3 py-1 text-xs sm:text-sm"
                >
                  <Star className="size-3 mr-1 fill-amber-500 text-amber-500" />
                  N°1 de la gestion de chantier en Côte d’Ivoire
                </Badge>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.4rem] font-extrabold leading-[1.1] tracking-tight">
                  La gestion de chantier{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">
                    simplifiée
                  </span>{' '}
                  pour les entreprises BTP
                </h1>
                <p className="mt-6 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                  O.P.U.C. centralise vos chantiers, pointages, budgets et
                  documents en une seule plateforme intuitive. Fonctionne
                  hors-ligne sur le terrain.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    className="bg-amber-500 hover:bg-amber-600 text-white h-12 px-8 text-base"
                    onClick={onLoginClick}
                  >
                    Essai gratuit 14 jours
                    <ArrowRight className="size-4 ml-1" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 px-8 text-base"
                    onClick={() => scrollTo('fonctionnalites')}
                  >
                    Voir la démo
                  </Button>
                </div>
              </RevealSection>

              {/* Right column - image */}
              <RevealSection threshold={0.08} className="hidden lg:block">
                <div className="relative">
                  <div className="absolute -inset-4 bg-gradient-to-br from-amber-200/30 to-orange-200/30 rounded-3xl blur-2xl" />
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl rotate-1 hover:rotate-0 transition-transform duration-500">
                    <Image
                      src="/landing-hero.png"
                      alt="Tableau de bord O.P.U.C. - Gestion de chantier BTP"
                      width={640}
                      height={480}
                      className="w-full h-auto"
                      priority
                    />
                  </div>
                </div>
              </RevealSection>
            </div>

            {/* Stats row */}
            <RevealSection className="mt-16 md:mt-20">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
                {[
                  { value: '150+', label: 'entreprises' },
                  { value: '5 000+', label: 'chantiers' },
                  { value: '25 000+', label: 'pointages/mois' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="text-center sm:text-left p-4 rounded-xl bg-card border"
                  >
                    <div className="text-2xl sm:text-3xl font-bold text-amber-600">
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            3. TRUST BAR / SOCIAL PROOF
           ═══════════════════════════════════════════════════════════════════ */}
        <RevealSection className="py-16 md:py-20 bg-muted/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-widest mb-8">
              Ils nous font confiance
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 md:gap-16">
              {[
                'CI BÂTIMENT',
                'ABIDJAN CONSTRUCTION',
                'AFRICAN HABITAT',
                'IVOIRE TRAVAUX',
                'COSTA CONSTRUCTION',
                'LAGOS BTP',
              ].map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-center px-5 py-3 rounded-lg bg-background border border-border/50"
                >
                  <span className="text-xs sm:text-sm font-semibold text-muted-foreground/80 tracking-wide">
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* ═══════════════════════════════════════════════════════════════════
            4. PROBLEM → SOLUTION SECTION
           ═══════════════════════════════════════════════════════════════════ */}
        <RevealSection className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12 md:mb-16">
              <Badge
                variant="outline"
                className="mb-4 border-amber-300 text-amber-600"
              >
                Avant / Après
              </Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                De la confusion à la clarté
              </h2>
            </div>

            <div className="grid md:grid-cols-[1fr,auto,1fr] gap-8 md:gap-6 items-start">
              {/* Problem column */}
              <div className="rounded-2xl border border-red-200 bg-red-50/40 p-6 md:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex items-center justify-center size-10 rounded-full bg-red-100">
                    <AlertTriangle className="size-5 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-red-700">
                    Le chaos du chantier
                  </h3>
                </div>
                <ul className="space-y-4">
                  {[
                    'Pointages sur papier perdus',
                    'Budgets incontrôlables',
                    'Documents éparpillés',
                    'Communication chaotique entre équipes',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 flex items-center justify-center size-5 rounded-full bg-red-100 shrink-0">
                        <X className="size-3 text-red-500" />
                      </span>
                      <span className="text-sm text-red-800/80">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* VS divider - desktop */}
              <div className="hidden md:flex flex-col items-center justify-center self-center gap-2 py-8">
                <div className="w-px h-12 bg-border" />
                <div className="flex items-center justify-center size-12 rounded-full bg-amber-100 border-2 border-amber-300">
                  <ArrowRight className="size-5 text-amber-600 rotate-90" />
                </div>
                <div className="w-px h-12 bg-border" />
              </div>
              {/* VS divider - mobile */}
              <div className="flex md:hidden items-center justify-center gap-4 py-4">
                <Separator className="flex-1" />
                <ArrowRight className="size-5 text-amber-500" />
                <Separator className="flex-1" />
              </div>

              {/* Solution column */}
              <div className="rounded-2xl border border-green-200 bg-green-50/40 p-6 md:p-8">
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex items-center justify-center size-10 rounded-full bg-green-100">
                    <Check className="size-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold text-green-700">
                    Avec O.P.U.C.
                  </h3>
                </div>
                <ul className="space-y-4">
                  {[
                    'Pointage mobile en temps réel',
                    'Suivi budget au centime près',
                    'Tout centralisé et traçable',
                    'Collaboration fluide entre équipes',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 flex items-center justify-center size-5 rounded-full bg-green-100 shrink-0">
                        <Check className="size-3 text-green-600" />
                      </span>
                      <span className="text-sm text-green-800/80">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </RevealSection>

        {/* ═══════════════════════════════════════════════════════════════════
            5. FEATURES SECTION
           ═══════════════════════════════════════════════════════════════════ */}
        <RevealSection
          className="py-20 md:py-28 bg-muted/30"
          id="fonctionnalites"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12 md:mb-16">
              <Badge
                variant="outline"
                className="mb-4 border-amber-300 text-amber-600"
              >
                Fonctionnalités
              </Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                Tout ce dont vous avez besoin
              </h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                Une plateforme complète pour piloter vos chantiers de A à Z
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Building2,
                  title: 'Gestion des Chantiers',
                  description:
                    "Créez, suivez et pilotez tous vos chantiers. Phases, avancement, planning et jalons en un coup d'œil.",
                },
                {
                  icon: Users,
                  title: 'Personnel & Pointage',
                  description:
                    'Pointez vos équipes depuis le terrain. Application mobile, horodatage automatique et rapports détaillés.',
                },
                {
                  icon: BarChart3,
                  title: 'Budget & Trésorerie',
                  description:
                    'Contrôlez vos dépenses en temps réel. Prévisions, écarts budgétaires et alertes pour ne jamais dépasser.',
                },
                {
                  icon: Package,
                  title: 'Stocks & Matériaux',
                  description:
                    "Gérez votre inventaire de matériaux. Suivi des entrées/sorties, alertes de seuil et approvisionnement.",
                },
                {
                  icon: FileText,
                  title: 'Documents & Rapports',
                  description:
                    'Centralisez tous vos documents. Bon de commande, PV de réception, rapports PDF automatisés.',
                },
                {
                  icon: Shield,
                  title: 'Sécurité Multi-tenant',
                  description:
                    "Isolation totale des données. 6 niveaux d'accès, authentification 2FA et traçabilité complète.",
                },
              ].map((feature) => (
                <Card
                  key={feature.title}
                  className="group hover:border-amber-300 hover:shadow-md transition-all duration-300 py-0 gap-0"
                >
                  <CardHeader className="pt-6 pb-0">
                    <div className="flex items-center justify-center size-12 rounded-xl bg-amber-100 text-amber-600 mb-3 group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
                      <feature.icon className="size-6" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-6 pt-2">
                    <CardDescription className="text-sm leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* ═══════════════════════════════════════════════════════════════════
            6. MOBILE / PWA SECTION
           ═══════════════════════════════════════════════════════════════════ */}
        <RevealSection className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Image column */}
              <div className="order-2 lg:order-1 relative">
                <div className="absolute -inset-4 bg-gradient-to-tr from-amber-100/40 to-orange-100/40 rounded-3xl blur-2xl" />
                <div className="relative rounded-2xl overflow-hidden shadow-2xl -rotate-2 hover:rotate-0 transition-transform duration-500 max-w-md mx-auto">
                  <Image
                    src="/landing-mobile.png"
                    alt="Application mobile O.P.U.C. - Pointage hors-ligne sur le terrain"
                    width={480}
                    height={640}
                    className="w-full h-auto"
                  />
                </div>
              </div>

              {/* Text column */}
              <div className="order-1 lg:order-2">
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-700 border-amber-200 mb-4"
                >
                  <Smartphone className="size-3 mr-1" />
                  Application Mobile
                </Badge>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
                  Travaillez{' '}
                  <span className="text-amber-600">hors-ligne</span> sur le
                  terrain
                </h2>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  L&apos;application O.P.U.C. est conçue pour les conditions
                  réelles des chantiers, même sans connexion internet.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    {
                      icon: WifiOff,
                      text: 'Pointage hors-ligne, synchronisation automatique',
                    },
                    {
                      icon: MapPin,
                      text: 'Photos de chantier géolocalisées',
                    },
                    {
                      icon: Smartphone,
                      text: 'Compatible tablettes et smartphones',
                    },
                    {
                      icon: Check,
                      text: "Installation en tant qu'application native (PWA)",
                    },
                  ].map((item) => (
                    <li key={item.text} className="flex items-start gap-3">
                      <div className="mt-0.5 flex items-center justify-center size-6 rounded-full bg-green-100 shrink-0">
                        <item.icon className="size-3.5 text-green-600" />
                      </div>
                      <span className="text-sm">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </RevealSection>

        {/* ═══════════════════════════════════════════════════════════════════
            7. PRICING SECTION
           ═══════════════════════════════════════════════════════════════════ */}
        <RevealSection className="py-20 md:py-28 bg-muted/30" id="tarifs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12 md:mb-16">
              <Badge
                variant="outline"
                className="mb-4 border-amber-300 text-amber-600"
              >
                Tarifs
              </Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                Des tarifs adaptés à votre entreprise
              </h2>
            </div>

            <PricingSection onLoginClick={onLoginClick} />

            <p className="text-center text-xs sm:text-sm text-muted-foreground mt-8">
              Tous les plans incluent 14 jours d&apos;essai gratuit. Aucune
              carte bancaire requise.
            </p>
          </div>
        </RevealSection>

        {/* ═══════════════════════════════════════════════════════════════════
            8. TESTIMONIALS SECTION
           ═══════════════════════════════════════════════════════════════════ */}
        <RevealSection className="py-20 md:py-28" id="temoignages">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12 md:mb-16">
              <Badge
                variant="outline"
                className="mb-4 border-amber-300 text-amber-600"
              >
                Témoignages
              </Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                Ce que disent nos clients
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  quote:
                    "O.P.U.C. a réduit nos retards de 40%. Le pointage mobile a transformé notre gestion de terrain.",
                  name: 'Moussa K.',
                  title: 'Directeur Général',
                  company: 'CI Bâtiment',
                  city: 'Abidjan',
                  initials: 'MK',
                  color: 'bg-amber-500',
                },
                {
                  quote:
                    "Enfin un outil conçu pour les entreprises BTP africaines. Simple, fiable et le support est réactif.",
                  name: 'Aminata D.',
                  title: 'Chef de projets',
                  company: 'Ivoire Travaux',
                  city: '',
                  initials: 'AD',
                  color: 'bg-orange-500',
                },
                {
                  quote:
                    "On a éliminé les erreurs de paie grâce au suivi horodaté. ROI positif dès le premier mois.",
                  name: 'Yao S.',
                  title: 'Gérant',
                  company: 'Costa Construction',
                  city: 'San Pedro',
                  initials: 'YS',
                  color: 'bg-green-600',
                },
              ].map((testimonial) => (
                <Card
                  key={testimonial.name}
                  className="py-0 gap-0 hover:shadow-md transition-shadow"
                >
                  <CardContent className="pt-6 pb-6">
                    {/* Stars */}
                    <div className="flex gap-0.5 mb-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="size-4 text-amber-400 fill-amber-400"
                        />
                      ))}
                    </div>
                    <blockquote className="text-sm leading-relaxed text-foreground/90 italic">
                      &ldquo;{testimonial.quote}&rdquo;
                    </blockquote>
                    <Separator className="my-4" />
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className={`flex items-center justify-center size-10 rounded-full ${testimonial.color} text-white text-sm font-bold shrink-0`}
                      >
                        {testimonial.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {testimonial.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {testimonial.title}, {testimonial.company}
                          {testimonial.city
                            ? ` (${testimonial.city})`
                            : ''}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* ═══════════════════════════════════════════════════════════════════
            9. FAQ SECTION
           ═══════════════════════════════════════════════════════════════════ */}
        <RevealSection className="py-20 md:py-28 bg-muted/30" id="faq">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <Badge
                variant="outline"
                className="mb-4 border-amber-300 text-amber-600"
              >
                FAQ
              </Badge>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
                Questions fréquentes
              </h2>
            </div>

            <Card className="py-0 gap-0">
              <CardContent className="px-0 py-0">
                <Accordion type="single" collapsible className="w-full">
                  {[
                    {
                      q: "Comment fonctionne l'essai gratuit ?",
                      a: "Vous bénéficiez de 14 jours d'accès complet à toutes les fonctionnalités du plan Professionnel. Aucune carte bancaire n'est requise. À la fin de la période, choisissez le plan qui vous convient.",
                    },
                    {
                      q: 'Mes données sont-elles sécurisées ?',
                      a: "Absolument. Vos données sont chiffrées (AES-256), isolées par entreprise, et hébergées sur des serveurs sécurisés. Nous proposons aussi l'authentification à deux facteurs (2FA).",
                    },
                    {
                      q: 'Combien de temps faut-il pour la mise en place ?',
                      a: "Votre espace est opérationnel en moins de 24 heures. Notre équipe vous accompagne pour l'import de vos données et la formation de vos équipes.",
                    },
                    {
                      q: 'Puis-je migrer depuis Excel ?',
                      a: 'Oui ! Nous proposons un import automatique de vos données Excel (personnel, chantiers, pointages). Transition fluide et sans perte de données.',
                    },
                    {
                      q: 'O.P.U.C. fonctionne-t-il hors-ligne ?',
                      a: "Oui. L'application mobile fonctionne entièrement hors-ligne grâce à la technologie PWA. Les données se synchronisent automatiquement dès que la connexion est rétablie.",
                    },
                    {
                      q: 'Comment le paiement se fait-il ?',
                      a: 'Paiement par virement bancaire, Mobile Money (Orange Money, MTN Money, Moov Money) ou carte bancaire. Facture mensuelle ou annuelle disponible.',
                    },
                  ].map((item, idx) => (
                    <AccordionItem key={idx} value={`faq-${idx}`}>
                      <AccordionTrigger className="px-6 text-sm sm:text-base font-medium">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="px-6 text-sm text-muted-foreground leading-relaxed">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </RevealSection>

        {/* ═══════════════════════════════════════════════════════════════════
            10. CTA FINAL SECTION
           ═══════════════════════════════════════════════════════════════════ */}
        <RevealSection className="relative overflow-hidden">
          <div className="bg-gradient-to-br from-amber-700 via-amber-800 to-orange-800 py-20 md:py-28">
            {/* Decorative circles */}
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-amber-600/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-orange-600/20 rounded-full blur-3xl" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
                Prêt à transformer la gestion de vos chantiers ?
              </h2>
              <p className="mt-4 text-amber-100/80 text-base sm:text-lg max-w-2xl mx-auto">
                Rejoignez les 150+ entreprises qui font confiance à O.P.U.C.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  className="bg-white text-amber-800 hover:bg-amber-50 h-12 px-8 text-base font-semibold"
                  onClick={onLoginClick}
                >
                  Démarrer l&apos;essai gratuit
                  <ArrowRight className="size-4 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-8 text-base border-white/30 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => scrollTo('faq')}
                >
                  Contacter l&apos;équipe
                </Button>
              </div>
            </div>
          </div>
        </RevealSection>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          11. FOOTER
         ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-neutral-900 text-neutral-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {/* Column 1: Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <OpucLogo size={32} className="brightness-0 invert" />
                <span className="text-white text-lg font-bold">O.P.U.C.</span>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed max-w-xs">
                La plateforme de gestion de chantier nouvelle génération pour
                les entreprises BTP en Côte d&apos;Ivoire.
              </p>
              {/* Social placeholder icons */}
              <div className="flex gap-3 mt-4">
                {[
                  { label: 'Facebook', short: 'FB' },
                  { label: 'Twitter', short: 'TW' },
                  { label: 'LinkedIn', short: 'IN' },
                  { label: 'YouTube', short: 'YT' },
                ].map((social) => (
                  <div
                    key={social.short}
                    className="flex items-center justify-center size-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    aria-label={social.label}
                  >
                    {social.short}
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Produit */}
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">
                Produit
              </h4>
              <ul className="space-y-2.5">
                {[
                  {
                    label: 'Fonctionnalités',
                    href: 'fonctionnalites',
                  },
                  { label: 'Tarifs', href: 'tarifs' },
                  { label: 'Sécurité', href: '' },
                  { label: 'Mises à jour', href: '' },
                ].map((link) => (
                  <li key={link.label}>
                    <button
                      className="text-sm text-neutral-400 hover:text-white transition-colors"
                      onClick={() => {
                        if (link.href) scrollTo(link.href)
                      }}
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Entreprise */}
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">
                Entreprise
              </h4>
              <ul className="space-y-2.5">
                {[
                  'À propos',
                  'Carrières',
                  'Partenaires',
                  'Contact',
                ].map((link) => (
                  <li key={link}>
                    <button className="text-sm text-neutral-400 hover:text-white transition-colors">
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Legal */}
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">Légal</h4>
              <ul className="space-y-2.5">
                {[
                  'CGU',
                  'Politique de confidentialité',
                  'Mentions légales',
                  'RGPD',
                ].map((link) => (
                  <li key={link}>
                    <button className="text-sm text-neutral-400 hover:text-white transition-colors">
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator className="my-8 bg-neutral-800" />

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-neutral-500 text-center sm:text-left">
              &copy; 2025 O.P.U.C. Tous droits réservés. Conçu avec{' '}
              <span className="text-red-400" aria-label="amour">
                ❤
              </span>{' '}
              en Côte d&apos;Ivoire.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Phone className="size-3" />
                +225 00 00 00 00
              </div>
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Mail className="size-3" />
                contact@opuc.ci
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Pricing Section (toggle + cards combined for shared state) ──────────────

function PricingSection({ onLoginClick }: { onLoginClick: () => void }) {
  const [annual, setAnnual] = useState(false)

  const plans = [
    {
      name: 'Starter',
      monthlyPrice: '17 500',
      annualPrice: '14 000',
      description: 'Pour les petits chantiers',
      popular: false,
      features: [
        '1 chantier actif',
        '5 utilisateurs',
        'Pointage mobile',
        'Rapports basiques',
        'Support email',
      ],
      buttonLabel: 'Commencer',
      buttonVariant: 'outline' as const,
    },
    {
      name: 'Professionnel',
      monthlyPrice: '47 500',
      annualPrice: '38 000',
      description: 'Pour les entreprises en croissance',
      popular: true,
      features: [
        'Chantiers illimités',
        '25 utilisateurs',
        'Budget & trésorerie',
        'Gestion des stocks',
        'Documents & rapports avancés',
        'Support prioritaire',
      ],
      buttonLabel: 'Choisir Pro',
      buttonVariant: 'default' as const,
    },
    {
      name: 'Entreprise',
      monthlyPrice: '',
      annualPrice: '',
      description: 'Pour les grands groupes',
      popular: false,
      features: [
        'Tout Professionnel +',
        'Utilisateurs illimités',
        'Multi-sites',
        'API personnalisée',
        'Formation dédiée',
        'Account manager dédié',
      ],
      buttonLabel: 'Nous contacter',
      buttonVariant: 'outline' as const,
    },
  ]

  return (
    <>
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span
          className={`text-sm font-medium transition-colors ${
            !annual ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          Mensuel
        </span>
        <button
          onClick={() => setAnnual(!annual)}
          className="relative inline-flex items-center h-6 w-11 rounded-full bg-amber-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          role="switch"
          aria-checked={annual}
          aria-label="Basculer entre facturation mensuelle et annuelle"
        >
          <span
            className={`inline-block size-5 rounded-full bg-white shadow-sm transform transition-transform ${
              annual ? 'translate-x-[22px]' : 'translate-x-[2px]'
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium transition-colors ${
            annual ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          Annuel
        </span>
        {annual && (
          <Badge className="bg-green-100 text-green-700 border-green-200 text-xs ml-1">
            -20%
          </Badge>
        )}
      </div>

      {/* Pricing cards grid */}
      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative py-0 gap-0 flex flex-col ${
              plan.popular
                ? 'border-2 border-amber-500 shadow-lg shadow-amber-500/10 scale-[1.02]'
                : 'hover:shadow-md'
            } transition-all`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-amber-500 text-white border-amber-500 px-3 py-0.5 text-xs font-semibold">
                  <Star className="size-3 mr-1 fill-white" />
                  Populaire
                </Badge>
              </div>
            )}
            <CardHeader className="pt-8 pb-0">
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4 flex-1">
              <div className="mb-6">
                {plan.monthlyPrice ? (
                  <>
                    <span className="text-3xl sm:text-4xl font-bold text-foreground">
                      {annual ? plan.annualPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">
                      FCFA/mois
                    </span>
                  </>
                ) : (
                  <span className="text-3xl sm:text-4xl font-bold text-foreground">
                    Sur devis
                  </span>
                )}
              </div>
              <Separator className="mb-4" />
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="size-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="pb-8 pt-2">
              <Button
                variant={plan.buttonVariant}
                className={
                  plan.popular
                    ? 'bg-amber-500 hover:bg-amber-600 text-white w-full'
                    : 'w-full'
                }
                size="lg"
                onClick={onLoginClick}
              >
                {plan.buttonLabel}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  )
}
