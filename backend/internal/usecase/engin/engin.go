// Package engin — usecase pour le parc engins + locations (Phase B-ENGINS).
//
// Opérations :
//   - Parc engins (Equipement) :
//       List   : liste paginée + filtres (search, typeLocation, chantierId) + KPI
//       Get    : détail d'un équipement
//       Create : création d'un équipement (RLS WITH CHECK → force EntrepriseID)
//       Update : update partielle d'un équipement
//       Delete : hard delete (409 si locations liées)
//   - Locations (LocationEngin) :
//       List   : liste filtrée (chantierId, statut, search) + KPI
//       Create : création d'une location (vérifie l'existence de l'equipement)
//       Update : update partielle d'une location (utilisé aussi pour le
//                changement de statut / clôture via {statut:"TERMINE"})
//       Delete : hard delete
//
// Tables :
//   - Equipement    : RLS-protected (policy tenant_isolation sur entrepriseId)
//   - LocationEngin : pas de RLS direct → filtrage tenant via JOIN sur "Equipement"
//
// Le repo implémente l'interface Repo (inversion de dépendance).
package engin

import (
        "context"
        "fmt"
        "log/slog"
        "strings"
        "time"

        "opuc/internal/domain"
        "opuc/internal/domain/model"
        "opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase. Implémentée par gorm.EnginRepository.
//
// Toutes les méthodes acceptent un *database.AuthUser pour activer le RLS :
//   - SUPER_ADMIN → voit toutes les entreprises (RLS bypass)
//   - autres rôles → ne voit que son entrepriseId
type Repo interface {
        // Equipement
        ListEquipements(ctx context.Context, auth *database.AuthUser, filter ListEquipementsInput) ([]model.Equipement, int64, error)
        GetEquipementByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Equipement, error)
        CreateEquipement(ctx context.Context, auth *database.AuthUser, e model.Equipement) (*model.Equipement, error)
        UpdateEquipement(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Equipement, error)
        DeleteEquipement(ctx context.Context, auth *database.AuthUser, id string) error
        CountLocationsByEquipement(ctx context.Context, auth *database.AuthUser, equipementID string) (int64, error)
        CountLocationsByEquipements(ctx context.Context, auth *database.AuthUser, equipementIDs []string) (map[string]int64, error)
        CountEquipementsByTypeLocation(ctx context.Context, auth *database.AuthUser) (total, propres, loues int64, err error)

        // LocationEngin
        ListLocations(ctx context.Context, auth *database.AuthUser, filter ListLocationsInput) ([]model.LocationEngin, int64, error)
        GetLocationByID(ctx context.Context, auth *database.AuthUser, id string) (*model.LocationEngin, error)
        CreateLocation(ctx context.Context, auth *database.AuthUser, l model.LocationEngin) (*model.LocationEngin, error)
        UpdateLocation(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.LocationEngin, error)
        DeleteLocation(ctx context.Context, auth *database.AuthUser, id string) error
        LocationKPIs(ctx context.Context, auth *database.AuthUser) (enCours int64, coutTotalEnCours, coutJournalierMoyen float64, locationsCeMois int64, err error)
}

// ListEquipementsInput — critères de filtrage pour ListEquipements.
type ListEquipementsInput struct {
        Search       string // ILIKE sur designation, marque, modele, immatriculation
        TypeLocation string // PROPRE | LOCATION (filtre typeLocation)
        ChantierID   string // filtre équipements ayant une location sur ce chantier
        Page         int    // 1-based, défaut 1
        PageSize     int    // défaut 50
}

// ListLocationsInput — critères de filtrage pour ListLocations.
type ListLocationsInput struct {
        Search     string // ILIKE sur fournisseurNom, numeroContrat
        Statut     string // EN_COURS | TERMINE | ANNULE
        ChantierID string // filtre par chantierId
        Page       int
        PageSize   int
}

// CreateEquipementInput — payload pour CreateEquipement.
type CreateEquipementInput struct {
        Designation     string
        TypeEquipement  *string
        Marque          *string
        Modele          *string
        Immatriculation *string
        Etat            string  // défaut BON si vide
        TypeLocation    *string // PROPRE | LOCATION
}

// UpdateEquipementInput — payload pour UpdateEquipement. Tous optionnels.
type UpdateEquipementInput struct {
        Designation     *string
        TypeEquipement  *string
        Marque          *string
        Modele          *string
        Immatriculation *string
        Etat            *string
        TypeLocation    *string
}

// CreateLocationInput — payload pour CreateLocation.
type CreateLocationInput struct {
        EquipementID   string
        FournisseurID  *string
        FournisseurNom *string
        FournisseurTel *string
        NumeroContrat  *string
        ChantierID     *string
        CoutJournalier float64
        CoutTransport  float64
        CoutOperateur  float64
        Caution        float64
        DateDebut      time.Time
        DateFin        *time.Time
        Statut         string // défaut EN_COURS si vide
        Conditions     *string
}

// UpdateLocationInput — payload pour UpdateLocation. Tous optionnels.
// Utilisé aussi pour le changement de statut (clôture via {statut:"TERMINE"}).
type UpdateLocationInput struct {
        FournisseurID  *string
        FournisseurNom *string
        FournisseurTel *string
        NumeroContrat  *string
        ChantierID     *string
        CoutJournalier *float64
        CoutTransport  *float64
        CoutOperateur  *float64
        Caution        *float64
        DateDebut      *time.Time
        DateFin        *time.Time
        Statut         *string
        Conditions     *string
}

// EnginKPI — KPIs agrégés sur le parc engins.
type EnginKPI struct {
        TotalEngins   int64 `json:"totalEngins"`
        EnginsPropres int64 `json:"enginsPropres"`
        EnginsLoues   int64 `json:"enginsLoues"`
}

// LocationKPI — KPIs agrégés sur les locations.
type LocationKPI struct {
        LocationsEnCours    int64   `json:"locationsEnCours"`
        CoutTotalEnCours    float64 `json:"coutTotalEnCours"`
        CoutJournalierMoyen float64 `json:"coutJournalierMoyen"`
        LocationsCeMois     int64   `json:"locationsCeMois"`
}

// Usecase — cas d'usage pour le parc engins + locations.
type Usecase struct {
        repo Repo
        log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
        return &Usecase{repo: repo, log: log}
}

// ══════════════════════════════════════════════════════════════════
// Parc engins (Equipement)
// ══════════════════════════════════════════════════════════════════

// ListEquipementsOutput — résultat de ListEquipements.
type ListEquipementsOutput struct {
        Engins []model.Equipement `json:"engins"`
        KPI    EnginKPI           `json:"kpi"`
        Counts map[string]int64   `json:"-"` // map[equipementID]locationsCount — sérialisé côté dto
        Total  int64              `json:"total"`
}

// ListEquipements — liste paginée des équipements + KPI agrégés + counts batch.
func (uc *Usecase) ListEquipements(ctx context.Context, auth *database.AuthUser, in ListEquipementsInput) (*ListEquipementsOutput, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if in.Page < 1 {
                in.Page = 1
        }
        if in.PageSize < 1 {
                in.PageSize = 50
        }

        engins, total, err := uc.repo.ListEquipements(ctx, auth, in)
        if err != nil {
                uc.log.Error("engin.ListEquipements", "err", err, "auth_uid", auth.UserID)
                return nil, domain.ErrInternal
        }

        // Batch count locations par équipement (évite N+1)
        counts := make(map[string]int64, len(engins))
        if len(engins) > 0 {
                ids := make([]string, len(engins))
                for i := range engins {
                        ids[i] = engins[i].ID
                }
                counts, err = uc.repo.CountLocationsByEquipements(ctx, auth, ids)
                if err != nil {
                        uc.log.Error("engin.ListEquipements: CountLocationsByEquipements", "err", err)
                        return nil, domain.ErrInternal
                }
        }

        // KPIs agrégés sur tout le tenant (sans filtres)
        tot, propres, loues, err := uc.repo.CountEquipementsByTypeLocation(ctx, auth)
        if err != nil {
                uc.log.Error("engin.ListEquipements: CountEquipementsByTypeLocation", "err", err)
                return nil, domain.ErrInternal
        }

        return &ListEquipementsOutput{
                Engins: engins,
                KPI: EnginKPI{
                        TotalEngins:   tot,
                        EnginsPropres: propres,
                        EnginsLoues:   loues,
                },
                Counts: counts,
                Total:  total,
        }, nil
}

// GetEquipement — détail d'un équipement par ID.
func (uc *Usecase) GetEquipement(ctx context.Context, auth *database.AuthUser, id string) (*model.Equipement, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        e, err := uc.repo.GetEquipementByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("engin.GetEquipement: GetEquipementByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if e == nil {
                return nil, domain.ErrNotFound
        }
        return e, nil
}

// validEtats — états d'engin autorisés (alignés sur Prisma + frontend).
var validEtats = map[string]struct{}{
        "BON":           {},
        "EN_REPARATION": {},
        "HORS_SERVICE":  {},
}

// validTypeLocations — types de location autorisés.
var validTypeLocations = map[string]struct{}{
        "PROPRE":   {},
        "LOCATION": {},
}

// validStatutsLocation — statuts de location autorisés.
var validStatutsLocation = map[string]struct{}{
        "EN_COURS": {},
        "TERMINE":  {},
        "ANNULE":   {},
}

func isValidEtat(s string) bool {
        _, ok := validEtats[s]
        return ok
}

func isValidTypeLocation(s string) bool {
        _, ok := validTypeLocations[s]
        return ok
}

func isValidStatutLocation(s string) bool {
        _, ok := validStatutsLocation[s]
        return ok
}

// CreateEquipement — crée un nouvel équipement (tenant-scoped).
func (uc *Usecase) CreateEquipement(ctx context.Context, auth *database.AuthUser, in CreateEquipementInput) (*model.Equipement, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }

        in.Designation = strings.TrimSpace(in.Designation)
        if in.Designation == "" {
                return nil, fmt.Errorf("%w: designation is required", domain.ErrBadRequest)
        }
        etat := in.Etat
        if etat == "" {
                etat = "BON"
        }
        if !isValidEtat(etat) {
                return nil, fmt.Errorf("%w: invalid etat %q", domain.ErrBadRequest, etat)
        }
        if in.TypeLocation != nil && *in.TypeLocation != "" {
                if !isValidTypeLocation(*in.TypeLocation) {
                        return nil, fmt.Errorf("%w: invalid typeLocation %q", domain.ErrBadRequest, *in.TypeLocation)
                }
        }

        // Résolution entrepriseId (force EntrepriseID pour non-SUPER_ADMIN — RLS WITH CHECK)
        var entrepriseID *string
        if auth.Role != "SUPER_ADMIN" {
                if auth.EntrepriseID == "" {
                        return nil, fmt.Errorf("%w: non-admin user has no entrepriseId", domain.ErrBadRequest)
                }
                eid := auth.EntrepriseID
                entrepriseID = &eid
        }

        e := model.Equipement{
                Designation:     in.Designation,
                TypeEquipement:  in.TypeEquipement,
                Marque:          in.Marque,
                Modele:          in.Modele,
                Immatriculation: in.Immatriculation,
                Etat:            etat,
                TypeLocation:    in.TypeLocation,
                EntrepriseID:    entrepriseID,
        }

        created, err := uc.repo.CreateEquipement(ctx, auth, e)
        if err != nil {
                uc.log.Error("engin.CreateEquipement: repo", "err", err, "designation", in.Designation)
                return nil, domain.ErrInternal
        }

        uc.log.Info("engin created", "id", created.ID, "designation", created.Designation, "by", auth.UserID)
        return created, nil
}

// UpdateEquipement — met à jour un équipement (partial updates).
func (uc *Usecase) UpdateEquipement(ctx context.Context, auth *database.AuthUser, id string, in UpdateEquipementInput) (*model.Equipement, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, fmt.Errorf("%w: id is required", domain.ErrBadRequest)
        }

        updates := map[string]any{}
        if in.Designation != nil {
                v := strings.TrimSpace(*in.Designation)
                if v == "" {
                        return nil, fmt.Errorf("%w: designation cannot be empty", domain.ErrBadRequest)
                }
                updates["designation"] = v
        }
        // Pour les champs nullable : *string == nil → pas d'update
        //                          *string == "" → SET NULL (le frontend envoie null pour vider)
        //                          *string == "x" → SET "x"
        if in.TypeEquipement != nil {
                if *in.TypeEquipement == "" {
                        updates["typeEquipement"] = nil
                } else {
                        updates["typeEquipement"] = *in.TypeEquipement
                }
        }
        if in.Marque != nil {
                if *in.Marque == "" {
                        updates["marque"] = nil
                } else {
                        updates["marque"] = *in.Marque
                }
        }
        if in.Modele != nil {
                if *in.Modele == "" {
                        updates["modele"] = nil
                } else {
                        updates["modele"] = *in.Modele
                }
        }
        if in.Immatriculation != nil {
                if *in.Immatriculation == "" {
                        updates["immatriculation"] = nil
                } else {
                        updates["immatriculation"] = *in.Immatriculation
                }
        }
        if in.Etat != nil {
                if !isValidEtat(*in.Etat) {
                        return nil, fmt.Errorf("%w: invalid etat %q", domain.ErrBadRequest, *in.Etat)
                }
                updates["etat"] = *in.Etat
        }
        if in.TypeLocation != nil {
                if *in.TypeLocation != "" && !isValidTypeLocation(*in.TypeLocation) {
                        return nil, fmt.Errorf("%w: invalid typeLocation %q", domain.ErrBadRequest, *in.TypeLocation)
                }
                if *in.TypeLocation == "" {
                        updates["typeLocation"] = nil
                } else {
                        updates["typeLocation"] = *in.TypeLocation
                }
        }

        if len(updates) == 0 {
                // Pas d'updates → on retourne l'équipement courant
                return uc.GetEquipement(ctx, auth, id)
        }

        updated, err := uc.repo.UpdateEquipement(ctx, auth, id, updates)
        if err != nil {
                uc.log.Error("engin.UpdateEquipement: repo", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }

        uc.log.Info("engin updated", "id", id, "by", auth.UserID, "fields", keysOf(updates))
        return updated, nil
}

// DeleteEquipement — supprime un équipement (hard delete).
// Renvoie ErrConflict si des locations liées existent (le frontend doit
// d'abord supprimer les locations — données comptables).
func (uc *Usecase) DeleteEquipement(ctx context.Context, auth *database.AuthUser, id string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if id == "" {
                return fmt.Errorf("%w: id is required", domain.ErrBadRequest)
        }

        existing, err := uc.repo.GetEquipementByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("engin.DeleteEquipement: GetEquipementByID", "err", err, "id", id)
                return domain.ErrInternal
        }
        if existing == nil {
                return domain.ErrNotFound
        }

        // Vérifie les locations liées — on bloque si au moins une location existe.
        // (Les locations contiennent des données comptables : on ne cascade pas.)
        locCount, err := uc.repo.CountLocationsByEquipement(ctx, auth, id)
        if err != nil {
                uc.log.Error("engin.DeleteEquipement: CountLocationsByEquipement", "err", err, "id", id)
                return domain.ErrInternal
        }
        if locCount > 0 {
                return fmt.Errorf("%w: engin has %d location(s) liée(s) — supprimez d'abord les locations",
                        domain.ErrConflict, locCount)
        }

        if err := uc.repo.DeleteEquipement(ctx, auth, id); err != nil {
                uc.log.Error("engin.DeleteEquipement: repo", "err", err, "id", id)
                return domain.ErrInternal
        }

        uc.log.Info("engin deleted", "id", id, "by", auth.UserID)
        return nil
}

// ══════════════════════════════════════════════════════════════════
// Locations (LocationEngin)
// ══════════════════════════════════════════════════════════════════

// ListLocationsOutput — résultat de ListLocations.
type ListLocationsOutput struct {
        Locations []model.LocationEngin `json:"locations"`
        KPI       LocationKPI           `json:"kpi"`
        Total     int64                 `json:"total"`
}

// ListLocations — liste filtrée des locations + KPI agrégés.
func (uc *Usecase) ListLocations(ctx context.Context, auth *database.AuthUser, in ListLocationsInput) (*ListLocationsOutput, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if in.Page < 1 {
                in.Page = 1
        }
        if in.PageSize < 1 {
                in.PageSize = 50
        }

        locs, total, err := uc.repo.ListLocations(ctx, auth, in)
        if err != nil {
                uc.log.Error("engin.ListLocations", "err", err, "auth_uid", auth.UserID)
                return nil, domain.ErrInternal
        }

        enCours, coutTotal, coutMoyen, ceMois, err := uc.repo.LocationKPIs(ctx, auth)
        if err != nil {
                uc.log.Error("engin.ListLocations: LocationKPIs", "err", err)
                return nil, domain.ErrInternal
        }

        return &ListLocationsOutput{
                Locations: locs,
                KPI: LocationKPI{
                        LocationsEnCours:    enCours,
                        CoutTotalEnCours:    coutTotal,
                        CoutJournalierMoyen: coutMoyen,
                        LocationsCeMois:     ceMois,
                },
                Total: total,
        }, nil
}

// GetLocation — détail d'une location par ID.
func (uc *Usecase) GetLocation(ctx context.Context, auth *database.AuthUser, id string) (*model.LocationEngin, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, domain.ErrBadRequest
        }
        l, err := uc.repo.GetLocationByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("engin.GetLocation: GetLocationByID", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if l == nil {
                return nil, domain.ErrNotFound
        }
        return l, nil
}

// CreateLocation — crée une nouvelle location.
// Vérifie l'existence de l'equipement (RLS-filtered) côté usecase.
func (uc *Usecase) CreateLocation(ctx context.Context, auth *database.AuthUser, in CreateLocationInput) (*model.LocationEngin, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if in.EquipementID == "" {
                return nil, fmt.Errorf("%w: equipementId is required", domain.ErrBadRequest)
        }
        if in.DateDebut.IsZero() {
                return nil, fmt.Errorf("%w: dateDebut is required", domain.ErrBadRequest)
        }
        if in.CoutJournalier < 0 {
                return nil, fmt.Errorf("%w: coutJournalier must be >= 0", domain.ErrBadRequest)
        }
        statut := in.Statut
        if statut == "" {
                statut = "EN_COURS"
        }
        if !isValidStatutLocation(statut) {
                return nil, fmt.Errorf("%w: invalid statut %q", domain.ErrBadRequest, statut)
        }
        if in.DateFin != nil && in.DateFin.Before(in.DateDebut) {
                return nil, fmt.Errorf("%w: dateFin must be >= dateDebut", domain.ErrBadRequest)
        }

        // Vérifie l'existence de l'equipement (RLS-filtered)
        eq, err := uc.repo.GetEquipementByID(ctx, auth, in.EquipementID)
        if err != nil {
                uc.log.Error("engin.CreateLocation: GetEquipementByID", "err", err, "equipementId", in.EquipementID)
                return nil, domain.ErrInternal
        }
        if eq == nil {
                return nil, fmt.Errorf("%w: equipementId not found", domain.ErrNotFound)
        }

        l := model.LocationEngin{
                EquipementID:   in.EquipementID,
                FournisseurID:  in.FournisseurID,
                FournisseurNom: in.FournisseurNom,
                FournisseurTel: in.FournisseurTel,
                NumeroContrat:  in.NumeroContrat,
                ChantierID:     in.ChantierID,
                CoutJournalier: in.CoutJournalier,
                CoutTransport:  in.CoutTransport,
                CoutOperateur:  in.CoutOperateur,
                Caution:        in.Caution,
                DateDebut:      in.DateDebut,
                DateFin:        in.DateFin,
                Statut:         statut,
                Conditions:     in.Conditions,
        }

        created, err := uc.repo.CreateLocation(ctx, auth, l)
        if err != nil {
                uc.log.Error("engin.CreateLocation: repo", "err", err, "equipementId", in.EquipementID)
                return nil, domain.ErrInternal
        }

        uc.log.Info("engin.location created", "id", created.ID, "equipementId", in.EquipementID, "by", auth.UserID)
        return created, nil
}

// UpdateLocation — met à jour une location (partial updates).
// Utilisé aussi pour le changement de statut / clôture (PUT /locations/{id}
// avec {statut:"TERMINE"} ou {statut:"ANNULE"}).
func (uc *Usecase) UpdateLocation(ctx context.Context, auth *database.AuthUser, id string, in UpdateLocationInput) (*model.LocationEngin, error) {
        if auth == nil {
                return nil, domain.ErrUnauthorized
        }
        if id == "" {
                return nil, fmt.Errorf("%w: id is required", domain.ErrBadRequest)
        }

        updates := map[string]any{}
        // Pour les champs nullable : *string == nil → pas d'update
        //                          *string == "" → SET NULL (le frontend envoie null pour vider)
        //                          *string == "x" → SET "x"
        if in.FournisseurID != nil {
                if *in.FournisseurID == "" {
                        updates["fournisseurId"] = nil
                } else {
                        updates["fournisseurId"] = *in.FournisseurID
                }
        }
        if in.FournisseurNom != nil {
                if *in.FournisseurNom == "" {
                        updates["fournisseurNom"] = nil
                } else {
                        updates["fournisseurNom"] = *in.FournisseurNom
                }
        }
        if in.FournisseurTel != nil {
                if *in.FournisseurTel == "" {
                        updates["fournisseurTel"] = nil
                } else {
                        updates["fournisseurTel"] = *in.FournisseurTel
                }
        }
        if in.NumeroContrat != nil {
                if *in.NumeroContrat == "" {
                        updates["numeroContrat"] = nil
                } else {
                        updates["numeroContrat"] = *in.NumeroContrat
                }
        }
        if in.ChantierID != nil {
                if *in.ChantierID == "" {
                        updates["chantierId"] = nil
                } else {
                        updates["chantierId"] = *in.ChantierID
                }
        }
        if in.CoutJournalier != nil {
                if *in.CoutJournalier < 0 {
                        return nil, fmt.Errorf("%w: coutJournalier must be >= 0", domain.ErrBadRequest)
                }
                updates["coutJournalier"] = *in.CoutJournalier
        }
        if in.CoutTransport != nil {
                updates["coutTransport"] = *in.CoutTransport
        }
        if in.CoutOperateur != nil {
                updates["coutOperateur"] = *in.CoutOperateur
        }
        if in.Caution != nil {
                updates["caution"] = *in.Caution
        }
        if in.DateDebut != nil {
                updates["dateDebut"] = *in.DateDebut
        }
        if in.DateFin != nil {
                updates["dateFin"] = *in.DateFin
        }
        if in.Statut != nil {
                if !isValidStatutLocation(*in.Statut) {
                        return nil, fmt.Errorf("%w: invalid statut %q", domain.ErrBadRequest, *in.Statut)
                }
                updates["statut"] = *in.Statut
        }
        if in.Conditions != nil {
                if *in.Conditions == "" {
                        updates["conditions"] = nil
                } else {
                        updates["conditions"] = *in.Conditions
                }
        }

        if len(updates) == 0 {
                // Pas d'updates → on retourne la location courante
                return uc.GetLocation(ctx, auth, id)
        }

        updated, err := uc.repo.UpdateLocation(ctx, auth, id, updates)
        if err != nil {
                uc.log.Error("engin.UpdateLocation: repo", "err", err, "id", id)
                return nil, domain.ErrInternal
        }
        if updated == nil {
                return nil, domain.ErrNotFound
        }

        uc.log.Info("engin.location updated", "id", id, "by", auth.UserID, "fields", keysOf(updates))
        return updated, nil
}

// DeleteLocation — supprime une location (hard delete).
func (uc *Usecase) DeleteLocation(ctx context.Context, auth *database.AuthUser, id string) error {
        if auth == nil {
                return domain.ErrUnauthorized
        }
        if id == "" {
                return fmt.Errorf("%w: id is required", domain.ErrBadRequest)
        }

        existing, err := uc.repo.GetLocationByID(ctx, auth, id)
        if err != nil {
                uc.log.Error("engin.DeleteLocation: GetLocationByID", "err", err, "id", id)
                return domain.ErrInternal
        }
        if existing == nil {
                return domain.ErrNotFound
        }

        if err := uc.repo.DeleteLocation(ctx, auth, id); err != nil {
                uc.log.Error("engin.DeleteLocation: repo", "err", err, "id", id)
                return domain.ErrInternal
        }

        uc.log.Info("engin.location deleted", "id", id, "by", auth.UserID)
        return nil
}

// keysOf retourne les clés d'un map (pour logging).
func keysOf(m map[string]any) []string {
        keys := make([]string, 0, len(m))
        for k := range m {
                keys = append(keys, k)
        }
        return keys
}
