export const fetchPosmGuide = async (brand, locationType) => {
  if (!brand) return null;
  
  try {
    const url = new URL('https://script.google.com/macros/s/AKfycbyvHMZAcfBc6GtdBWiSnf9dkBr-nLCIriRBq3qomH-D68PS5XuK-6HTJLirAj7sl3K21w/exec');
    url.searchParams.append('mode', 'api');
    url.searchParams.append('brand', brand);
    if (locationType) {
      url.searchParams.append('location_type', locationType);
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
      return data;
    }
    return null;
  } catch (error) {
    console.error("Error fetching POSM guide:", error);
    return null;
  }
};
