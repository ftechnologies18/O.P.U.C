## 📝 Description

<!-- Décrire clairement ce que fait cette PR -->

## 🔄 Type de changement

- [ ] 🐛 Bug fix (correction non-breaking)
- [ ] ✨ Feature (nouvelle fonctionnalité)
- [ ] 💥 Breaking change (modif qui casse la compat)
- [ ] 📚 Documentation
- [ ] 🔧 Refactor (pas de changement fonctionnel)
- [ ] ⚡ Performance
- [ ] 🔒 Sécurité

## ✅ Checklist

- [ ] `go vet ./...` passe sans warning (backend)
- [ ] `go build ./...` compile (backend)
- [ ] `bun run lint` passe (frontend)
- [ ] Tests ajoutés/modifiés si nécessaire
- [ ] Pas de secrets/tokens dans le code
- [ ] RLS respecté (WithTenant sur toutes requêtes tenant-scoped)
- [ ] RBAC respecté (RequireRole sur endpoints sensibles)
- [ ] Documentation mise à jour (CHANGELOG.md, docs/ si besoin)

## 🧪 Tests effectués

<!-- Décrire les tests effectués (curl, Agent Browser, etc.) -->

## 📸 Screenshots (si UI)

<!-- Pour les changements frontend -->

## 🔗 Issues liées

<!-- Closes #123 -->
