// Package dto — chantier_dto.go
// DTOs pour les routes /api/v1/chantiers (Phase 2).
//
// Format wire (JSON) aligné sur le frontend Next.js :
//   - ChantierWithMeta : chantier + avancementGlobal + _count {phases, journaliers}
//   - KPIResponse      : compteurs agrégés {total, actifs, enPreparation, termines}
//   - ChantierListResponse : { chantiers: [...], kpi: {...} }
//
// Note : le _count est un objet {phases, journaliers} pour matcher Next.js,
// tandis que le usecase utilise des champs plats (PhaseCount, JournalierCount).
// Le handler fait la conversion usecase.ChantierWithMeta → dto.ChantierWithMeta.
package dto

import "opuc/internal/domain/model"

// CountMeta — sous-objet _count pour matcher le format Next.js.
type CountMeta struct {
	Phases      int64 `json:"phases"`
	Journaliers int64 `json:"journaliers"`
}

// ChantierWithMeta — chantier + avancementGlobal + _count.
// Embeds model.Chantier (les champs JSON sont flattés par Go).
type ChantierWithMeta struct {
	model.Chantier
	AvancementGlobal int       `json:"avancementGlobal"`
	Count            CountMeta `json:"_count"`
}

// KPIResponse — compteurs agrégés sur tous les chantiers du tenant.
type KPIResponse struct {
	Total         int64 `json:"total"`
	Actifs        int64 `json:"actifs"`
	EnPreparation int64 `json:"enPreparation"`
	Termines      int64 `json:"termines"`
}

// ChantierListResponse — réponse GET /api/v1/chantiers.
type ChantierListResponse struct {
	Chantiers []ChantierWithMeta `json:"chantiers"`
	KPI       KPIResponse        `json:"kpi"`
}
