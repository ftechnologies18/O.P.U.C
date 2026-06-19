#!/bin/bash
# ══════════════════════════════════════════════════════════════════
# O.P.U.C — Setup GCP infrastructure (one-time)
# ══════════════════════════════════════════════════════════════════
# Ce script configure :
#   1. Active les APIs nécessaires (Cloud Run, Artifact Registry, Secret Manager)
#   2. Crée le repository Artifact Registry "opuc-api" (europe-west1)
#   3. Crée les secrets Secret Manager (DB, JWT, R2)
#   4. Crée le service account runtime "opuc-api-runtime"
#   5. Deploy le service Cloud Run
#
# Prérequis :
#   - gcloud CLI installé et authentifié (gcloud auth login)
#   - Variables d'env configurées (voir plus bas)
#
# Usage :
#   export GCP_PROJECT_ID="project-2cb691e5-ed64-4991-9e8"
#   export NEON_DATABASE_URL="postgresql://neondb_owner:...@...neon.tech/neondb?sslmode=require"
#   export NEON_MIGRATIONS_URL="postgresql://neondb_owner:...@...neon.tech/neondb?sslmode=require"
#   export JWT_SECRET="opuc-super-secret-change-in-production-2025"
#   export R2_API_TOKEN="cfat_[YOUR_TOKEN]"
#   export R2_ACCOUNT_ID="[YOUR_CF_ACCOUNT_ID]"
#   export R2_BUCKET="opuc-files"
#   bash backend/deployments/gcp/setup.sh
# ══════════════════════════════════════════════════════════════════

set -euo pipefail

REGION="europe-west1"
ARTIFACT_REPO="opuc-api"
SERVICE_NAME="opuc-api"
RUNTIME_SA="opuc-api-runtime"

: "${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
: "${NEON_DATABASE_URL:?NEON_DATABASE_URL is required}"
: "${NEON_MIGRATIONS_URL:?NEON_MIGRATIONS_URL is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"
: "${R2_API_TOKEN:?R2_API_TOKEN is required}"
: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID is required}"
: "${R2_BUCKET:?R2_BUCKET is required}"

echo "══════════════════════════════════════════════════════════════"
echo "  O.P.U.C — GCP Infrastructure Setup"
echo "  Project: $GCP_PROJECT_ID | Region: $REGION"
echo "══════════════════════════════════════════════════════════════"

echo "── 1. Activation des APIs ──"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --project "$GCP_PROJECT_ID"
echo "  ✅ APIs activées"

echo "── 2. Artifact Registry ──"
if gcloud artifacts repositories describe "$ARTIFACT_REPO" --location "$REGION" --project "$GCP_PROJECT_ID" &>/dev/null; then
  echo "  ℹ️  Repository existe déjà"
else
  gcloud artifacts repositories create "$ARTIFACT_REPO" --repository-format docker --location "$REGION" --project "$GCP_PROJECT_ID"
  echo "  ✅ Repository créé"
fi

echo "── 3. Secrets Manager ──"
create_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" --project "$GCP_PROJECT_ID" &>/dev/null; then
    echo "  ℹ️  $name existe déjà"
  else
    echo -n "$value" | gcloud secrets create "$name" --data-file=- --replication-policy automatic --project "$GCP_PROJECT_ID"
    echo "  ✅ $name créé"
  fi
}
create_secret "NEON_DATABASE_URL" "$NEON_DATABASE_URL"
create_secret "NEON_MIGRATIONS_URL" "$NEON_MIGRATIONS_URL"
create_secret "JWT_SECRET" "$JWT_SECRET"
create_secret "R2_API_TOKEN" "$R2_API_TOKEN"
create_secret "R2_ACCOUNT_ID" "$R2_ACCOUNT_ID"
create_secret "R2_BUCKET" "$R2_BUCKET"

echo "── 4. Service Account runtime ──"
if gcloud iam service-accounts describe "$RUNTIME_SA@$GCP_PROJECT_ID.iam.gserviceaccount.com" --project "$GCP_PROJECT_ID" &>/dev/null; then
  echo "  ℹ️  SA existe déjà"
else
  gcloud iam service-accounts create "$RUNTIME_SA" --display-name "O.P.U.C API Runtime" --project "$GCP_PROJECT_ID"
  echo "  ✅ SA créé"
fi

echo "── 5. Build & Deploy Cloud Run ──"
IMAGE="$REGION-docker.pkg.dev/$GCP_PROJECT_ID/$ARTIFACT_REPO/$SERVICE_NAME:latest"
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet
docker build -f backend/deployments/docker/Dockerfile -t "$IMAGE" backend/
docker push "$IMAGE"

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" --region "$REGION" --platform managed --port 8080 \
  --memory 512Mi --cpu 1 --min-instances 0 --max-instances 10 --timeout 60 --concurrency 80 \
  --allow-unauthenticated --service-account "$RUNTIME_SA@$GCP_PROJECT_ID.iam.gserviceaccount.com" \
  --set-env-vars "APP_ENV=production,LOG_LEVEL=info,PORT=8080,FRONTEND_URL=https://opuc.vercel.app" \
  --set-secrets "DATABASE_URL=NEON_DATABASE_URL:latest,MIGRATIONS_URL=NEON_MIGRATIONS_URL:latest,JWT_SECRET=JWT_SECRET:latest,R2_API_TOKEN=R2_API_TOKEN:latest,R2_ACCOUNT_ID=R2_ACCOUNT_ID:latest,R2_BUCKET=R2_BUCKET:latest" \
  --project "$GCP_PROJECT_ID"

URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)' --project "$GCP_PROJECT_ID")
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  ✅ DÉPLOIEMENT TERMINÉ"
echo "  URL: $URL"
echo "══════════════════════════════════════════════════════════════"
