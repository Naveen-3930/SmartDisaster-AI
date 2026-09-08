// riskEngine.js
function clamp(v, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

function computeRisk({ rainfall, water_level, temperature, humidity, smoke, historicalRisk = 30 }) {
  // Normalize rainfall (mm) onto a 0-100 scale. 200mm+ is treated as saturated/severe.
  const rainfallPct = clamp(rainfall / 2);
  // Dry air drives fire risk up, not humid air — use dryness (inverse humidity) for fire.
  const dryness = clamp(100 - humidity);

  const flood = clamp(rainfallPct * 0.45 + water_level * 0.40 + historicalRisk * 0.15);
  const fire = clamp(dryness * 0.35 + smoke * 0.45 + temperature * 0.20);
  const heat = clamp(temperature * 0.55 + humidity * 0.25 + historicalRisk * 0.20);

  const scores = { FLOOD: flood, FIRE: fire, HEAT: heat };
  const primaryHazard = Object.keys(scores).reduce((a, b) => (scores[a] > scores[b] ? a : b));
  const overall = scores[primaryHazard];

  let level;
  if (overall <= 20) level = 'VERY_LOW';
  else if (overall <= 40) level = 'LOW';
  else if (overall <= 60) level = 'MEDIUM';
  else if (overall <= 80) level = 'HIGH';
  else level = 'CRITICAL';

  const actions = {
    FLOOD: 'Move to higher ground and avoid flooded roads.',
    FIRE: 'Avoid the affected area and stay away from dry vegetation.',
    HEAT: 'Stay indoors, remain hydrated, and avoid direct sun.',
  };

  return {
    flood_score: +flood.toFixed(1),
    fire_score: +fire.toFixed(1),
    heat_score: +heat.toFixed(1),
    overall_score: +overall.toFixed(1),
    risk_level: level,
    primary_hazard: primaryHazard,
    recommended_action: actions[primaryHazard],
  };
}

module.exports = { computeRisk };
