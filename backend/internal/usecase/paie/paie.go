// Package paie — usecase pour la paie (Phase 3, write métier).
//
// Deux sous-domaines :
//  1. PaiementHebdo — paiement hebdomadaire calculé depuis les pointages
//     validés (present=true AND valide=true) sur une semaine.
//  2. SalaireMensuel — paie mensuelle avec retenues CNPS, IR, avances,
//     absences, heures supp.
//
// Toutes les requêtes sont tenant-scoped via RLS. Les tables PaiementHebdo et
// SalaireMensuel n'ont pas de RLS direct :
//   - PaiementHebdo a un chantierId → JOIN sur "Chantier" (RLS-protected)
//   - SalaireMensuel a un journalierId → JOIN sur "Journalier" (RLS-protected)
package paie

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"time"

	"opuc/internal/domain"
	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
)

// Repo — interface définie côté usecase. Implémentée par gorm.PaieRepository.
type Repo interface {
	// PaiementHebdo
	ListPaiementHebdo(ctx context.Context, auth *database.AuthUser, filter PaiementHebdoListInput) ([]model.PaiementHebdo, int64, error)
	GetPaiementHebdoByID(ctx context.Context, auth *database.AuthUser, id string) (*model.PaiementHebdo, error)
	UpdatePaiementHebdo(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.PaiementHebdo, error)
	ComputeWeeklySums(ctx context.Context, auth *database.AuthUser, chantierID string, semaineDebut, semaineFin time.Time) (map[string]float64, error)
	BulkCreatePaiementHebdo(ctx context.Context, auth *database.AuthUser, items []model.PaiementHebdo) ([]model.PaiementHebdo, error)

	// SalaireMensuel
	ListSalaireMensuel(ctx context.Context, auth *database.AuthUser, filter SalaireMensuelListInput) ([]model.SalaireMensuel, int64, error)
	GetSalaireMensuelByID(ctx context.Context, auth *database.AuthUser, id string) (*model.SalaireMensuel, error)
	CreateSalaireMensuel(ctx context.Context, auth *database.AuthUser, s model.SalaireMensuel) (*model.SalaireMensuel, error)
	UpdateSalaireMensuel(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.SalaireMensuel, error)
}

// PaiementHebdoListInput — filtres pour ListPaiementHebdo.
type PaiementHebdoListInput struct {
	ChantierID   string
	JournalierID string
	Statut       string
	Page         int
	PageSize     int
}

// SalaireMensuelListInput — filtres pour ListSalaireMensuel.
type SalaireMensuelListInput struct {
	JournalierID string
	Mois         int  // 0 = no filter
	Annee        int  // 0 = no filter
	Statut       string
	Page         int
	PageSize     int
}

// GeneratePaiementHebdoInput — payload pour GeneratePaiementHebdo.
type GeneratePaiementHebdoInput struct {
	ChantierID   string
	SemaineDebut time.Time
}

// GenerateSalaireMensuelInput — payload pour GenerateSalaireMensuel.
// montantHeuresSupp et retenueAbsences sont calculés par le usecase.
type GenerateSalaireMensuelInput struct {
	JournalierID string
	Mois         int
	Annee        int
	SalaireBase  float64
	Primes       float64
	HeuresSupp   float64
	RetenuesCNPS float64
	RetenuesIR   float64
	Avances      float64
	Absences     int
}

// GeneratePaiementHebdoOutput — résultat de GeneratePaiementHebdo.
type GeneratePaiementHebdoOutput struct {
	ChantierID   string
	SemaineDebut time.Time
	SemaineFin   time.Time
	Generated    []model.PaiementHebdo
}

// UpdatePaiementHebdoInput — payload pour UpdatePaiementHebdo.
type UpdatePaiementHebdoInput struct {
	MontantVerse *float64
	ModePaiement *string
	Statut       *string
	DatePaiement *time.Time
}

// UpdateSalaireMensuelInput — payload pour UpdateSalaireMensuel.
type UpdateSalaireMensuelInput struct {
	Statut       *string
	DatePaiement *time.Time
	ModePaiement *string
}

// Constantes pour les calculs de paie.
const (
	heuresMensuellesLegales = 173.33 // heures/mois (35h/semaine × 4.952 semaines)
	majorationHeuresSupp    = 1.25   // +25% (taux légal CI pour les 8 premières heures)
	joursParMois            = 30.0   // prorata journalier pour retenue absences
)

// Usecase — cas d'usage pour la paie.
type Usecase struct {
	repo Repo
	log  *slog.Logger
}

// NewUsecase constructeur.
func NewUsecase(repo Repo, log *slog.Logger) *Usecase {
	return &Usecase{repo: repo, log: log}
}

// ── PaiementHebdo ──────────────────────────────────────────────

// ListPaiementHebdo — liste paginée des paiements hebdo.
func (uc *Usecase) ListPaiementHebdo(ctx context.Context, auth *database.AuthUser, in PaiementHebdoListInput) ([]model.PaiementHebdo, int64, error) {
	if auth == nil {
		return nil, 0, domain.ErrUnauthorized
	}
	if in.Page < 1 {
		in.Page = 1
	}
	if in.PageSize < 1 {
		in.PageSize = 50
	}
	items, total, err := uc.repo.ListPaiementHebdo(ctx, auth, in)
	if err != nil {
		uc.log.Error("paie.ListPaiementHebdo", "err", err)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// UpdatePaiementHebdo — met à jour un paiement hebdo (montantVerse, modePaiement, statut, datePaiement).
// valideParId est forcé à auth.UserID.
func (uc *Usecase) UpdatePaiementHebdo(ctx context.Context, auth *database.AuthUser, id string, in UpdatePaiementHebdoInput) (*model.PaiementHebdo, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}

	updates := map[string]any{}
	if in.MontantVerse != nil {
		updates["montantVerse"] = *in.MontantVerse
	}
	if in.ModePaiement != nil {
		updates["modePaiement"] = *in.ModePaiement
	}
	if in.Statut != nil {
		updates["statut"] = *in.Statut
	}
	if in.DatePaiement != nil {
		updates["datePaiement"] = *in.DatePaiement
	}
	if len(updates) == 0 {
		// Récupère juste l'existant
		existing, err := uc.repo.GetPaiementHebdoByID(ctx, auth, id)
		if err != nil {
			uc.log.Error("paie.UpdatePaiementHebdo: GetPaiementHebdoByID", "err", err, "id", id)
			return nil, domain.ErrInternal
		}
		if existing == nil {
			return nil, domain.ErrNotFound
		}
		return existing, nil
	}
	// valideParId = auth.UserID
	updates["valideParId"] = auth.UserID
	updates["updatedAt"] = time.Now().UTC()

	updated, err := uc.repo.UpdatePaiementHebdo(ctx, auth, id, updates)
	if err != nil {
		uc.log.Error("paie.UpdatePaiementHebdo: repo", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	return updated, nil
}

// GeneratePaiementHebdo — génère les paiements hebdo pour une semaine donnée.
//
// Étapes :
//  1. semaineFin = semaineDebut + 6 jours
//  2. Query Pointage where chantierId=?, present=true, valide=true, dateTravail BETWEEN
//     semaineDebut AND semaineFin, GROUP BY journalierId, SUM(tauxJournalier)
//  3. Pour chaque journalier, créer un PaiementHebdo (statut=EN_ATTENTE)
//  4. Retourner la liste des paiements créés
//
// Note : ne dédoublonne pas les paiements déjà générés pour la même semaine
// (la spécification ne le demande pas explicitement ; à gérer côté caller).
func (uc *Usecase) GeneratePaiementHebdo(ctx context.Context, auth *database.AuthUser, in GeneratePaiementHebdoInput) (*GeneratePaiementHebdoOutput, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.ChantierID == "" {
		return nil, fmt.Errorf("%w: chantierId is required", domain.ErrBadRequest)
	}
	if in.SemaineDebut.IsZero() {
		return nil, fmt.Errorf("%w: semaineDebut is required", domain.ErrBadRequest)
	}
	semaineFin := in.SemaineDebut.AddDate(0, 0, 6)

	sums, err := uc.repo.ComputeWeeklySums(ctx, auth, in.ChantierID, in.SemaineDebut, semaineFin)
	if err != nil {
		uc.log.Error("paie.GeneratePaiementHebdo: ComputeWeeklySums", "err", err)
		return nil, domain.ErrInternal
	}

	if len(sums) == 0 {
		return &GeneratePaiementHebdoOutput{
			ChantierID:   in.ChantierID,
			SemaineDebut: in.SemaineDebut,
			SemaineFin:   semaineFin,
			Generated:    []model.PaiementHebdo{},
		}, nil
	}

	items := make([]model.PaiementHebdo, 0, len(sums))
	now := time.Now().UTC()
	for journalierID, montant := range sums {
		items = append(items, model.PaiementHebdo{
			JournalierID:   journalierID,
			ChantierID:     in.ChantierID,
			SemaineDebut:   in.SemaineDebut,
			SemaineFin:     semaineFin,
			MontantCalcule: montant,
			Statut:         "EN_ATTENTE",
			CreatedAt:      now,
			UpdatedAt:      now,
		})
	}

	created, err := uc.repo.BulkCreatePaiementHebdo(ctx, auth, items)
	if err != nil {
		uc.log.Error("paie.GeneratePaiementHebdo: BulkCreatePaiementHebdo", "err", err)
		return nil, domain.ErrInternal
	}

	return &GeneratePaiementHebdoOutput{
		ChantierID:   in.ChantierID,
		SemaineDebut: in.SemaineDebut,
		SemaineFin:   semaineFin,
		Generated:    created,
	}, nil
}

// ── SalaireMensuel ─────────────────────────────────────────────

// ListSalaireMensuel — liste paginée des salaires mensuels.
func (uc *Usecase) ListSalaireMensuel(ctx context.Context, auth *database.AuthUser, in SalaireMensuelListInput) ([]model.SalaireMensuel, int64, error) {
	if auth == nil {
		return nil, 0, domain.ErrUnauthorized
	}
	if in.Page < 1 {
		in.Page = 1
	}
	if in.PageSize < 1 {
		in.PageSize = 50
	}
	items, total, err := uc.repo.ListSalaireMensuel(ctx, auth, in)
	if err != nil {
		uc.log.Error("paie.ListSalaireMensuel", "err", err)
		return nil, 0, domain.ErrInternal
	}
	return items, total, nil
}

// GenerateSalaireMensuel — génère un salaire mensuel pour un journalier.
//
// Calculs :
//   - montantHeuresSupp = (salaireBase / 173.33) * heuresSupp * 1.25
//   - retenueAbsences   = (salaireBase / 30) * absences
//   - netAPayer         = salaireBase + primes + montantHeuresSupp
//                          - retenuesCNPS - retenuesIR - avances - retenueAbsences
func (uc *Usecase) GenerateSalaireMensuel(ctx context.Context, auth *database.AuthUser, in GenerateSalaireMensuelInput) (*model.SalaireMensuel, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if in.JournalierID == "" {
		return nil, fmt.Errorf("%w: journalierId is required", domain.ErrBadRequest)
	}
	if in.Mois < 1 || in.Mois > 12 {
		return nil, fmt.Errorf("%w: mois must be 1-12", domain.ErrBadRequest)
	}
	if in.Annee < 2000 || in.Annee > 2100 {
		return nil, fmt.Errorf("%w: annee out of range", domain.ErrBadRequest)
	}

	montantHeuresSupp := 0.0
	if in.HeuresSupp > 0 && in.SalaireBase > 0 {
		tauxHoraire := in.SalaireBase / heuresMensuellesLegales
		montantHeuresSupp = math.Round(tauxHoraire*in.HeuresSupp*majorationHeuresSupp*100) / 100
	}
	retenueAbsences := 0.0
	if in.Absences > 0 && in.SalaireBase > 0 {
		retenueAbsences = math.Round((in.SalaireBase/joursParMois)*float64(in.Absences)*100) / 100
	}
	netAPayer := in.SalaireBase + in.Primes + montantHeuresSupp -
		in.RetenuesCNPS - in.RetenuesIR - in.Avances - retenueAbsences
	netAPayer = math.Round(netAPayer*100) / 100

	s := model.SalaireMensuel{
		JournalierID:      in.JournalierID,
		Mois:              in.Mois,
		Annee:             in.Annee,
		SalaireBase:       in.SalaireBase,
		Primes:            in.Primes,
		HeuresSupp:        in.HeuresSupp,
		MontantHeuresSupp: montantHeuresSupp,
		RetenuesCNPS:      in.RetenuesCNPS,
		RetenuesIR:        in.RetenuesIR,
		Avances:           in.Avances,
		Absences:          in.Absences,
		RetenueAbsences:   retenueAbsences,
		NetAPayer:         netAPayer,
		Statut:            "EN_ATTENTE",
	}

	created, err := uc.repo.CreateSalaireMensuel(ctx, auth, s)
	if err != nil {
		uc.log.Error("paie.GenerateSalaireMensuel: CreateSalaireMensuel", "err", err)
		return nil, domain.ErrInternal
	}
	return created, nil
}

// UpdateSalaireMensuel — met à jour un salaire mensuel (statut, datePaiement, modePaiement).
// valideParId est forcé à auth.UserID.
func (uc *Usecase) UpdateSalaireMensuel(ctx context.Context, auth *database.AuthUser, id string, in UpdateSalaireMensuelInput) (*model.SalaireMensuel, error) {
	if auth == nil {
		return nil, domain.ErrUnauthorized
	}
	if id == "" {
		return nil, domain.ErrBadRequest
	}

	updates := map[string]any{}
	if in.Statut != nil {
		updates["statut"] = *in.Statut
	}
	if in.DatePaiement != nil {
		updates["datePaiement"] = *in.DatePaiement
	}
	if in.ModePaiement != nil {
		updates["modePaiement"] = *in.ModePaiement
	}
	if len(updates) == 0 {
		existing, err := uc.repo.GetSalaireMensuelByID(ctx, auth, id)
		if err != nil {
			uc.log.Error("paie.UpdateSalaireMensuel: Get", "err", err, "id", id)
			return nil, domain.ErrInternal
		}
		if existing == nil {
			return nil, domain.ErrNotFound
		}
		return existing, nil
	}
	updates["valideParId"] = auth.UserID
	updates["updatedAt"] = time.Now().UTC()

	updated, err := uc.repo.UpdateSalaireMensuel(ctx, auth, id, updates)
	if err != nil {
		uc.log.Error("paie.UpdateSalaireMensuel: repo", "err", err, "id", id)
		return nil, domain.ErrInternal
	}
	if updated == nil {
		return nil, domain.ErrNotFound
	}
	return updated, nil
}
