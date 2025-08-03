function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function similarityScore(m1, m2) {
  // 1. Population similarity (proportional ratio)
  const popRatio = m1.population / m2.population;
  const populationScore = 1 / (Math.abs(Math.log2(popRatio)) + 1);

  // 2. Distance score (exponential decay from 30km)
  const distance = haversine(m1.lat, m1.lng, m2.lat, m2.lng);
  const decayRate = Math.log(2) / 170; // halves every 170km past 30km
  const distanceScore = distance <= 30 ? 1 : Math.exp(-decayRate * (distance - 30));

  // 3. State similarity bonuses
  const sameStateBonus = m1.state === m2.state ? 0.1 : 0;
  const eastStates = ['Mecklenburg-Vorpommern', 'Brandenburg', 'Sachsen-Anhalt', 'Sachsen', 'Thüringen'];
  const inEast = (m) => eastStates.includes(m.state);
  const eastBonus = (inEast(m1) && inEast(m2)) ? 0.2 : 0;

  // 4. Governing party bonus
  const partyBonus = (
    m1.party_mayor &&
    m2.party_mayor &&
    m1.party_mayor === m2.party_mayor
  ) ? 0.05 : 0;

  // Final score (80% distance/pop, 20% bonuses)
  return 0.4 * populationScore + 0.4 * distanceScore + sameStateBonus + eastBonus + partyBonus;
}

function sortBySimilarity(reference, others) {
  return [...others].sort((a, b) =>
    similarityScore(reference, b) - similarityScore(reference, a)
  );
}
