// In-memory cache for fast access
const memoryCache = {};
const CACHE_EXPIRY_MS = 2 * 60 * 60 * 1000; // Cache for 2 hours

// Helper to get from LocalStorage with expiration check
const getCachedData = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
      return data;
    }
    // Expired
    localStorage.removeItem(key);
    return null;
  } catch (e) {
    return null;
  }
};

// Helper to save to LocalStorage
const setCachedData = (key, data) => {
  try {
    const cacheVal = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheVal));
  } catch (e) {
    // Ignore storage quota errors
  }
};

export const fetchPosmGuide = async (brand, locationType) => {
  if (!brand) return null;
  
  const cacheKey = `posm_guide_${brand.trim().toUpperCase()}_${(locationType || '').trim().toUpperCase()}`;

  // 1. Check in-memory cache first (instant)
  if (memoryCache[cacheKey]) {
    return memoryCache[cacheKey];
  }

  // 2. Check localStorage cache
  const localCached = getCachedData(cacheKey);
  if (localCached) {
    memoryCache[cacheKey] = localCached;
    return localCached;
  }
  
  try {
    const url = new URL('https://script.google.com/macros/s/AKfycbyvHMZAcfBc6GtdBWiSnf9dkBr-nLCIriRBq3qomH-D68PS5XuK-6HTJLirAj7sl3K21w/exec');
    url.searchParams.append('mode', 'api');
    url.searchParams.append('brand', brand.trim());
    if (locationType) {
      url.searchParams.append('location_type', locationType.trim());
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.success) {
      // Save to caches
      memoryCache[cacheKey] = data;
      setCachedData(cacheKey, data);
      return data;
    }
    return null;
  } catch (error) {
    console.error("Error fetching POSM guide:", error);
    return null;
  }
};

// Prefetch a list of brands to warm up the cache in the background
export const prefetchPosmGuides = async (brandsWithLocationTypes) => {
  if (!brandsWithLocationTypes || !Array.isArray(brandsWithLocationTypes)) return;

  // Filter out duplicates and items already cached
  const queue = brandsWithLocationTypes.filter(({ brand, locationType }) => {
    if (!brand) return false;
    const cacheKey = `posm_guide_${brand.trim().toUpperCase()}_${(locationType || '').trim().toUpperCase()}`;
    return !memoryCache[cacheKey] && !getCachedData(cacheKey);
  });

  // Limit concurrent prefetch requests to avoid slamming the API
  const maxConcurrent = 3;
  const processQueue = async () => {
    if (queue.length === 0) return;
    
    const batch = queue.splice(0, maxConcurrent);
    await Promise.all(batch.map(({ brand, locationType }) => 
      fetchPosmGuide(brand, locationType)
        .catch(err => console.log(`Prefetch failed for ${brand}:`, err))
    ));
    
    // Tiny delay before next batch
    setTimeout(processQueue, 300);
  };

  processQueue();
};

