// Package gorm — facturation_repo.go
// Repository pour les factures + paiements (Phase 4, commercial).
//
// Tables :
//   - Facture (RLS-protected, filtrage direct via WithTenant)
//   - PaiementFacture (PAS de RLS direct, filtrage via JOIN sur "Facture")
//
// Calculs :
//   - montantTVA = montantHT × tauxTVA/100
//   - totalTTC = montantHT + montantTVA
//   - paiement update : montantPaye += paiement.montant ;
//     si montantPaye >= totalTTC → statut=PAYEE, datePaiement=now ;
//     sinon si montantPaye > 0 → statut=PARTIELLEMENT_PAYEE
package gorm

import (
	"context"
	"errors"
	"fmt"
	"time"

	"opuc/internal/domain/model"
	"opuc/internal/infrastructure/database"
	"opuc/internal/usecase/facturation"

	"gorm.io/gorm"
)

// FacturationRepository — repository tenant-scoped pour les factures + paiements.
type FacturationRepository struct {
	db *gorm.DB
}

// NewFacturationRepository constructeur.
func NewFacturationRepository(runtimeDB *gorm.DB) *FacturationRepository {
	return &FacturationRepository{db: runtimeDB}
}

// compile-time check : FacturationRepository implémente facturation.Repo.
var _ facturation.Repo = (*FacturationRepository)(nil)

// ── Facture ────────────────────────────────────────────────────

// List — liste paginée des factures (Preload Client + Contrat).
// Filtres : clientId, contratId, statut, typeFacture, search sur numero.
func (r *FacturationRepository) List(ctx context.Context, auth *database.AuthUser, filter facturation.ListInput) ([]model.Facture, int64, error) {
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	var (
		items []model.Facture
		total int64
	)
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		q := tx.Model(&model.Facture{})
		if filter.ClientID != "" {
			q = q.Where(`"clientId" = ?`, filter.ClientID)
		}
		if filter.ContratID != "" {
			q = q.Where(`"contratId" = ?`, filter.ContratID)
		}
		if filter.Statut != "" {
			q = q.Where("statut = ?", filter.Statut)
		}
		if filter.TypeFacture != "" {
			q = q.Where(`"typeFacture" = ?`, filter.TypeFacture)
		}
		if filter.Search != "" {
			like := "%" + filter.Search + "%"
			q = q.Where("numero ILIKE ?", like)
		}
		if err := q.Count(&total).Error; err != nil {
			return fmt.Errorf("count factures: %w", err)
		}
		if err := q.
			Preload("Client").
			Preload("Contrat").
			Order(`"createdAt" DESC`).
			Offset(offset).
			Limit(pageSize).
			Find(&items).Error; err != nil {
			return fmt.Errorf("list factures: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// GetByID — fetch une facture par ID (Preload Client + Contrat + Paiements).
// (nil, nil) si non trouvée.
func (r *FacturationRepository) GetByID(ctx context.Context, auth *database.AuthUser, id string) (*model.Facture, error) {
	var f model.Facture
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		err := tx.
			Preload("Client").
			Preload("Contrat").
			Preload("Paiements").
			Where("id = ?", id).
			First(&f).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if f.ID == "" {
		return nil, nil
	}
	return &f, nil
}

// CountByYear — nombre de factures émises pour une année (pour numero auto).
func (r *FacturationRepository) CountByYear(ctx context.Context, auth *database.AuthUser, year int) (int64, error) {
	yearStart := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	yearEnd := time.Date(year+1, 1, 1, 0, 0, 0, 0, time.UTC)
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.Facture{}).
			Where(`"dateEmission" >= ? AND "dateEmission" < ?`, yearStart, yearEnd).
			Count(&n).Error
	})
	return n, err
}

// Create — insère une nouvelle facture.
func (r *FacturationRepository) Create(ctx context.Context, auth *database.AuthUser, f model.Facture) (*model.Facture, error) {
	if f.ID == "" {
		f.ID = newCuidLikeID()
	}
	now := time.Now().UTC()
	if f.CreatedAt.IsZero() {
		f.CreatedAt = now
	}
	if f.UpdatedAt.IsZero() {
		f.UpdatedAt = now
	}
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Create(&f).Error
	})
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// Update — met à jour une facture par ID.
func (r *FacturationRepository) Update(ctx context.Context, auth *database.AuthUser, id string, updates map[string]any) (*model.Facture, error) {
	var updated model.Facture
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.Facture{}).Where("id = ?", id).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		if err := tx.Model(&model.Facture{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.
			Preload("Client").
			Preload("Contrat").
			Preload("Paiements").
			Where("id = ?", id).
			First(&updated).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if updated.ID == "" {
		return nil, nil
	}
	return &updated, nil
}

// Delete — supprime une facture par ID (hard delete). Idempotent.
// Ne supprime pas si des paiements sont liés (à vérifier côté usecase).
func (r *FacturationRepository) Delete(ctx context.Context, auth *database.AuthUser, id string) error {
	return database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&model.Facture{}).Where("id = ?", id).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return nil
		}
		return tx.Where("id = ?", id).Delete(&model.Facture{}).Error
	})
}

// HasPaiements — true si au moins un paiement référence cette facture.
func (r *FacturationRepository) HasPaiements(ctx context.Context, auth *database.AuthUser, factureID string) (bool, error) {
	var n int64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Model(&model.PaiementFacture{}).
			Joins(`JOIN "Facture" ON "Facture".id = "PaiementFacture"."factureId"`).
			Where(`"PaiementFacture"."factureId" = ?`, factureID).
			Count(&n).Error
	})
	return n > 0, err
}

// ── PaiementFacture (PAS de RLS direct, filtrage via JOIN Facture) ────

// ListPaiements — liste les paiements d'une facture (RLS via JOIN Facture).
func (r *FacturationRepository) ListPaiements(ctx context.Context, auth *database.AuthUser, factureID string) ([]model.PaiementFacture, error) {
	var items []model.PaiementFacture
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.
			Joins(`JOIN "Facture" ON "Facture".id = "PaiementFacture"."factureId"`).
			Where(`"PaiementFacture"."factureId" = ?`, factureID).
			Order(`"PaiementFacture"."datePaiement" DESC, "PaiementFacture"."createdAt" DESC`).
			Find(&items).Error
	})
	if err != nil {
		return nil, err
	}
	return items, nil
}

// CreatePaiement — insère un nouveau paiement.
// L'appelant doit ensuite mettre à jour la facture (montantPaye, statut, datePaiement).
func (r *FacturationRepository) CreatePaiement(ctx context.Context, auth *database.AuthUser, p model.PaiementFacture) (*model.PaiementFacture, error) {
	if p.ID == "" {
		p.ID = newCuidLikeID()
	}
	if p.CreatedAt.IsZero() {
		p.CreatedAt = time.Now().UTC()
	}
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		return tx.Create(&p).Error
	})
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// SumPaiementsByFacture — somme des paiements d'une facture (RLS via JOIN Facture).
func (r *FacturationRepository) SumPaiementsByFacture(ctx context.Context, auth *database.AuthUser, factureID string) (float64, error) {
	var total float64
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		row := tx.Model(&model.PaiementFacture{}).
			Joins(`JOIN "Facture" ON "Facture".id = "PaiementFacture"."factureId"`).
			Where(`"PaiementFacture"."factureId" = ?`, factureID).
			Select(`COALESCE(SUM("PaiementFacture".montant), 0)`).
			Row()
		return row.Scan(&total)
	})
	return total, err
}

// ── Stats ──────────────────────────────────────────────────────
//
// Pour les agrégats SUM/COUNT + Scan, on utilise Raw SQL avec identifiants
// camelCase explicitement quotés (GORM builder bug documenté en Phase 3).

// FacturationStats — agrégats de facturation (toutes factures visibles).
type FacturationStats struct {
	Total     int64            `gorm:"column:total" json:"total"`
	ByStatut  map[string]int64 `gorm:"-" json:"byStatut"`
	TotalTTC  float64          `gorm:"column:totalTTC" json:"totalTTC"`
	TotalPaye float64          `gorm:"column:totalPaye" json:"totalPaye"`
}

// Stats — agrégats de facturation pour le tenant courant.
//   - total : count toutes factures
//   - byStatut : map[statut]count
//   - totalTTC : SUM(totalTTC)
//   - totalPaye : SUM(montantPaye)
//   - enRetardCount : COUNT WHERE dateEcheance < now AND statut != PAYEE/ANNULEE
func (r *FacturationRepository) Stats(ctx context.Context, auth *database.AuthUser) (*facturation.Stats, error) {
	s := &facturation.Stats{
		ByStatut: make(map[string]int64),
	}
	err := database.WithTenant(ctx, r.db, auth, func(tx *gorm.DB) error {
		// 1. Total + byStatut
		type row struct {
			Statut string  `gorm:"column:statut"`
			Count  int64   `gorm:"column:count"`
			SumTTC float64 `gorm:"column:sumttc"`
			SumPay float64 `gorm:"column:sumpay"`
		}
		var rows []row
		// Raw SQL pour préserver le mapping camelCase (bug GORM builder).
		if err := tx.Raw(`SELECT
				statut as "statut",
				COUNT(*) as "count",
				COALESCE(SUM("totalTTC"), 0) as "sumttc",
				COALESCE(SUM("montantPaye"), 0) as "sumpay"
			FROM "Facture"
			GROUP BY statut`).Scan(&rows).Error; err != nil {
			return fmt.Errorf("stats by statut: %w", err)
		}
		for _, r := range rows {
			s.Total += r.Count
			s.ByStatut[r.Statut] = r.Count
			s.TotalTTC += r.SumTTC
			s.TotalPaye += r.SumPay
		}
		s.TotalImpaye = s.TotalTTC - s.TotalPaye
		if s.TotalImpaye < 0 {
			s.TotalImpaye = 0
		}

		// 2. En retard count : dateEcheance < now AND statut NOT IN (PAYEE, ANNULEE)
		now := time.Now().UTC()
		if err := tx.Model(&model.Facture{}).
			Where(`"dateEcheance" IS NOT NULL AND "dateEcheance" < ? AND statut NOT IN ?`, now, []string{"PAYEE", "ANNULEE"}).
			Count(&s.EnRetardCount).Error; err != nil {
			return fmt.Errorf("stats en retard: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s, nil
}
