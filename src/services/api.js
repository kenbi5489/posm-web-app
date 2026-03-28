import Papa from 'papaparse';
import { mockUsers, mockPOSMData } from './mockData';

const SPREADSHEET_ID = '1VdycOwMxhEY62_Ws3QAXYIydvsKftsSh3EEyNdMbrJM';
export const GID_DATA = '620957061';
export const GID_USERS = '1500350493';
export const GID_ACCEPTANCE = '511717734';

const getCsvUrl = (gid) => `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;

export const fetchSheetData = async (gid, fallbackData) => {
  try {
    const url = getCsvUrl(gid);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch data');
    const csvText = await response.text();

    // Check if it's an error page (HTML) instead of CSV
    if (csvText.trim().startsWith('<')) {
      console.warn(`GID ${gid} returned an error page. Using fallback data.`);
      return fallbackData;
    }

    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error)
      });
    });
  } catch (error) {
    console.warn(`Fetch error for GID ${gid}:`, error);
    return fallbackData
  }
};

export const fetchUsers = async () => mockUsers;
export const fetchPOSMData = async () => mockPOSMData;
export const fetchAcceptanceData = () => fetchSheetData(GID_ACCEPTANCE, []);

export const updatePOSMStatus = async (scriptUrl, payload) => {
  if (!scriptUrl) {
    console.warn('Apps Script URL not configured. Mocking success.');
    return { success: true, message: 'Mock update successful' };
  }

  const response = await fetch(scriptUrl, {
    method: 'POST',
    mode: 'no-cors', // Apps Script requires no-cors if not using specialized headers
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  // Note: with no-cors, we won't get the response body, but we assume success if it doesn't throw
  return { success: true, message: 'Update request sent' };
};
