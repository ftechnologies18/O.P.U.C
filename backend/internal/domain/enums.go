package domain

// Role représente les 4 rôles RBAC d'O.P.U.C.
// Hiérarchie : SUPER_ADMIN > GERANT > CHEF_PROJET > SOUS_TRAITANT
type Role string

const (
	RoleSuperAdmin    Role = "SUPER_ADMIN"
	RoleGerant        Role = "GERANT"
	RoleChefProjet    Role = "CHEF_PROJET"
	RoleSousTraitant  Role = "SOUS_TRAITANT"
)

// IsAtLeast retourne true si le rôle courant a un niveau >= au rôle requis.
// SUPER_ADMIN voit tout, GERANT gère son entreprise, etc.
func (r Role) IsAtLeast(required Role) bool {
	level := map[Role]int{
		RoleSousTraitant: 1,
		RoleChefProjet:   2,
		RoleGerant:       3,
		RoleSuperAdmin:   4,
	}
	return level[r] >= level[required]
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
