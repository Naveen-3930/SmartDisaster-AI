// riskEngine.js
function clamp(v, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

function computeRisk({ rainfall, water_level, temperature, humidity, smoke, historicalRisk = 30 }) {
  // Normalize rainfall (mm) onto a 0-100 scale. 200mm+ is treated as saturated/severe.
  const rainfallPct = clamp(rainfall / 2);
  // Dry air drives fire risk up, not humid air — use dryness (inverse humidity) for fire.
  const dryness = clamp(100 - humidity);

  // --- FLOOD ---
  const floodRainfallContribution = rainfallPct * 0.45;
  const floodWaterContribution = water_level * 0.40;
  const floodHistoryContribution = historicalRisk * 0.15;
  const flood = clamp(floodRainfallContribution + floodWaterContribution + floodHistoryContribution);

  // --- FIRE ---
  const fireDrynessContribution = dryness * 0.35;
  const fireSmokeContribution = smoke * 0.45;
  const fireTempContribution = temperature * 0.20;
  const fire = clamp(fireDrynessContribution + fireSmokeContribution + fireTempContribution);

  // --- HEAT ---
  const heatTempContribution = temperature * 0.55;
  const heatHumidityContribution = humidity * 0.25;
  const heatHistoryContribution = historicalRisk * 0.20;
  const heat = clamp(heatTempContribution + heatHumidityContribution + heatHistoryContribution);

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

  // Breakdown of what drove the *primary hazard's* score, as % of that score's total.
  const breakdowns = {
    FLOOD: [
      { factor: 'Rainfall', value: +floodRainfallContribution.toFixed(1) },
      { factor: 'Water Level', value: +floodWaterContribution.toFixed(1) },
      { factor: 'Historical Risk', value: +floodHistoryContribution.toFixed(1) },
    ],
    FIRE: [
      { factor: 'Dryness (low humidity)', value: +fireDrynessContribution.toFixed(1) },
      { factor: 'Smoke Level', value: +fireSmokeContribution.toFixed(1) },
      { factor: 'Temperature', value: +fireTempContribution.toFixed(1) },
    ],
    HEAT: [
      { factor: 'Temperature', value: +heatTempContribution.toFixed(1) },
      { factor: 'Humidity', value: +heatHumidityContribution.toFixed(1) },
      { factor: 'Historical Risk', value: +heatHistoryContribution.toFixed(1) },
    ],
  };

  return {
    flood_score: +flood.toFixed(1),
    fire_score: +fire.toFixed(1),
    heat_score: +heat.toFixed(1),
    overall_score: +overall.toFixed(1),
    risk_level: level,
    primary_hazard: primaryHazard,
    recommended_action: actions[primaryHazard],
    score_breakdown: breakdowns[primaryHazard],
  };
}

module.exports = { computeRisk };