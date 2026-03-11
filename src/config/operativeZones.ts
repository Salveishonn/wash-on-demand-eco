/**
 * Washero operative zones configuration
 * Only addresses within these zones are allowed for public bookings
 */

// Normalized list of operative localities/neighborhoods (lowercase for matching)
export const OPERATIVE_ZONES: string[] = [
  // C.A.B.A.
  "caba",
  "capital federal",
  "ciudad autónoma de buenos aires",
  "ciudad de buenos aires",
  "buenos aires",
  // C.A.B.A. neighborhoods (comunas)
  "palermo", "belgrano", "nuñez", "colegiales", "recoleta", "retiro",
  "san telmo", "la boca", "barracas", "constitución", "monserrat", "san nicolás",
  "puerto madero", "almagro", "balvanera", "caballito", "flores", "floresta",
  "villa crespo", "villa urquiza", "villa devoto", "villa del parque",
  "villa luro", "liniers", "mataderos", "villa lugano", "villa soldati",
  "parque patricios", "boedo", "san cristóbal", "once", "abasto",
  "chacarita", "villa ortúzar", "coghlan", "saavedra", "versalles",
  "monte castro", "vélez sársfield", "villa real", "villa pueyrredón",
  "agronomía", "parque chas", "paternal", "villa general mitre",
  "parque avellaneda", "nueva pompeya", "parque chacabuco", "villa riachuelo",
  // Zona Norte
  "vicente lópez", "vicente lopez",
  "olivos",
  "la lucila",
  "florida",
  "munro",
  "san isidro",
  "acassuso",
  "martínez", "martinez",
  "beccar",
  "boulogne",
  "tigre",
  "nordelta",
  "don torcuato",
  "general pacheco",
  "benavídez", "benavidez",
  "ingeniero maschwitz", "ing. maschwitz",
  "garín", "garin",
  "escobar",
];

// Partidos that cover our operative area
const OPERATIVE_PARTIDOS = [
  "vicente lópez", "vicente lopez",
  "san isidro",
  "san fernando",
  "tigre",
  "escobar",
];

/**
 * Extract zone/barrio info from Google Places address components
 * Returns normalized zone name or null
 */
export interface ZoneDetectionResult {
  zone: string | null;          // Normalized zone name for barrio benefit grouping
  locality: string | null;      // City/locality
  sublocality: string | null;   // Neighborhood
  partido: string | null;       // Administrative area level 2 (partido)
  province: string | null;      // Province
  isInOperativeArea: boolean;   // Whether address is within coverage
  rawComponents?: Record<string, string>; // For debugging
}

/**
 * Detect zone from Google Places formatted address string
 * Uses substring matching against known operative zones
 */
export function detectZoneFromAddress(address: string): ZoneDetectionResult {
  if (!address) {
    return { zone: null, locality: null, sublocality: null, partido: null, province: null, isInOperativeArea: false };
  }

  const lower = address.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Check for CABA indicators
  const isCaba = 
    lower.includes("caba") ||
    lower.includes("capital federal") ||
    lower.includes("ciudad autonoma de buenos aires") ||
    lower.includes("ciudad de buenos aires") ||
    lower.includes("c1") || // CABA postal codes start with C1
    /\bc\d{4}\b/.test(lower); // C + 4 digits pattern

  // Try to match a specific zone
  let matchedZone: string | null = null;
  let matchedPartido: string | null = null;

  // Check partidos first (they cover broader areas)
  for (const partido of OPERATIVE_PARTIDOS) {
    const normalized = partido.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lower.includes(normalized)) {
      matchedPartido = partido;
      break;
    }
  }

  // Check specific localities/neighborhoods for best match
  // Sort by length descending to match longer names first (e.g., "ingeniero maschwitz" before "martinez")
  const sortedZones = [...OPERATIVE_ZONES].sort((a, b) => b.length - a.length);
  for (const zone of sortedZones) {
    const normalized = zone.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lower.includes(normalized)) {
      matchedZone = zone;
      break;
    }
  }

  const isInOperativeArea = isCaba || !!matchedZone || !!matchedPartido;

  // Determine the grouping zone for barrio benefit
  let groupZone: string | null = null;
  if (matchedZone) {
    // Normalize to canonical name
    groupZone = normalizeZoneName(matchedZone);
  } else if (isCaba) {
    groupZone = "CABA";
  } else if (matchedPartido) {
    groupZone = normalizeZoneName(matchedPartido);
  }

  return {
    zone: groupZone,
    locality: isCaba ? "CABA" : matchedZone || matchedPartido || null,
    sublocality: matchedZone || null,
    partido: matchedPartido || null,
    province: lower.includes("buenos aires") ? "Buenos Aires" : null,
    isInOperativeArea,
  };
}

/**
 * Normalize zone name for consistent grouping
 */
export function normalizeZoneName(name: string): string {
  const map: Record<string, string> = {
    "vicente lópez": "Vicente López",
    "vicente lopez": "Vicente López",
    "olivos": "Olivos",
    "la lucila": "La Lucila",
    "florida": "Florida",
    "munro": "Munro",
    "san isidro": "San Isidro",
    "acassuso": "Acassuso",
    "martínez": "Martínez",
    "martinez": "Martínez",
    "beccar": "Beccar",
    "boulogne": "Boulogne",
    "tigre": "Tigre",
    "nordelta": "Nordelta",
    "don torcuato": "Don Torcuato",
    "general pacheco": "General Pacheco",
    "benavídez": "Benavídez",
    "benavidez": "Benavídez",
    "ingeniero maschwitz": "Ingeniero Maschwitz",
    "ing. maschwitz": "Ingeniero Maschwitz",
    "garín": "Garín",
    "garin": "Garín",
    "escobar": "Escobar",
    "san fernando": "San Fernando",
    // CABA neighborhoods
    "caba": "CABA",
    "capital federal": "CABA",
    "ciudad autónoma de buenos aires": "CABA",
    "ciudad de buenos aires": "CABA",
    "buenos aires": "Buenos Aires",
    "palermo": "Palermo",
    "belgrano": "Belgrano",
    "nuñez": "Núñez",
    "recoleta": "Recoleta",
    "caballito": "Caballito",
    "villa urquiza": "Villa Urquiza",
    "villa devoto": "Villa Devoto",
    "colegiales": "Colegiales",
    "villa crespo": "Villa Crespo",
    "chacarita": "Chacarita",
    "saavedra": "Saavedra",
    "flores": "Flores",
  };
  const lower = name.toLowerCase();
  return map[lower] || name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const trimmed = email.trim().toLowerCase();
  // Standard email regex with TLD requirement (min 2 chars)
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(trimmed);
}

/**
 * Validate Argentina phone number
 */
export function isValidArgentinaPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/[^\d]/g, "");
  // Min 8 digits (local), max 13 digits (+549XXXXXXXXXX)
  return digits.length >= 8 && digits.length <= 13;
}
