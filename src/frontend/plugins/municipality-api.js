export default defineNuxtPlugin(() => {
  const API_BASE = 'https://your-api.example.com/municipality'; // Replace with actual API

const fetchStatsBySlug = async (slug) => {
  const url = `${API_BASE}/stats/${slug}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.error(`fetchStatsBySlug failed for slug "${slug}" - Response status: ${res.status}`);
    return null;
  }

  return await res.json();
};


  const municipalityApi = {
    fetchStatsBySlug,
  };

  return {
    provide: {
      municipalityApi,
    },
  };
});
