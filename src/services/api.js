import Papa from 'papaparse';
import { mockUsers, mockPOSMData } from './mockData';

const SPREADSHEET_ID = '1VdycOwMxhEY62_Ws3QAXYIydvsKftsSh3EEyNdMbrJM';
export const GID_DATA = '620957061';
export const GID_USERS = '1500350493';
export const GID_ACCEPTANCE = '511717734';

// Using export?format=csv instead of gviz/tq because gviz/tq respects active sheet filters
// which caused only filtered rows (e.g., W15 = 375 rows) to be returned instead of all 4721 rows.
const getCsvUrl = (gid) => `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;

export const fetchSheetData = async (gid, fallbackData) => {
  try {
    const url = getCsvUrl(gid);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Network response was not ok');
    const csvText = await response.text();

    if (csvText.trim().startsWith('<')) {
      return { data: fallbackData, isMock: true, error: 'Authorization or GID error' };
    }

    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve({ data: results.data, isMock: false }),
        error: (error) => resolve({ data: fallbackData, isMock: true, error: error.message })
      });
    });
  } catch (error) {
    return { data: fallbackData, isMock: true, error: error.message };
  }
};

export const fetchUsers = async () => mockUsers;
export const fetchPOSMData = () => fetchSheetData(GID_DATA, mockPOSMData);
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
