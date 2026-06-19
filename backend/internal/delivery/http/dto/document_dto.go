// Package dto — document_dto.go
// DTOs pour les routes /api/v1/documents/*, /api/v1/photos/*, /api/v1/rapports/*
// (Phase 5, peripheral endpoints).
//
// DocumentChantier : document attaché à un chantier. Champs : titre, type,
// fichierNom, fichierUrl, fichierTaille, fichierType, chantierId, phaseId?,
// description?, dateDocument?. auteurId est forcé à auth.UserID côté usecase.
//
// Photo : photo de chantier. Champs : chantierId, phaseId?, tacheId?, rapportId?,
// datePrise, legende?, categorie, urlOriginale, urlThumbnail?. priseParId = auth.UserID.
//
// RapportJournalier : rapport quotidien. Champs : chantierId, dateRapport, meteo?,
// effectifPresent?, travauxRealises, incidents?, observations?. auteurId = auth.UserID.
package dto

import (
	"opuc/internal/domain/model"
)

// ── DocumentChantier ──────────────────────────────────────────

// CreateDocumentRequest — payload POST /api/v1/documents
type CreateDocumentRequest struct {
	Titre         string  `json:"titre"`
	Type          string  `json:"type"`
	Categorie     *string `json:"categorie,omitempty"`
	NumeroRef     *string `json:"numeroReference,omitempty"`
	FichierNom    string  `json:"fichierNom"`
	FichierUrl    string  `json:"fichierUrl"`
	FichierTaille int     `json:"fichierTaille"`
	FichierType   *string `json:"fichierType,omitempty"`
	Description   *string `json:"description,omitempty"`
	ChantierID    string  `json:"chantierId"`
	PhaseID       *string `json:"phaseId,omitempty"`
	DateDocument  *string `json:"dateDocument,omitempty"` // ISO 8601
}

// UpdateDocumentRequest — payload PUT /api/v1/documents/{id}
type UpdateDocumentRequest struct {
	Titre       *string `json:"titre,omitempty"`
	Type        *string `json:"type,omitempty"`
	Description *string `json:"description,omitempty"`
	Statut      *string `json:"statut,omitempty"`
	Tags        *string `json:"tags,omitempty"`
}

// DocumentListResponse — réponse GET /api/v1/documents
type DocumentListResponse struct {
	Data     []model.DocumentChantier `json:"data"`
	Total    int64                    `json:"total"`
	Page     int                      `json:"page"`
	PageSize int                      `json:"pageSize"`
}

// ── Photo ──────────────────────────────────────────────────────

// CreatePhotoRequest — payload POST /api/v1/photos
type CreatePhotoRequest struct {
	ChantierID   string  `json:"chantierId"`
	PhaseID      *string `json:"phaseId,omitempty"`
	TacheID      *string `json:"tacheId,omitempty"`
	RapportID    *string `json:"rapportId,omitempty"`
	DatePrise    string  `json:"datePrise"` // ISO 8601
	Legende      *string `json:"legende,omitempty"`
	Categorie    string  `json:"categorie"`
	UrlOriginale string  `json:"urlOriginale"`
	UrlThumbnail *string `json:"urlThumbnail,omitempty"`
}

// PhotoListResponse — réponse GET /api/v1/photos
type PhotoListResponse struct {
	Data     []model.Photo `json:"data"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	PageSize int           `json:"pageSize"`
}

// ── RapportJournalier ─────────────────────────────────────────

// CreateRapportRequest — payload POST /api/v1/rapports
type CreateRapportRequest struct {
	ChantierID      string  `json:"chantierId"`
	DateRapport     string  `json:"dateRapport"` // ISO 8601
	Meteo           *string `json:"meteo,omitempty"`
	EffectifPresent *int    `json:"effectifPresent,omitempty"`
	TravauxRealises string  `json:"travauxRealises"`
	Incidents       *string `json:"incidents,omitempty"`
	Observations    *string `json:"observations,omitempty"`
}

// UpdateRapportRequest — payload PUT /api/v1/rapports/{id}
type UpdateRapportRequest struct {
	Meteo           *string `json:"meteo,omitempty"`
	EffectifPresent *int    `json:"effectifPresent,omitempty"`
	TravauxRealises *string `json:"travauxRealises,omitempty"`
	Incidents       *string `json:"incidents,omitempty"`
	Observations    *string `json:"observations,omitempty"`
}

// RapportListResponse — réponse GET /api/v1/rapports
type RapportListResponse struct {
	Data     []model.RapportJournalier `json:"data"`
	Total    int64                     `json:"total"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"pageSize"`
}
