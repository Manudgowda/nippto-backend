// Nippto Fare Calculator
// Based on Rapido/local auto pricing for Tumakuru/Sira area

const FARE_CONFIG = {
  bike: {
    base_fare: 20,        // Base fare in rupees
    per_km: 8,            // Per km rate
    per_minute: 1,        // Per minute waiting
    min_fare: 25,         // Minimum fare
    surge_multiplier: 1.0 // Default no surge
  },
  auto: {
    base_fare: 30,
    per_km: 12,
    per_minute: 1.5,
    min_fare: 40,
    surge_multiplier: 1.0
  }
};

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Calculate estimated duration (avg speed 25km/h in city)
const calculateDuration = (distanceKm) => {
  const avgSpeedKmH = 25;
  return Math.ceil((distanceKm / avgSpeedKmH) * 60); // in minutes
};

// Main fare calculation function
const calculateFare = (vehicle_type, pickup_lat, pickup_lng, drop_lat, drop_lng) => {
  const config = FARE_CONFIG[vehicle_type];

  if (!config) {
    throw new Error('Invalid vehicle type');
  }

  const distanceKm = calculateDistance(pickup_lat, pickup_lng, drop_lat, drop_lng);
  const durationMin = calculateDuration(distanceKm);

  let fare = config.base_fare + (distanceKm * config.per_km);
  fare = fare * config.surge_multiplier;
  fare = Math.max(fare, config.min_fare); // Apply minimum fare
  fare = Math.round(fare); // Round to nearest rupee

  return {
    distance_km: Math.round(distanceKm * 100) / 100,
    duration_min: durationMin,
    fare: fare,
    fare_breakdown: {
      base_fare: config.base_fare,
      distance_fare: Math.round(distanceKm * config.per_km),
      total: fare
    },
    vehicle_type,
    currency: 'INR'
  };
};

module.exports = { calculateFare, calculateDistance, calculateDuration };