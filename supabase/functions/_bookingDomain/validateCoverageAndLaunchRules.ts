// Operative zones (server-side enforcement)
const OPERATIVE_ZONES_LOWER = [
  "caba", "capital federal", "ciudad autónoma de buenos aires", "ciudad de buenos aires",
  "palermo", "belgrano", "nuñez", "colegiales", "recoleta", "retiro",
  "san telmo", "la boca", "barracas", "caballito", "flores",
  "villa crespo", "villa urquiza", "villa devoto", "chacarita", "saavedra",
  "vicente lópez", "vicente lopez", "olivos", "la lucila", "florida", "munro",
  "san isidro", "acassuso", "martínez", "martinez", "beccar", "boulogne",
  "tigre", "nordelta", "don torcuato", "general pacheco",
  "benavídez", "benavidez", "ingeniero maschwitz", "ing. maschwitz",
  "garín", "garin", "escobar", "san fernando",
];

export function isInOperativeArea(address: string): boolean {
  if (!address) return false;
  const lower = address.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\bc\d{4}\b/.test(lower)) return true;
  return OPERATIVE_ZONES_LOWER.some(zone => {
    const normalized = zone.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return lower.includes(normalized);
  });
}

export interface CoverageResult {
  allowed: boolean;
  reason?: string;
}

export function validateCoverage(address: string): CoverageResult {
  if (!isInOperativeArea(address)) {
    return {
      allowed: false,
      reason: "Por ahora Washero está disponible en C.A.B.A. y Zona Norte (Vicente López a Escobar).",
    };
  }
  return { allowed: true };
}

export function validateLaunchDate(bookingDate: string, launchDate: string): CoverageResult {
  if (bookingDate < launchDate) {
    return {
      allowed: false,
      reason: `Las reservas están disponibles a partir del ${launchDate.split('-').reverse().join('/')}.`,
    };
  }
  return { allowed: true };
}
