// Package handler — storage_handler.go
// Endpoints pour upload/download de fichiers vers/depuis Cloudflare R2.
//
// Routes :
//   POST /api/v1/upload       — multipart upload (field "file"), returns R2 key + URL
//   GET  /api/v1/files/{key}  — download/stream from R2 (key = chi param, may contain /)
//
// Sécurité :
//   - Authentification requise (middleware.Auth)
//   - Type de fichier vérifié (IsAllowedContent)
//   - Taille max 50 MB
package handler

import (
        "fmt"
        "io"
        "log/slog"
        "net/http"
        "strings"

        "github.com/go-chi/chi/v5"

        "opuc/internal/delivery/http/dto"
        "opuc/internal/infrastructure/storage"
)

// StorageHandler — handler pour upload/download R2.
type StorageHandler struct {
        r2  *storage.R2Client
        log *slog.Logger
}

// NewStorageHandler constructeur.
func NewStorageHandler(r2 *storage.R2Client, log *slog.Logger) *StorageHandler {
        return &StorageHandler{r2: r2, log: log}
}

// Upload — POST /api/v1/upload
// Multipart form, field "file". Optional field "prefix" (default: "uploads").
// Returns R2 key + proxy URL.
func (h *StorageHandler) Upload(w http.ResponseWriter, r *http.Request) {
        // Limite 50 MB
        r.Body = http.MaxBytesReader(w, r.Body, storage.MaxUploadSize)
        if err := r.ParseMultipartForm(storage.MaxUploadSize); err != nil {
                WriteError(w, http.StatusBadRequest, "file too large or invalid form (max 50MB)")
                return
        }

        file, header, err := r.FormFile("file")
        if err != nil {
                WriteError(w, http.StatusBadRequest, "missing 'file' field in multipart form")
                return
        }
        defer file.Close()

        // Lire le contenu
        data, err := io.ReadAll(file)
        if err != nil {
                WriteError(w, http.StatusInternalServerError, "failed to read file")
                return
        }

        // Détecter content-type
        contentType := storage.DetectContentType(data)
        if !storage.IsAllowedContent(contentType) {
                WriteError(w, http.StatusBadRequest, "file type not allowed: "+contentType)
                return
        }

        // Prefix (folder) — default "uploads", peut être "photos", "documents", "rapports"
        prefix := r.FormValue("prefix")
        if prefix == "" {
                prefix = "uploads"
        }

        // Générer clé R2
        ext := ""
        if idx := strings.LastIndex(header.Filename, "."); idx >= 0 {
                ext = header.Filename[idx:]
        }
        key := storage.GenerateKey(prefix, ext)

        // Upload vers R2
        result, err := h.r2.Upload(r.Context(), key, contentType, data)
        if err != nil {
                h.log.Error("upload to R2 failed", "err", err, "key", key, "filename", header.Filename)
                WriteError(w, http.StatusInternalServerError, "upload failed")
                return
        }

        h.log.Info("file uploaded to R2",
                "key", key,
                "size", result.Size,
                "contentType", contentType,
                "originalName", header.Filename,
        )

        WriteJSON(w, http.StatusCreated, dto.UploadResponse{
                Key:          result.Key,
                URL:          result.URL,
                Size:         result.Size,
                ContentType:  contentType,
                ETag:         result.ETag,
                StorageClass: result.StorageClass,
        })
}

// Download — GET /api/v1/files/{key}
// key peut contenir des / (ex: "photos/2026-06-19/abc.jpg")
// Utilise chi.URLParam avec "*" pour capturer le path complet.
func (h *StorageHandler) Download(w http.ResponseWriter, r *http.Request) {
        // chi.URLParam(r, "*") capture le reste du path après /files/
        key := chi.URLParam(r, "*")
        if key == "" {
                // Fallback : essayer "key"
                key = chi.URLParam(r, "key")
        }
        if key == "" {
                WriteError(w, http.StatusBadRequest, "missing file key")
                return
        }

        // Nettoyer la clé (empêcher path traversal)
        if strings.Contains(key, "..") {
                WriteError(w, http.StatusBadRequest, "invalid key")
                return
        }

        data, contentType, err := h.r2.Download(r.Context(), key)
        if err != nil {
                h.log.Error("download from R2 failed", "err", err, "key", key)
                WriteError(w, http.StatusNotFound, "file not found")
                return
        }

        // Stream vers le client
        w.Header().Set("Content-Type", contentType)
        w.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))
        // Cache 1h pour les fichiers statiques (images surtout)
        w.Header().Set("Cache-Control", "private, max-age=3600")
        w.WriteHeader(http.StatusOK)
        _, _ = w.Write(data)
}

// DeleteFile — DELETE /api/v1/files/{key}
// Supprime un fichier de R2.
func (h *StorageHandler) DeleteFile(w http.ResponseWriter, r *http.Request) {
        key := chi.URLParam(r, "*")
        if key == "" {
                key = chi.URLParam(r, "key")
        }
        if key == "" {
                WriteError(w, http.StatusBadRequest, "missing file key")
                return
        }

        if err := h.r2.Delete(r.Context(), key); err != nil {
                h.log.Error("delete from R2 failed", "err", err, "key", key)
                WriteError(w, http.StatusInternalServerError, "delete failed")
                return
        }

        h.log.Info("file deleted from R2", "key", key)
        WriteJSON(w, http.StatusOK, map[string]any{"ok": true, "key": key})
}
