import { NextResponse } from 'next/server';

const PLACES_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const FIELD_MASK = 'places.displayName,places.id,places.types';

// Journal prioritization: lower tier = higher priority when multiple places in locality.
// Tier 1 = Culture & Entertainment (the "brand"). Tier 2a = Specifics (cafe, restaurant). Tier 2b = Container (mall).
// Tier 2a beats Tier 2b so "Starbucks" wins over "Tampines Mall" when both nearby.
const TYPE_TIER: Record<string, number> = {
  // Tier 1 – Culture & Entertainment (high priority for travel)
  tourist_attraction: 1,
  museum: 1,
  art_gallery: 1,
  aquarium: 1,
  zoo: 1,
  amusement_park: 1,
  stadium: 1,
  movie_theater: 1,
  theme_park: 1,
  water_park: 1,
  historical_landmark: 1,
  cultural_landmark: 1,
  castle: 1,
  monument: 1,
  performing_arts_theater: 1,
  concert_hall: 1,
  // Tier 2a – Specifics (the actual venue; prefer over container)
  restaurant: 2,
  cafe: 2,
  bar: 2,
  night_club: 2,
  bakery: 2,
  market: 2,
  meal_takeaway: 2,
  meal_delivery: 2,
  food: 2,
  // Tier 2b – Shopping / container (use if no 2a; "mall" as subtitle when at a store)
  shopping_mall: 3,
  department_store: 3,
  supermarket: 3,
  store: 3,
  clothing_store: 3,
  furniture_store: 3,
  home_goods_store: 3,
  // Tier 3 – Nature & Outdoors
  park: 4,
  natural_feature: 4,
  national_park: 4,
  garden: 4,
  botanical_garden: 4,
  hiking_area: 4,
  scenic_spot: 4,
  beach: 4,
  lake: 4,
  river: 4,
  mountain_peak: 4,
  // Tier 4 – Lodging & Transport
  lodging: 5,
  airport: 5,
  transit_station: 5,
  gas_station: 5,
  parking: 5,
  resort_hotel: 5,
  hostel: 5,
  campground: 5,
  subway_station: 5,
  train_station: 5,
  bus_station: 5,
  // Tier 5 – Fallbacks
  establishment: 6,
  point_of_interest: 6,
  // Tier 6 – Only if nothing else
  neighborhood: 7,
  locality: 7,
};

const TYPE_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  bar: 'Bar',
  meal_takeaway: 'Takeaway',
  meal_delivery: 'Delivery',
  food: 'Food & drink',
  lodging: 'Hotel',
  tourist_attraction: 'Tourist attraction',
  museum: 'Museum',
  art_gallery: 'Art gallery',
  park: 'Park',
  natural_feature: 'Natural feature',
  shopping_mall: 'Shopping mall',
  department_store: 'Department store',
  supermarket: 'Supermarket',
  store: 'Store',
  clothing_store: 'Clothing store',
  furniture_store: 'Furniture store',
  home_goods_store: 'Home goods',
  gym: 'Gym',
  spa: 'Spa',
  stadium: 'Stadium',
  amusement_park: 'Amusement park',
  zoo: 'Zoo',
  aquarium: 'Aquarium',
  movie_theater: 'Cinema',
  night_club: 'Night club',
  airport: 'Airport',
  transit_station: 'Transit station',
  gas_station: 'Gas station',
  parking: 'Parking',
  place_of_worship: 'Place of worship',
  school: 'School',
  university: 'University',
  hospital: 'Hospital',
  pharmacy: 'Pharmacy',
  establishment: 'Establishment',
  point_of_interest: 'Point of interest',
  neighborhood: 'Neighborhood',
  locality: 'Locality',
  theme_park: 'Theme park',
  water_park: 'Water park',
  historical_landmark: 'Historic site',
  cultural_landmark: 'Cultural site',
  castle: 'Castle',
  monument: 'Monument',
  performing_arts_theater: 'Theater',
  concert_hall: 'Concert hall',
  bakery: 'Bakery',
  market: 'Market',
  national_park: 'National park',
  garden: 'Garden',
  botanical_garden: 'Botanical garden',
  hiking_area: 'Hiking area',
  scenic_spot: 'Scenic spot',
  beach: 'Beach',
  lake: 'Lake',
  river: 'River',
  mountain_peak: 'Mountain',
  resort_hotel: 'Resort',
  hostel: 'Hostel',
  campground: 'Campground',
  subway_station: 'Subway',
  train_station: 'Train station',
  bus_station: 'Bus station',
};

function getBestTier(types: string[] | undefined): number {
  if (!types?.length) return 999;
  let best = 999;
  for (const t of types) {
    const tier = TYPE_TIER[t];
    if (tier !== undefined && tier < best) best = tier;
  }
  return best;
}

function toPlaceTypeLabel(types: string[] | undefined): string | null {
  if (!types?.length) return null;
  for (const t of types) {
    const label = TYPE_LABELS[t];
    if (label) return label;
  }
  const fallback = types[0];
  if (!fallback) return null;
  return fallback.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickBestPlace(
  places: Array<{ displayName?: { text?: string }; id?: string; types?: string[] }>
): (typeof places)[0] | undefined {
  if (!places?.length) return undefined;
  let best = places[0];
  let bestTier = getBestTier(best.types);
  for (let i = 1; i < places.length; i++) {
    const p = places[i];
    const tier = getBestTier(p.types);
    if (tier < bestTier) {
      best = p;
      bestTier = tier;
    }
  }
  return best;
}

export type NearbyPlace = {
  name: string;
  placeId: string | null;
  placeType: string | null;
};

export async function POST(request: Request) {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      {
        error: 'Google Maps API key not configured',
        hint: 'Add GOOGLE_MAPS_API_KEY to .env.local (see .env.example), then restart the dev server (npm run dev).',
      },
      { status: 503 }
    );
  }

  let body: { latitude: number; longitude: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { latitude, longitude } = body;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    return NextResponse.json(
      { error: 'latitude and longitude (numbers) required' },
      { status: 400 }
    );
  }

  const res = await fetch(PLACES_NEARBY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: 100,
        },
      },
      maxResultCount: 10,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let message = errText;
    try {
      const errJson = JSON.parse(errText) as { error?: { message?: string; status?: string } };
      message = errJson.error?.message ?? errText;
    } catch {
      // use raw text
    }
    return NextResponse.json(
      {
        error: 'Places API error',
        message,
        status: res.status,
      },
      { status: res.status >= 500 ? 502 : 400 }
    );
  }

  const data = (await res.json()) as {
    places?: Array<{
      displayName?: { text?: string };
      id?: string;
      types?: string[];
    }>;
  };
  const place = pickBestPlace(data.places ?? []);
  const name = place?.displayName?.text?.trim();
  const placeId = place?.id?.trim() ?? null;
  const placeType = toPlaceTypeLabel(place?.types) ?? null;

  if (!name) {
    return NextResponse.json({ name: null, placeId: null, placeType: null });
  }

  return NextResponse.json({
    name,
    placeId,
    placeType,
  } as NearbyPlace);
}
