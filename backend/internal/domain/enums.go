package domain

// Role représente les 4 rôles RBAC d'O.P.U.C.
// Hiérarchie : SUPER_ADMIN > GERANT > CHEF_PROJET > EMPLOYE
//
// Note (Phase 1) : le rôle EMPLOYE (anciennement SOUS_TRAITANT) désigne un
// utilisateur INTERNE à l'entreprise (compte de connexion, RLS-filtered sur
// l'entrepriseId). À ne pas confondre avec l'entité model.SousTraitant qui
// est une fiche B2B externe (entreprise/particulier/fournisseur sans compte).
type Role string

const (
        RoleSuperAdmin Role = "SUPER_ADMIN"
        RoleGerant     Role = "GERANT"
        RoleChefProjet Role = "CHEF_PROJET"
        RoleEmploye    Role = "EMPLOYE"
        // RoleSousTraitant — DEPRECATED alias pour compatibilité le temps de la
        // migration des données. À retirer après migration complète.
        // Ne pas utiliser dans le nouveau code.
        RoleSousTraitant Role = "SOUS_TRAITANT"
)

// IsAtLeast retourne true si le rôle courant a un niveau >= au rôle requis.
// SUPER_ADMIN voit tout, GERANT gère son entreprise, etc.
func (r Role) IsAtLeast(required Role) bool {
        level := map[Role]int{
                RoleEmploye:       1,
                RoleChefProjet:    2,
                RoleGerant:        3,
                RoleSuperAdmin:    4,
                RoleSousTraitant:  1, // legacy = EMPLOYE
        }
        return level[r] >= level[required]
}

// Fonction représente la fonction BTP d'un EMPLOYE (découplée du rôle).
// Liste fixe prédéfinie alignée sur les domaines métier d'O.P.U.C.
// Un EMPLOYE a exactement une fonction (nullable pour les legacy users).
//
// La fonction permet d'affiner les droits via le système de délégation
// (Phase 2+) : par exemple, un CHARGE_LOGISTIQUE recevra automatiquement
// une délégation LOGISTIQUE/ECRITURE.
type Fonction string

const (
        FonctionChargeLogistique   Fonction = "CHARGE_LOGISTIQUE"
        FonctionChargeCarburant    Fonction = "CHARGE_CARBURANT"
        FonctionChargePlanning     Fonction = "CHARGE_PLANNING"
        FonctionChargeQualite      Fonction = "CHARGE_QUALITE"
        FonctionChargeDocumentation Fonction = "CHARGE_DOCUMENTATION"
        FonctionChargeCommercial   Fonction = "CHARGE_COMMERCIAL"
        FonctionChargeRH           Fonction = "CHARGE_RH"
        FonctionChefChantier       Fonction = "CHEF_CHANTIER"
)

// IsValidFonction vérifie qu'une fonction est dans la liste fixe prédéfinie.
func IsValidFonction(f Fonction) bool {
        switch f {
        case FonctionChargeLogistique, FonctionChargeCarburant, FonctionChargePlanning,
                FonctionChargeQualite, FonctionChargeDocumentation, FonctionChargeCommercial,
                FonctionChargeRH, FonctionChefChantier:
                return true
        }
        return false
}

// IsValidFonctionString vérifie qu'une string est une fonction valide (wrapper).
// Accepte la chaîne vide (fonction nullable pour legacy users).
func IsValidFonctionString(s string) bool {
        if s == "" {
                return true // nullable
        }
        return IsValidFonction(Fonction(s))
}

// StatutChantier — cycle de vie d'un chantier BTP
type StatutChantier string

const (
        StatutChantierPreparation StatutChantier = "EN_PREPARATION"
        StatutChantierEnCours     StatutChantier = "EN_COURS"
        StatutChantierPause       StatutChantier = "EN_PAUSE"
        StatutChantierTermine     StatutChantier = "TERMINE"
        StatutChantierReceptionne StatutChantier = "RECEPTIONNE"
)

// ModeCarburant — gestion carburant d'un chantier
type ModeCarburant string

const (
        ModeCarburantStockPhysique ModeCarburant = "STOCK_PHYSIQUE"
        ModeCarburantAchatDirect   ModeCarburant = "ACHAT_DIRECT"
)

// StatutEntreprise
type StatutEntreprise string

const (
        StatutEntrepriseActive    StatutEntreprise = "active"
        StatutEntrepriseSuspended StatutEntreprise = "suspended"
        StatutEntrepriseInactive  StatutEntreprise = "inactive"
)
