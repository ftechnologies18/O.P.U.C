// Package dto — storage DTOs pour upload/download.
package dto

// UploadResponse — réponse POST /api/v1/upload.
type UploadResponse struct {
	Key          string `json:"key"`          // clé R2 (ex: "photos/2026-06-19/abc123.jpg")
	URL          string `json:"url"`          // URL proxy backend (ex: "/api/v1/files/photos/...")
	Size         int64  `json:"size"`         // taille en bytes
	ContentType  string `json:"contentType"`  // MIME type
	ETag         string `json:"etag"`         // checksum
	StorageClass string `json:"storageClass"` // Standard
}
