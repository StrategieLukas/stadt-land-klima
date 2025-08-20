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
  // 1. Population similarity (proportional ratio) - Max Score: 2
  const popRatio = Number(m1.population) / Number(m2.population);
  const populationScore = 2 / (Math.abs(Math.log2(popRatio)) + 1);
  // console.log("Population Ratio", m1.name, m2.name, popRatio, populationScore);

  // 2. Distance score (exponential decay from 30km) - Max Score: 1
  let distanceScore;

  const m1Loc = m1?.geolocation;
  const m2Loc = m2?.geolocation;

  if (typeof m1Loc?.lat === 'number' && typeof m1Loc?.lon === 'number' && typeof m2Loc?.lat === 'number' && typeof m2Loc?.lon === 'number') {
    const distance = haversine(m1Loc.lat, m1Loc.lon, m2Loc.lat, m2Loc.lon);
    const decayRate = Math.log(2) / 170; // halves every 170km past 30km
    distanceScore = distance <= 30 ? 1 : Math.exp(-decayRate * (distance - 30));
    // console.log("Distance between", m1.name, m2.name, distance, distanceScore);
  } else {
    // If geodata is missing, then log a warning and use a plausible default value
    if (!m1Loc) {
      console.warn(`Die Geodaten von der Kommune "${m1?.name ?? 'unknown'}" fehlen`);
    }
    if (!m2Loc) {
      console.warn(`Die Geodaten von der Kommune "${m2?.name ?? 'unknown'}" fehlen`);
    }
    // This is roughly the average score you would expect if you picked random municipalities, I guess?
    distanceScore = 0.2;
  }


  // 3. Same state and east bonus
  const eastStates = ['Mecklenburg-Vorpommern', 'Brandenburg', 'Sachsen-Anhalt', 'Sachsen', 'Thüringen'];
  const inEast = (m) => eastStates.includes(m.state);

  let stateBonus = 0;
  const sameState = m1.state === m2.state;
  const bothEast = inEast(m1) && inEast(m2);

  // If the are in the same state in the east -> 0.3
  if (sameState && bothEast) {
  stateBonus = 0.3;
  // If they are in the same state in the west -> 0.2
  // If they are in different states, but both in the east -> 0.2
  } else if (sameState || bothEast) {
  stateBonus = 0.2;
  }

  // 4. Same governing party bonus - Max Score: 0.1
    const partyBonus = (
    m1.party_mayor && m2.party_mayor
        // If same governing party - more similar (0.1), if different party - more different (0.0)
        ? (m1.party_mayor === m2.party_mayor ? 0.1 : 0.0)
        // If one of the municipalities does not have this field entered - put a neutral value (0.05)
        : 0.05
    );


  // Final score
  // console.log("Similiary scores:", populationScore, distanceScore, stateBonus, partyBonus);
  return populationScore + distanceScore + stateBonus + partyBonus;
}

export function calculateAndAddSimilarityScores(reference, others) {
  return [...others]
    .map(obj => {
      const score = similarityScore(reference, obj.municipality);
      return { ...obj, similarityScore: score };
    });
}

