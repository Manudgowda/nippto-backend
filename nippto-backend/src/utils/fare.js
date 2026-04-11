/**
 * Fare Calculation Utility
 * Computes fare based on distance (using Haversine formula)
 */

const RATES = {
  bike: { base: 20, perKm: 12, perMin: 1.5 },
  auto: { base: 30, perKm: 16, perMin: 2.0 },
  cab:  { base: 50, perKm: 22, perMin: 2.5 },
};

const AVG_SPEED_KPH = 25; // Average city speed

/**
 * Haversine distance between two lat/lng coordinates (in km)
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Calculate fare estimate
 * Returns { fare, distance_km, duration_min, fare_details }
 */
const calculateFare = (pickupLat, pickupLng, dropLat, dropLng, vehicleType) => {
  const type = vehicleType?.toLowerCase() || 'bike';
  const rate = RATES[type] || RATES.bike;

  const distanceKm = Math.max(haversineDistance(pickupLat, pickupLng, dropLat, dropLng), 0.5);
  const durationMin = Math.round((distanceKm / AVG_SPEED_KPH) * 60);

  const distanceFare = distanceKm * rate.perKm;
  const timeFare = durationMin * rate.perMin;
  const fare = Math.round(rate.base + distanceFare + timeFare);

  return {
    fare,
    distance_km: Math.round(distanceKm * 10) / 10,
    duration_min: durationMin,
    fare_details: {
      base_fare: rate.base,
      distance_fare: Math.round(distanceFare),
      time_fare: Math.round(timeFare),
      distance_km: Math.round(distanceKm * 10) / 10,
      duration_min: durationMin,
      per_km_rate: rate.perKm,
    },
  };
};

module.exports = { calculateFare };
