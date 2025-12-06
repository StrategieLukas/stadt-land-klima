export function buildLocationString(municipality_name, state) {
    if (municipality_name && state) {
        return `${municipality_name}, ${state}`;
    }
    if (municipality_name) {
        return municipality_name;
    }
    if (state) {
        return state;
    }
    return '';
}

export function isRaster(type) {
  return type.startsWith('image/') && !type.includes('svg');
}

export async function toAssetUrl(assetId, isRaster, opts = {}) {
  if(assetId == null) return null;

  const config = useRuntimeConfig();
  const assetUrl = `${config.public.clientDirectusUrl}/assets/${assetId}`

  // SVG / video / pdf → deliver raw
  if (!isRaster) {
    return assetUrl;
  }

  // Build transformed URL
  const p = new URLSearchParams()
  if (opts.width) p.set('width', String(opts.width))
  if (opts.height) p.set('height', String(opts.height))
  if (opts.quality) p.set('quality', String(opts.quality))
  if (opts.fit) p.set('fit', opts.fit)

  // Return assetUrl with additional parameters
  return p.toString() ? `${assetUrl}?${p.toString()}` : assetUrl
}


/**
 * @param {string} dateString
 * @returns {string} Properly formatted date and time
 */
export function formatLastUpdated(dateString, locale) {
  const lastUpdatedAt = new Date(dateString);
  return `${lastUpdatedAt.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "numeric",
  })}, ${lastUpdatedAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
};

export function getRatingDecimalColor(score) {
  if(score === null) return "rating-na";
  return getScorePercentageColor(Number(score) * 100);
}

export function getScorePercentageColor(score) {
  if(score === null) return "rating-na";
  const numericScore = Number(score);
  if(numericScore >= 80) {
    return "rating-4";
  } else if(numericScore >= 60) {
    return "rating-3";
  } else if(numericScore >= 40) {
    return "rating-2";
  } else if(numericScore >= 20) {
    return "rating-1";
  } else if(numericScore >= 0) {
    if(numericScore > 0 && numericScore < 1) {
      console.warn("Score is between 0 and 1 - is this intentional or did we pass a decimal instead of a percentage?");
    }
    return "rating-0";
  }
};


import linkifyStr from "linkify-string";

export function saneLinkifyStr(text, newTab = true) {
  return linkifyStr(text, {
    validate: {
      // don't linkify Stadt.Land.Klima substrings
      // we now require a protocol (http:// or https://) to create a link
      url: (value) => /^https?:\/\//.test(value),
    },
    target: newTab ? "_blank" : "_self",
    rel: "noopener noreferrer",
  });
}




