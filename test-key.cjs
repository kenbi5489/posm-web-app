const https = require('https');
const key = 'AIzaSyAeTa1gk8_AoN56UX9ngDGJ93Tbj2eABF8';
https.get(`https://maps.googleapis.com/maps/api/geocode/json?address=hanoi&key=${key}`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Geocoding API status:', JSON.parse(data).status, JSON.parse(data).error_message || ''));
});
