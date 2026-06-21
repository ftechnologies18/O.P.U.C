// Package http — router.go
// Monte le routeur chi avec tous les middlewares et handlers.
//
// Structure des routes (Phase 1) :
//
//	GET  /api/v1/health                          — healthcheck (public)
//	POST /api/v1/auth/login                      — login (public)
//	POST /api/v1/auth/logout                     — logout (public)
//	GET  /api/v1/auth/me                         — user courant (auth requis)
//	POST /api/v1/auth/2fa/setup                  — setup TOTP (auth requis)
//	POST /api/v1/auth/2fa/verify                 — verify code TOTP (JWT 2fa=false OK)
//	POST /api/v1/auth/2fa/disable                — disable 2FA (auth requis)
//	GET  /api/v1/users                           — list paginée (SUPER_ADMIN, GERANT)
//	POST /api/v1/users                           — create (SUPER_ADMIN, GERANT)
//	GET  /api/v1/users/{id}                      — get by id (auth requis)
//	PUT  /api/v1/users/{id}                      — update (auth requis)
//	DELETE /api/v1/users/{id}                    — soft delete (SUPER_ADMIN)
//	POST /api/v1/users/{id}/toggle-active        — toggle active (SUPER_ADMIN, GERANT)
//	POST /api/v1/users/{id}/reset-password       — reset password (SUPER_ADMIN, GERANT)
//
// Phase 2 — lecture métier :
//
//	GET  /api/v1/chantiers                        — list + KPI (auth requis)
//	GET  /api/v1/chantiers/{id}                   — détail + phases + taches (auth requis)
//	GET  /api/v1/dashboard                        — KPIs agrégés (auth requis)
//	GET  /api/v1/notifications                    — notifs user courant (auth requis)
//	GET  /api/v1/permissions                      — liste PermissionConfig (SUPER_ADMIN, GERANT)
//	GET  /api/v1/audit-logs                       — logs d'audit paginés (SUPER_ADMIN, GERANT)
//
// Phase 3 — write métier :
//
//	Pointage :
//	  GET    /api/v1/pointage                     — list paginée (auth requis)
//	  GET    /api/v1/pointage/summary             — agrégats par chantier + date range
//	  GET    /api/v1/pointage/{id}                — get by id
//	  POST   /api/v1/pointage                     — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  PUT    /api/v1/pointage/{id}                — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  DELETE /api/v1/pointage/{id}                — delete (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  POST   /api/v1/pointage/{id}/validate       — set valide=true (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	Paie :
//	  GET    /api/v1/paie/paiements-hebdo         — list (auth requis)
//	  POST   /api/v1/paie/paiements-hebdo/generate — generate from pointages (GERANT, SUPER_ADMIN)
//	  PUT    /api/v1/paie/paiements-hebdo/{id}    — update (GERANT, SUPER_ADMIN)
//	  GET    /api/v1/paie/salaires                — list (auth requis)
//	  POST   /api/v1/paie/salaires/generate       — generate SalaireMensuel (GERANT, SUPER_ADMIN)
//	  PUT    /api/v1/paie/salaires/{id}           — update (GERANT, SUPER_ADMIN)
//	Stock :
//	  GET    /api/v1/stocks                       — list avec quantiteDisponible
//	  POST   /api/v1/stocks                       — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  GET    /api/v1/stocks/{id}                  — détail + entrees + sorties
//	  PUT    /api/v1/stocks/{id}                  — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  DELETE /api/v1/stocks/{id}                  — delete (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  GET    /api/v1/stocks/entrees               — list entrees
//	  POST   /api/v1/stocks/entrees               — create entree
//	  GET    /api/v1/stocks/sorties               — list sorties
//	  POST   /api/v1/stocks/sorties               — create sortie
//	Carburant :
//	  GET    /api/v1/carburant/stock              — list (avec quantiteDisponible)
//	  POST   /api/v1/carburant/stock              — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  GET    /api/v1/carburant/stock/{id}         — détail
//	  PUT    /api/v1/carburant/stock/{id}         — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  DELETE /api/v1/carburant/stock/{id}         — delete (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  GET    /api/v1/carburant/entrees            — list entrees carburant
//	  POST   /api/v1/carburant/entrees            — create entree (prixTotal computed)
//	  GET    /api/v1/carburant/sorties            — list sorties carburant
//	  POST   /api/v1/carburant/sorties            — create sortie
//	  GET    /api/v1/carburant/achats             — list bons d'achat
//	  POST   /api/v1/carburant/achats             — create bon d'achat (prixTotal computed)
//	  GET    /api/v1/carburant/releves            — list relevés compteur
//	  POST   /api/v1/carburant/releves            — create relevé
//	  GET    /api/v1/carburant/stats              — stats (total par type, totaux mensuels, alertes)
//
// Phase 4 — commercial endpoints :
//
//	Clients :
//	  GET    /api/v1/clients                       — list paginée (auth requis)
//	  POST   /api/v1/clients                       — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  GET    /api/v1/clients/stats                 — stats (total, byType, byStatut, recentCount)
//	  GET    /api/v1/clients/{id}                  — détail avec compteurs (chantiers/devis/factures)
//	  PUT    /api/v1/clients/{id}                  — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  DELETE /api/v1/clients/{id}                  — delete (409 si devis/contrats/factures liés)
//	Devis :
//	  GET    /api/v1/devis                         — list paginée avec Client préloadé
//	  POST   /api/v1/devis                         — create (numero auto, lignes, compute totals)
//	  GET    /api/v1/devis/{id}                    — détail avec Client + Lignes
//	  PUT    /api/v1/devis/{id}                    — update (recompute totals si remise/tauxTVA)
//	  DELETE /api/v1/devis/{id}                    — delete + cascade lignes
//	  POST   /api/v1/devis/{id}/statut             — change statut
//	  POST   /api/v1/devis/{id}/lignes             — add ligne + recompute totals
//	  PUT    /api/v1/devis/{id}/lignes/{ligneId}   — update ligne + recompute totals
//	  DELETE /api/v1/devis/{id}/lignes/{ligneId}   — delete ligne + recompute totals
//	Contrats :
//	  GET    /api/v1/contrats                      — list paginée avec Client préloadé
//	  POST   /api/v1/contrats                      — create (numero auto, compute montantTTC)
//	  GET    /api/v1/contrats/{id}                 — détail avec Client + Factures
//	  PUT    /api/v1/contrats/{id}                 — update (recompute montantTTC si besoin)
//	  DELETE /api/v1/contrats/{id}                 — delete (409 si factures liés)
//	  POST   /api/v1/contrats/{id}/statut          — change statut
//	Facturation :
//	  GET    /api/v1/facturation                   — list paginée avec Client + Contrat préloadés
//	  POST   /api/v1/facturation                   — create (numero auto, compute montantTVA+totalTTC)
//	  GET    /api/v1/facturation/stats             — stats (total, byStatut, totalTTC, totalPaye, totalImpaye, enRetardCount)
//	  GET    /api/v1/facturation/{id}              — détail avec Client + Contrat + Paiements
//	  PUT    /api/v1/facturation/{id}              — update (dateEcheance, notes, modePaiement)
//	  DELETE /api/v1/facturation/{id}              — delete (409 si paiements liés)
//	  POST   /api/v1/facturation/{id}/statut       — change statut
//	  GET    /api/v1/facturation/{id}/paiements    — list paiements
//	  POST   /api/v1/facturation/{id}/paiements    — add paiement (update montantPaye + statut)
//
// Phase 5 — peripheral endpoints :
//
//	Budget (PHASE-B-BUDGET — agrégation des coûts d'un chantier) :
//	  GET    /api/v1/budget/{chantierId}                       — agrégat coûts
//	                                                              (Personnel + Matériaux +
//	                                                               Sous-traitants + Locations)
//	                                                              RBAC : RequireAccess(FINANCE, LECTURE)
//
//	Sous-traitants :
//	  GET    /api/v1/sous-traitants                          — list paginée (auth requis)
//	  POST   /api/v1/sous-traitants                          — create (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  GET    /api/v1/sous-traitants/{id}                     — détail avec contrats
//	  PUT    /api/v1/sous-traitants/{id}                     — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  DELETE /api/v1/sous-traitants/{id}                     — delete (409 si contrats liés)
//	  GET    /api/v1/sous-traitants/{id}/contrats            — list contrats
//	  POST   /api/v1/sous-traitants/{id}/contrats            — create contrat (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  PUT    /api/v1/sous-traitants/{id}/contrats/{contratId} — update contrat
//	  DELETE /api/v1/sous-traitants/{id}/contrats/{contratId} — delete contrat
//	Documents :
//	  GET    /api/v1/documents                               — list paginée (auth requis)
//	  POST   /api/v1/documents                               — create (auth requis)
//	  GET    /api/v1/documents/{id}                          — détail
//	  PUT    /api/v1/documents/{id}                          — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	  DELETE /api/v1/documents/{id}                          — delete (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	Photos :
//	  GET    /api/v1/photos                                  — list paginée
//	  POST   /api/v1/photos                                  — create (auth requis)
//	  DELETE /api/v1/photos/{id}                             — delete (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	Rapports :
//	  GET    /api/v1/rapports                                — list paginée
//	  POST   /api/v1/rapports                                — create (auth requis)
//	  GET    /api/v1/rapports/{id}                           — détail avec photos
//	  PUT    /api/v1/rapports/{id}                           — update (CHEF_PROJET, GERANT, SUPER_ADMIN)
//	Support :
//	  GET    /api/v1/support                                 — list paginée (auth requis)
//	  POST   /api/v1/support                                 — create ticket (auth requis)
//	  GET    /api/v1/support/stats                           — stats (total, byStatut, byPriorite, byCategorie, openCount, resolvedCount)
//	  GET    /api/v1/support/{id}                            — détail avec messages
//	  PUT    /api/v1/support/{id}                            — update ticket (GERANT, SUPER_ADMIN)
//	  POST   /api/v1/support/{id}/statut                     — change statut (GERANT, SUPER_ADMIN)
//	  GET    /api/v1/support/{id}/messages                   — list messages
//	  POST   /api/v1/support/{id}/messages                   — add message (auth requis)
//	Sync :
//	  POST   /api/v1/sync                                    — sync offline mutations (auth requis)
package http

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"opuc/internal/delivery/http/handler"
	"opuc/internal/delivery/http/middleware"
	"opuc/internal/domain/model"
	appjwt "opuc/internal/infrastructure/jwt"
)

// Deps — dépendances injectées pour monter le router.
type Deps struct {
	Auth         *handler.AuthHandler
	User         *handler.UserHandler
	TwoFA        *handler.TwoFAHandler
	Health       *handler.HealthHandler
	Chantier     *handler.ChantierHandler
	Dashboard    *handler.DashboardHandler
	Notification *handler.NotificationHandler
	Permission   *handler.PermissionHandler
	AuditLog     *handler.AuditLogHandler
	Pointage     *handler.PointageHandler
	Paie         *handler.PaieHandler
	Stock        *handler.StockHandler
	Carburant    *handler.CarburantHandler
	Client       *handler.ClientHandler
	Devis        *handler.DevisHandler
	Contrat      *handler.ContratHandler
	Facturation  *handler.FacturationHandler
	// Phase 5 — peripheral handlers
	SousTraitant *handler.SousTraitantHandler
	Document     *handler.DocumentHandler
	Support      *handler.SupportHandler
	Sync         *handler.SyncHandler
	// R2 storage handler
	Storage *handler.StorageHandler
	// Phase 6 — SaaS handler (admin + support-access)
	SaaS *handler.SaaSHandler
	// Phase 7 — Delegation handler (delegations + co-gerants)
	// DelegationRepo may be nil — it's only used by middleware.RequireAccess
	// for future use on business routes (pointage/paie/stocks/etc).
	Delegation     *handler.DelegationHandler
	DelegationRepo middleware.DelegationChecker
	// Phase 3 — Phase/Tache handler (CRUD Phase/Tache + mes-taches)
	Phase *handler.PhaseHandler
	// PHASE-B-PERSONNEL — handler personnel (journaliers + affectations)
	Personnel *handler.PersonnelHandler
	// PHASE-B-ENGINS — handler engins (parc engins + locations)
	Engin *handler.EnginHandler
	// PHASE-B-BUDGET — handler budget (agrégation des coûts par chantier)
	Budget *handler.BudgetHandler
	// Common
	Signer *appjwt.Signer
	Log    *slog.Logger
}

// NewRouter monte le routeur chi complet.
func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()

	// ── Middlewares globaux ─────────────────────────────────────
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger(d.Log))
	r.Use(middleware.Recover(d.Log))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "https://opuc.vercel.app", "https://opuc.freelancetechnologies-ci.workers.dev"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: true, // nécessaire pour les cookies cross-origin
		MaxAge:           300,
	}))

	// ── Routes ──────────────────────────────────────────────────
	r.Route("/api/v1", func(r chi.Router) {
		// Health (public)
		r.Get("/health", d.Health.Health)

		// Auth (public + auth-required)
		r.Route("/auth", func(r chi.Router) {
			// Public
			r.Post("/login", d.Auth.Login)
			r.Post("/logout", d.Auth.Logout)

			// Auth-required
			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(d.Signer))
				r.Get("/me", d.Auth.Me)

				// 2FA — auth requis.
				// NOTE : /2fa/verify est accessible même avec un JWT "pending 2FA"
				// (login flow). Les autres routes 2FA nécessitent 2FA déjà vérifiée.
				// Le middleware.Auth gère ce bypass via is2FAPath().
				if d.TwoFA != nil {
					r.Post("/2fa/setup", d.TwoFA.Setup)
					r.Post("/2fa/verify", d.TwoFA.Verify)
					r.Post("/2fa/disable", d.TwoFA.Disable)
				}
			})
		})

		// Users — auth-required (RBAC au niveau des routes individuelles)
		if d.User != nil {
			r.Group(func(r chi.Router) {
				r.Use(middleware.Auth(d.Signer))
				r.Route("/users", func(r chi.Router) {
					// List + Create : SUPER_ADMIN ou GERANT
					r.With(middleware.RequireRole("SUPER_ADMIN", "GERANT")).Get("/", d.User.List)
					r.With(middleware.RequireRole("SUPER_ADMIN", "GERANT")).Post("/", d.User.Create)

					// Sous-route /{id}
					r.Route("/{id}", func(r chi.Router) {
						r.Get("/", d.User.Get)                                                   // tous authentifiés
						r.Put("/", d.User.Update)                                                // tous authentifiés (auto-update possible)
						r.With(middleware.RequireRole("SUPER_ADMIN")).Delete("/", d.User.Delete) // soft delete
						r.With(middleware.RequireRole("SUPER_ADMIN", "GERANT")).Post("/toggle-active", d.User.ToggleActive)
						r.With(middleware.RequireRole("SUPER_ADMIN", "GERANT")).Post("/reset-password", d.User.ResetPassword)
					})
				})
			})
		}

		// Phase 2 — lecture métier (chantiers, dashboard, notifications, permissions, audit-logs)
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(d.Signer))

			if d.Chantier != nil {
				r.Get("/chantiers", d.Chantier.List)
				// Create : GESTION sur CHANTIER (GERANT+ par défaut, CHEF_PROJET via baseline, EMPLOYE via délégation GESTION)
				r.With(middleware.RequireAccess(model.DomainChantier, model.PermGestion, d.DelegationRepo)).Post("/chantiers", d.Chantier.Create)
				r.Get("/chantiers/{id}", d.Chantier.Get)
				// Update : ECRITURE sur CHANTIER
				r.With(middleware.RequireAccess(model.DomainChantier, model.PermEcriture, d.DelegationRepo)).Put("/chantiers/{id}", d.Chantier.Update)
				// Delete : GESTION sur CHANTIER (irréversible)
				r.With(middleware.RequireAccess(model.DomainChantier, model.PermGestion, d.DelegationRepo)).Delete("/chantiers/{id}", d.Chantier.Delete)
			}

			// Phase 3 — CRUD Phase/Tache + mes-taches (délégation de suivi)
			//
			// Routes imbriquées sous /chantiers/{chantierId}/phases/... :
			//   POST   /chantiers/{chantierId}/phases
			//   PUT    /chantiers/{chantierId}/phases/{phaseId}
			//   DELETE /chantiers/{chantierId}/phases/{phaseId}            (cascade taches)
			//   POST   /chantiers/{chantierId}/phases/{phaseId}/taches
			//   PUT    /chantiers/{chantierId}/phases/{phaseId}/taches/{tacheId}
			//   DELETE /chantiers/{chantierId}/phases/{phaseId}/taches/{tacheId}
			//
			// Route personnelle (auth-seul, pas de RequireAccess — un EMPLOYE peut
			// consulter ses propres tâches assignées sans délégation de domaine) :
			//   GET    /taches/mes-taches
			//
			// RBAC Phase/Tache CRUD : ECRITURE sur CHANTIER → CHEF_PROJET a accès
			// baseline, EMPLOYE nécessite une délégation CHANTIER/ECRITURE active.
			if d.Phase != nil {
				// Phase CRUD
				r.With(middleware.RequireAccess(model.DomainChantier, model.PermEcriture, d.DelegationRepo)).Post("/chantiers/{chantierId}/phases", d.Phase.CreatePhase)
				r.With(middleware.RequireAccess(model.DomainChantier, model.PermEcriture, d.DelegationRepo)).Put("/chantiers/{chantierId}/phases/{phaseId}", d.Phase.UpdatePhase)
				r.With(middleware.RequireAccess(model.DomainChantier, model.PermEcriture, d.DelegationRepo)).Delete("/chantiers/{chantierId}/phases/{phaseId}", d.Phase.DeletePhase)

				// Tache CRUD
				r.With(middleware.RequireAccess(model.DomainChantier, model.PermEcriture, d.DelegationRepo)).Post("/chantiers/{chantierId}/phases/{phaseId}/taches", d.Phase.CreateTache)
				r.With(middleware.RequireAccess(model.DomainChantier, model.PermEcriture, d.DelegationRepo)).Put("/chantiers/{chantierId}/phases/{phaseId}/taches/{tacheId}", d.Phase.UpdateTache)
				r.With(middleware.RequireAccess(model.DomainChantier, model.PermEcriture, d.DelegationRepo)).Delete("/chantiers/{chantierId}/phases/{phaseId}/taches/{tacheId}", d.Phase.DeleteTache)

				// Mes tâches — route personnelle (auth-seul, pas de RequireAccess)
				// Déclarée avant tout éventuel /taches/{id} (aucun pour l'instant — évite
				// le matching par placeholder chi).
				r.Get("/taches/mes-taches", d.Phase.ListMyTaches)

				// Update avancement par le responsable — route personnelle (auth-seul).
				// Permet à un EMPLOYE de faire progresser SA tâche sans délégation CHANTIER.
				// L'ownership (responsableId = currentUser) est vérifié côté usecase.
				r.Patch("/taches/{tacheId}/avancement", d.Phase.UpdateMyTacheAvancement)
			}

			// PHASE-B-PERSONNEL — Gestion du personnel (journaliers + affectations)
			//
			// Routes :
			//   GET    /api/v1/personnel                          — list paginée + KPI
			//   POST   /api/v1/personnel                          — create journalier
			//   PUT    /api/v1/personnel/{id}                     — update journalier (partial)
			//   DELETE /api/v1/personnel/{id}                     — delete journalier
			//   GET    /api/v1/personnel/{id}/affectations        — list affectations
			//   POST   /api/v1/personnel/{id}/affectations        — create affectation
			//   DELETE /api/v1/personnel/{id}/affectations/{affectationId} — delete affectation (by id)
			//   DELETE /api/v1/personnel/{id}/affectations?chantierId=X    — delete affectation (by chantier pair)
			//
			// RBAC : RequireAccess(RH, LECTURE) pour les GET, ECRITURE pour POST/PUT/DELETE.
			// Le domaine RH couvre personnel + pointage + paie (cf. domain/model/delegation.go).
			if d.Personnel != nil {
				// CRUD Journalier
				r.With(middleware.RequireAccess(model.DomainRH, model.PermLecture, d.DelegationRepo)).Get("/personnel", d.Personnel.List)
				r.With(middleware.RequireAccess(model.DomainRH, model.PermEcriture, d.DelegationRepo)).Post("/personnel", d.Personnel.Create)
				r.With(middleware.RequireAccess(model.DomainRH, model.PermEcriture, d.DelegationRepo)).Put("/personnel/{id}", d.Personnel.Update)
				r.With(middleware.RequireAccess(model.DomainRH, model.PermEcriture, d.DelegationRepo)).Delete("/personnel/{id}", d.Personnel.Delete)

				// Affectations (nested under /personnel/{id})
				r.With(middleware.RequireAccess(model.DomainRH, model.PermLecture, d.DelegationRepo)).Get("/personnel/{id}/affectations", d.Personnel.ListAffectations)
				r.With(middleware.RequireAccess(model.DomainRH, model.PermEcriture, d.DelegationRepo)).Post("/personnel/{id}/affectations", d.Personnel.CreateAffectation)
				// Delete by affectationId (path)
				r.With(middleware.RequireAccess(model.DomainRH, model.PermEcriture, d.DelegationRepo)).Delete("/personnel/{id}/affectations/{affectationId}", d.Personnel.DeleteAffectation)
				// Delete by chantierId (query) — forme utilisée par le frontend
				r.With(middleware.RequireAccess(model.DomainRH, model.PermEcriture, d.DelegationRepo)).Delete("/personnel/{id}/affectations", d.Personnel.DeleteAffectation)
			}

			// PHASE-B-ENGINS — Parc engins + Locations
			//
			// Routes :
			//   GET    /api/v1/engins           — list paginée + KPI + _count.locations
			//   POST   /api/v1/engins           — create équipement
			//   PUT    /api/v1/engins/{id}      — update équipement (partial)
			//   DELETE /api/v1/engins/{id}      — delete équipement (409 si locations liées)
			//   GET    /api/v1/locations        — list locations + KPI
			//   POST   /api/v1/locations        — create location
			//   PUT    /api/v1/locations/{id}   — update location (partial ; clôture via {statut:"TERMINE"})
			//   DELETE /api/v1/locations/{id}   — delete location
			//
			// RBAC : RequireAccess(LOGISTIQUE, LECTURE) pour les GET, ECRITURE pour POST/PUT/DELETE.
			// Le domaine LOGISTIQUE couvre stocks + carburant + engins + sous-traitants
			// (cf. domain/model/delegation.go).
			if d.Engin != nil {
				// Engins (parc) — routes statiques déclarées en premier pour éviter le
				// matching {id} par chi (bien que chi fasse du radix-based routing propre).
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/engins", d.Engin.ListEngins)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Post("/engins", d.Engin.CreateEngin)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Put("/engins/{id}", d.Engin.UpdateEngin)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Delete("/engins/{id}", d.Engin.DeleteEngin)

				// Locations — déclarées après /engins pour éviter tout conflit de radix.
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/locations", d.Engin.ListLocations)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Post("/locations", d.Engin.CreateLocation)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Put("/locations/{id}", d.Engin.UpdateLocation)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Delete("/locations/{id}", d.Engin.DeleteLocation)
			}

			// PHASE-B-BUDGET — Agrégation des coûts d'un chantier
			//
			// Route :
			//   GET    /api/v1/budget/{chantierId}   — agrégat des coûts
			//                                                (Personnel + Matériaux
			//                                                 + Sous-traitants + Locations)
			//
			// RBAC : RequireAccess(FINANCE, LECTURE) — le budget est un
			// domaine financier (cf. domain/model/delegation.go →
			// DomainModules[DomainFinance] inclut "budget").
			//
			// Retourne 404 si le chantier n'existe pas ou n'est pas visible
			// (RLS), et des zéros si le chantier existe mais n'a aucune
			// donnée (pas de pointages, pas de stock, etc.).
			if d.Budget != nil {
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermLecture, d.DelegationRepo)).Get("/budget/{chantierId}", d.Budget.Get)
			}

			if d.Dashboard != nil {
				r.Get("/dashboard", d.Dashboard.Get)
			}

			if d.Notification != nil {
				r.Get("/notifications", d.Notification.List)
			}

			if d.Permission != nil {
				r.With(middleware.RequireRole("SUPER_ADMIN", "GERANT")).Get("/permissions", d.Permission.List)
			}

			if d.AuditLog != nil {
				r.With(middleware.RequireRole("SUPER_ADMIN", "GERANT")).Get("/audit-logs", d.AuditLog.List)
			}

			// Phase 3 — Pointage (write métier)
			if d.Pointage != nil {
				// Static routes declared first to avoid chi matching them as {id}
				r.With(middleware.RequireAccess(model.DomainRH, model.PermLecture, d.DelegationRepo)).Get("/pointage/summary", d.Pointage.Summary)
				r.With(middleware.RequireAccess(model.DomainRH, model.PermLecture, d.DelegationRepo)).Get("/pointage", d.Pointage.List)
				r.With(middleware.RequireAccess(model.DomainRH, model.PermEcriture, d.DelegationRepo)).Post("/pointage", d.Pointage.Create)
				r.With(middleware.RequireAccess(model.DomainRH, model.PermLecture, d.DelegationRepo)).Get("/pointage/{id}", d.Pointage.Get)
				r.With(middleware.RequireAccess(model.DomainRH, model.PermEcriture, d.DelegationRepo)).Put("/pointage/{id}", d.Pointage.Update)
				r.With(middleware.RequireAccess(model.DomainRH, model.PermEcriture, d.DelegationRepo)).Delete("/pointage/{id}", d.Pointage.Delete)
				// Validate : GESTION sur RH (action de management — CHEF_PROJET est limité à ECRITURE sur RH par baseline, donc ne peut pas valider sans délégation GESTION)
				r.With(middleware.RequireAccess(model.DomainRH, model.PermGestion, d.DelegationRepo)).Post("/pointage/{id}/validate", d.Pointage.Validate)
			}

			// Phase 3 — Paie (write métier)
			if d.Paie != nil {
				r.Route("/paie", func(r chi.Router) {
					r.With(middleware.RequireAccess(model.DomainRH, model.PermLecture, d.DelegationRepo)).Get("/paiements-hebdo", d.Paie.ListPaiementHebdo)
					// Generate/Update paie : GESTION sur RH (management — réservé GERANT+ par défaut, délégable)
					r.With(middleware.RequireAccess(model.DomainRH, model.PermGestion, d.DelegationRepo)).Post("/paiements-hebdo/generate", d.Paie.GeneratePaiementHebdo)
					r.With(middleware.RequireAccess(model.DomainRH, model.PermGestion, d.DelegationRepo)).Put("/paiements-hebdo/{id}", d.Paie.UpdatePaiementHebdo)

					r.With(middleware.RequireAccess(model.DomainRH, model.PermLecture, d.DelegationRepo)).Get("/salaires", d.Paie.ListSalaireMensuel)
					r.With(middleware.RequireAccess(model.DomainRH, model.PermGestion, d.DelegationRepo)).Post("/salaires/generate", d.Paie.GenerateSalaireMensuel)
					r.With(middleware.RequireAccess(model.DomainRH, model.PermGestion, d.DelegationRepo)).Put("/salaires/{id}", d.Paie.UpdateSalaireMensuel)
				})
			}

			// Phase 3 — Stock (write métier)
			if d.Stock != nil {
				// Static routes declared first to avoid chi matching them as {id}
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/stocks/entrees", d.Stock.ListEntrees)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Post("/stocks/entrees", d.Stock.CreateEntree)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/stocks/sorties", d.Stock.ListSorties)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Post("/stocks/sorties", d.Stock.CreateSortie)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/stocks", d.Stock.List)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Post("/stocks", d.Stock.Create)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/stocks/{id}", d.Stock.Get)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Put("/stocks/{id}", d.Stock.Update)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Delete("/stocks/{id}", d.Stock.Delete)
			}

			// Phase 3 — Carburant (write métier)
			if d.Carburant != nil {
				r.Route("/carburant", func(r chi.Router) {
					// Static routes first
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/entrees", d.Carburant.ListEntrees)
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Post("/entrees", d.Carburant.CreateEntree)
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/sorties", d.Carburant.ListSorties)
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Post("/sorties", d.Carburant.CreateSortie)
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/achats", d.Carburant.ListAchats)
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Post("/achats", d.Carburant.CreateAchat)
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/releves", d.Carburant.ListReleves)
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Post("/releves", d.Carburant.CreateReleve)
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/stats", d.Carburant.Stats)

					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/stock", d.Carburant.ListStock)
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Post("/stock", d.Carburant.CreateStock)
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/stock/{id}", d.Carburant.GetStock)
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Put("/stock/{id}", d.Carburant.UpdateStock)
					r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Delete("/stock/{id}", d.Carburant.DeleteStock)
				})
			}

			// Phase 4 — Clients (commercial)
			if d.Client != nil {
				// Static route first (stats avant /{id})
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermLecture, d.DelegationRepo)).Get("/clients/stats", d.Client.Stats)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermLecture, d.DelegationRepo)).Get("/clients", d.Client.List)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermEcriture, d.DelegationRepo)).Post("/clients", d.Client.Create)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermLecture, d.DelegationRepo)).Get("/clients/{id}", d.Client.Get)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermEcriture, d.DelegationRepo)).Put("/clients/{id}", d.Client.Update)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermEcriture, d.DelegationRepo)).Delete("/clients/{id}", d.Client.Delete)
			}

			// Phase 4 — Devis (commercial)
			if d.Devis != nil {
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermLecture, d.DelegationRepo)).Get("/devis", d.Devis.List)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermEcriture, d.DelegationRepo)).Post("/devis", d.Devis.Create)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermLecture, d.DelegationRepo)).Get("/devis/{id}", d.Devis.Get)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermEcriture, d.DelegationRepo)).Put("/devis/{id}", d.Devis.Update)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermEcriture, d.DelegationRepo)).Delete("/devis/{id}", d.Devis.Delete)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermEcriture, d.DelegationRepo)).Post("/devis/{id}/statut", d.Devis.ChangeStatut)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermEcriture, d.DelegationRepo)).Post("/devis/{id}/lignes", d.Devis.AddLigne)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermEcriture, d.DelegationRepo)).Put("/devis/{id}/lignes/{ligneId}", d.Devis.UpdateLigne)
				r.With(middleware.RequireAccess(model.DomainCommercial, model.PermEcriture, d.DelegationRepo)).Delete("/devis/{id}/lignes/{ligneId}", d.Devis.DeleteLigne)
			}

			// Phase 4 — Contrats (finance — les contrats ont une dimension financière)
			if d.Contrat != nil {
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermLecture, d.DelegationRepo)).Get("/contrats", d.Contrat.List)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermEcriture, d.DelegationRepo)).Post("/contrats", d.Contrat.Create)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermLecture, d.DelegationRepo)).Get("/contrats/{id}", d.Contrat.Get)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermEcriture, d.DelegationRepo)).Put("/contrats/{id}", d.Contrat.Update)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermEcriture, d.DelegationRepo)).Delete("/contrats/{id}", d.Contrat.Delete)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermEcriture, d.DelegationRepo)).Post("/contrats/{id}/statut", d.Contrat.ChangeStatut)
			}

			// Phase 4 — Facturation (finance)
			if d.Facturation != nil {
				// Static route first (stats avant /{id})
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermLecture, d.DelegationRepo)).Get("/facturation/stats", d.Facturation.Stats)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermLecture, d.DelegationRepo)).Get("/facturation", d.Facturation.List)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermEcriture, d.DelegationRepo)).Post("/facturation", d.Facturation.Create)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermLecture, d.DelegationRepo)).Get("/facturation/{id}", d.Facturation.Get)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermEcriture, d.DelegationRepo)).Put("/facturation/{id}", d.Facturation.Update)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermEcriture, d.DelegationRepo)).Delete("/facturation/{id}", d.Facturation.Delete)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermEcriture, d.DelegationRepo)).Post("/facturation/{id}/statut", d.Facturation.ChangeStatut)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermLecture, d.DelegationRepo)).Get("/facturation/{id}/paiements", d.Facturation.ListPaiements)
				r.With(middleware.RequireAccess(model.DomainFinance, model.PermEcriture, d.DelegationRepo)).Post("/facturation/{id}/paiements", d.Facturation.CreatePaiement)
			}

			// Phase 5 — Sous-traitants (peripheral — logistique selon EndpointDomain)
			if d.SousTraitant != nil {
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/sous-traitants", d.SousTraitant.List)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Post("/sous-traitants", d.SousTraitant.Create)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/sous-traitants/{id}", d.SousTraitant.Get)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Put("/sous-traitants/{id}", d.SousTraitant.Update)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Delete("/sous-traitants/{id}", d.SousTraitant.Delete)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermLecture, d.DelegationRepo)).Get("/sous-traitants/{id}/contrats", d.SousTraitant.ListContrats)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Post("/sous-traitants/{id}/contrats", d.SousTraitant.CreateContrat)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Put("/sous-traitants/{id}/contrats/{contratId}", d.SousTraitant.UpdateContrat)
				r.With(middleware.RequireAccess(model.DomainLogistique, model.PermEcriture, d.DelegationRepo)).Delete("/sous-traitants/{id}/contrats/{contratId}", d.SousTraitant.DeleteContrat)
			}

			// Phase 5 — Documents (peripheral — domaine DOCUMENTS)
			if d.Document != nil {
				r.Get("/documents", d.Document.List)
				r.With(middleware.RequireAccess(model.DomainDocuments, model.PermEcriture, d.DelegationRepo)).Post("/documents", d.Document.Create)
				r.Get("/documents/{id}", d.Document.Get)
				r.With(middleware.RequireAccess(model.DomainDocuments, model.PermEcriture, d.DelegationRepo)).Put("/documents/{id}", d.Document.Update)
				r.With(middleware.RequireAccess(model.DomainDocuments, model.PermEcriture, d.DelegationRepo)).Delete("/documents/{id}", d.Document.Delete)

				// Photos — auth-seul OK (suivi terrain : tout user peut prendre une photo)
				r.Get("/photos", d.Document.ListPhotos)
				r.Post("/photos", d.Document.CreatePhoto)
				r.With(middleware.RequireAccess(model.DomainDocuments, model.PermEcriture, d.DelegationRepo)).Delete("/photos/{id}", d.Document.DeletePhoto)

				// Rapports journaliers
				r.Get("/rapports", d.Document.ListRapports)
				r.With(middleware.RequireAccess(model.DomainDocuments, model.PermEcriture, d.DelegationRepo)).Post("/rapports", d.Document.CreateRapport)
				r.Get("/rapports/{id}", d.Document.GetRapport)
				r.With(middleware.RequireAccess(model.DomainDocuments, model.PermEcriture, d.DelegationRepo)).Put("/rapports/{id}", d.Document.UpdateRapport)
			}

			// Phase 5 — Support (peripheral)
			if d.Support != nil {
				// Static route first (stats avant /{id})
				r.Get("/support/stats", d.Support.Stats)
				r.Get("/support", d.Support.List)
				r.Post("/support", d.Support.Create)
				r.Get("/support/{id}", d.Support.Get)
				r.With(middleware.RequireRole("SUPER_ADMIN", "GERANT")).Put("/support/{id}", d.Support.Update)
				r.With(middleware.RequireRole("SUPER_ADMIN", "GERANT")).Post("/support/{id}/statut", d.Support.ChangeStatut)
				r.Get("/support/{id}/messages", d.Support.ListMessages)
				r.Post("/support/{id}/messages", d.Support.CreateMessage)
			}

			// Phase 5 — Sync (peripheral)
			if d.Sync != nil {
				r.Post("/sync", d.Sync.Sync)
			}

			// R2 Storage — upload/download files
			if d.Storage != nil {
				// Phase 1 : EMPLOYE (anciennement SOUS_TRAITANT) peut upload/delete files
				r.With(middleware.RequireRole("SUPER_ADMIN", "GERANT", "CHEF_PROJET", "EMPLOYE", "SOUS_TRAITANT")).Post("/upload", d.Storage.Upload)
				r.With(middleware.RequireRole("SUPER_ADMIN", "GERANT", "CHEF_PROJET", "EMPLOYE", "SOUS_TRAITANT")).Delete("/files/*", d.Storage.DeleteFile)
				// Download accessible à tous les authentifiés (lecture)
				r.Get("/files/*", d.Storage.Download)
			}

			// ── Phase 6 — SaaS endpoints ───────────────────────
			//
			// Admin (SUPER_ADMIN only) :
			//   GET    /admin/dashboard                       — KPIs plateforme
			//   GET    /admin/entreprises                     — list tenants
			//   POST   /admin/entreprises                     — create tenant
			//   GET    /admin/entreprises/{id}                — tenant detail + stats
			//   PUT    /admin/entreprises/{id}                — update tenant
			//   POST   /admin/entreprises/{id}/suspend
			//   POST   /admin/entreprises/{id}/reactivate
			//   GET    /admin/subscriptions                   — list subscriptions
			//   POST   /admin/subscriptions                   — create subscription
			//   PUT    /admin/subscriptions/{id}              — change plan
			//   POST   /admin/subscriptions/{id}/cancel
			//   GET    /admin/support-access                  — list requests (all)
			//   POST   /admin/support-access/request          — request access
			//   POST   /admin/support-access/{id}/revoke
			//
			// GERANT (support access approval) :
			//   GET    /support-access                        — list own requests
			//   POST   /support-access/{id}/approve           — GERANT approves
			//   POST   /support-access/{id}/refuse            — GERANT refuses
			//   POST   /support-access/{id}/revoke            — GERANT revokes
			if d.SaaS != nil {
				// /admin/* — SUPER_ADMIN only
				r.Group(func(r chi.Router) {
					r.Use(middleware.RequireRole("SUPER_ADMIN"))
					r.Get("/admin/dashboard", d.SaaS.Dashboard)

					// Entreprises CRUD
					r.Get("/admin/entreprises", d.SaaS.ListEntreprises)
					r.Post("/admin/entreprises", d.SaaS.CreateEntreprise)
					r.Get("/admin/entreprises/{id}", d.SaaS.GetEntreprise)
					r.Put("/admin/entreprises/{id}", d.SaaS.UpdateEntreprise)
					r.Post("/admin/entreprises/{id}/suspend", d.SaaS.SuspendEntreprise)
					r.Post("/admin/entreprises/{id}/reactivate", d.SaaS.ReactivateEntreprise)

					// Subscriptions
					r.Get("/admin/subscriptions", d.SaaS.ListSubscriptions)
					r.Post("/admin/subscriptions", d.SaaS.CreateSubscription)
					r.Put("/admin/subscriptions/{id}", d.SaaS.ChangePlan)
					r.Post("/admin/subscriptions/{id}/cancel", d.SaaS.CancelSubscription)

					// Support access (admin view)
					r.Get("/admin/support-access", d.SaaS.ListSupportAccess)
					r.Post("/admin/support-access/request", d.SaaS.RequestSupportAccess)
					r.Post("/admin/support-access/{id}/revoke", d.SaaS.RevokeSupportAccess)
				})

				// /support-access/* — GERANT approval flow
				r.Group(func(r chi.Router) {
					// GET /support-access : auth requis (tous rôles — le usecase
					// force EntrepriseID = auth.EntrepriseID pour les non-SUPER_ADMIN)
					r.Get("/support-access", d.SaaS.ListMySupportAccess)

					// Approve/Refuse/Revoke : GERANT only
					r.With(middleware.RequireRole("GERANT")).Post("/support-access/{id}/approve", d.SaaS.ApproveSupportAccess)
					r.With(middleware.RequireRole("GERANT")).Post("/support-access/{id}/refuse", d.SaaS.RefuseSupportAccess)
					r.With(middleware.RequireRole("GERANT")).Post("/support-access/{id}/revoke", d.SaaS.RevokeMySupportAccess)
				})
			}

			// ── Phase 7 — Delegation endpoints ───────────────
			//
			// /delegations/* — gestion des délégations de domaines fonctionnels
			//   GET    /delegations                  — list (GERANT sees all, user sees own)
			//   POST   /delegations                  — create (GERANT/co-GERANT/SUPER_ADMIN only)
			//   GET    /delegations/my               — my received delegations (any auth user)
			//   GET    /delegations/{id}             — detail
			//   PUT    /delegations/{id}             — update (GERANT/co-GERANT/SUPER_ADMIN only)
			//   POST   /delegations/{id}/revoke      — revoke (GERANT/co-GERANT/SUPER_ADMIN or self)
			//
			// /users/* — co-GERANT management
			//   GET    /users/co-gerants             — list co-gerants (GERANT/co-GERANT/SUPER_ADMIN)
			//   POST   /users/{id}/promote-co-gerant — principal GERANT or SUPER_ADMIN only
			//   POST   /users/{id}/demote-co-gerant  — principal GERANT or SUPER_ADMIN only
			//
			// Toutes les autorisations sont faites côté usecase (rôle + ownership).
			// Pas de middleware.RequireRole sur /delegations/* (co-GERANTS doivent pouvoir
			// créer/modifier des délégations). Promote/Demote sont bloqués pour les
			// co-GERANTS via le usecase (isPrincipalGerant check).
			if d.Delegation != nil {
				// /delegations/*
				r.Route("/delegations", func(r chi.Router) {
					// Static route first (évite que /my soit matché par /{id})
					r.Get("/my", d.Delegation.ListMy)

					// List + Create
					r.Get("/", d.Delegation.List)
					r.Post("/", d.Delegation.Create)

					// /{id} subroute
					r.Route("/{id}", func(r chi.Router) {
						r.Get("/", d.Delegation.Get)
						r.Put("/", d.Delegation.Update)
						r.Post("/revoke", d.Delegation.Revoke)
					})
				})

				// /users/co-gerants — declared BEFORE /users/{id} to take precedence
				// (chi does radix-based routing, but explicit ordering avoids edge cases).
				// Since /users/{id} is registered conditionally by the User handler
				// above, we register /users/co-gerants here in a separate Group.
				r.Get("/users/co-gerants", d.Delegation.ListCoGerants)
				r.Post("/users/{id}/promote-co-gerant", d.Delegation.PromoteCoGerant)
				r.Post("/users/{id}/demote-co-gerant", d.Delegation.DemoteCoGerant)
			}
		})
	})

	// 404 JSON
	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		handler.WriteError(w, http.StatusNotFound, "route not found")
	})

	return r
}
