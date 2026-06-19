// Package storage — client Cloudflare R2 via API REST.
//
// Utilise l'API Cloudflare (token cfat_) pour upload/download directement,
// SANS avoir besoin des credentials S3 (Access Key + Secret).
//
// Endpoints Cloudflare utilisés :
//   PUT  /accounts/{account_id}/r2/buckets/{bucket}/objects/{key}
//   GET  /accounts/{account_id}/r2/buckets/{bucket}/objects/{key}
//   DELETE /accounts/{account_id}/r2/buckets/{bucket}/objects/{key}
//
// Avantages :
//   - Pas besoin du Secret Access Key S3 (sécurité accrue)
//   - Token cfat_ scoped à R2 uniquement
//   - Compatible avec les buckets privés (pas d'exposition publique)
package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// R2Client — client pour Cloudflare R2 via API REST.
type R2Client struct {
	apiToken   string
	accountID  string
	bucket     string
	httpClient *http.Client
	baseURL    string
}

// NewR2Client crée un client R2.
// apiToken : token Cloudflare (cfat_...)
// accountID : ID du compte Cloudflare
// bucket : nom du bucket R2
func NewR2Client(apiToken, accountID, bucket string) *R2Client {
	return &R2Client{
		apiToken:  apiToken,
		accountID: accountID,
		bucket:    bucket,
		httpClient: &http.Client{
			Timeout: 60 * time.Second, // uploads peuvent être longs
		},
		baseURL: "https://api.cloudflare.com/client/v4",
	}
}

// UploadResult — résultat d'un upload.
type UploadResult struct {
	Key       string    `json:"key"`       // clé R2 (ex: "documents/uuid-plan.pdf")
	Size      int64     `json:"size"`      // taille en bytes
	ETag      string    `json:"etag"`      // checksum
	URL       string    `json:"url"`       // URL de téléchargement via proxy backend
	Uploaded  time.Time `json:"uploaded"`
	StorageClass string  `json:"storageClass"`
}

// Upload — upload un fichier vers R2.
// key : clé de l'objet (ex: "photos/abc123.jpg")
// contentType : MIME type (ex: "image/jpeg")
// data : contenu binaire
func (c *R2Client) Upload(ctx context.Context, key, contentType string, data []byte) (*UploadResult, error) {
	url := fmt.Sprintf("%s/accounts/%s/r2/buckets/%s/objects/%s",
		c.baseURL, c.accountID, c.bucket, key)

	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", contentType)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("upload request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("upload failed (HTTP %d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	// La réponse Cloudflare est JSON : {"success":true,"result":{"key":"...","size":"23","etag":"...","uploaded":"..."}}
	// On parse manuellement (évite dépendance JSON supplémentaire)
	result := &UploadResult{
		Key:          key,
		Size:         int64(len(data)),
		URL:          fmt.Sprintf("/api/v1/files/%s", key),
		Uploaded:     time.Now().UTC(),
		StorageClass: "Standard",
	}
	// Extract etag from response (simplifié)
	if idx := strings.Index(string(body), `"etag":"`); idx >= 0 {
		start := idx + 8
		end := strings.Index(string(body)[start:], `"`)
		if end > 0 {
			result.ETag = string(body)[start : start+end]
		}
	}

	return result, nil
}

// Download — télécharge un fichier depuis R2.
// Retourne le contenu binaire + content-type.
func (c *R2Client) Download(ctx context.Context, key string) ([]byte, string, error) {
	url := fmt.Sprintf("%s/accounts/%s/r2/buckets/%s/objects/%s",
		c.baseURL, c.accountID, c.bucket, key)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("download request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("download failed (HTTP %d)", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("read body: %w", err)
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	return data, contentType, nil
}

// Delete — supprime un fichier de R2.
func (c *R2Client) Delete(ctx context.Context, key string) error {
	url := fmt.Sprintf("%s/accounts/%s/r2/buckets/%s/objects/%s",
		c.baseURL, c.accountID, c.bucket, key)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("delete request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("delete failed (HTTP %d)", resp.StatusCode)
	}

	return nil
}

// GenerateKey — génère une clé R2 unique et organisée.
// Format : {prefix}/{date}/{uuid}{ext}
// Ex : "photos/2026-06-19/abc123.jpg"
func GenerateKey(prefix, ext string) string {
	date := time.Now().UTC().Format("2006-01-02")
	id := generateUUID()
	if ext != "" && !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	return fmt.Sprintf("%s/%s/%s%s", prefix, date, id, ext)
}

// generateUUID génère un ID hex aléatoire (16 bytes = 32 chars).
func generateUUID() string {
	// Utilise crypto/rand via le package existant
	return randHex(16)
}

// DetectContentType détecte le MIME type depuis les premiers bytes.
func DetectContentType(data []byte) string {
	contentType := http.DetectContentType(data)
	return contentType
}

// IsImageContent — true si le content-type est une image.
func IsImageContent(contentType string) bool {
	return strings.HasPrefix(contentType, "image/")
}

// IsAllowedContent — vérifie que le type de fichier est autorisé.
// Sécurité : empêche l'upload de fichiers dangereux (ex: .exe, .sh).
var allowedContentPrefixes = []string{
	"image/",        // photos
	"application/pdf", // documents PDF
	"application/msword",
	"application/vnd.openxmlformats-officedocument", // .docx, .xlsx
	"text/plain",
	"application/zip",
}

func IsAllowedContent(contentType string) bool {
	for _, prefix := range allowedContentPrefixes {
		if strings.HasPrefix(contentType, prefix) {
			return true
		}
	}
	return false
}

// MaxUploadSize — taille max d'upload (50 MB).
const MaxUploadSize = 50 * 1024 * 1024
