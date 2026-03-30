import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, useMap, ZoomControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Navigation, Search as SearchIcon, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Fix Leaflet's default icon path issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const removeAccents = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const createClusterCustomIcon = function (cluster) {
  return L.divIcon({
    html: `<div style="background-color: #1565C0; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid rgba(255,255,255,0.5); box-shadow: 0 4px 6px rgba(0,0,0,0.3); opacity: 0.9;"><span>${cluster.getChildCount()}</span></div>`,
    className: 'custom-marker-cluster',
    iconSize: L.point(40, 40, true),
  });
};

const createPointIcon = (count, isDone) => {
  const color = isDone ? '#2E7D32' : '#F57C00';
  const size = count > 1 ? 32 : 20;
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            ${count > 1 ? count : ''}
          </div>`,
    className: 'custom-leaflet-marker',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

const createSearchIcon = () => {
  return L.divIcon({
    html: `<div style="color: #FF0000; font-size: 32px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); transform: translate(-50%, -100%);">📍</div>`,
    className: 'search-marker',
    iconSize: [0, 0], // Sized by transform
  });
};

// Map controller component to handle camera moves
const MapController = ({ itemsWithCoords, mapCenter, mapZoom }) => {
  const map = useMap();
  useEffect(() => {
    if (mapCenter) {
      map.flyTo([mapCenter.lat, mapCenter.lng], mapZoom || 16, { duration: 1.5 });
    } else if (itemsWithCoords.length > 0) {
      const bounds = L.latLngBounds(itemsWithCoords.map(i => [parseFloat(i.lat), parseFloat(i.lng)]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [itemsWithCoords, mapCenter, mapZoom, map]);
  return null;
};

const MapView = () => {
  const { user, selectedStaff } = useAuth();
  
  const [allItems, setAllItems] = useState([]);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

  // Filters
  const [filterWeek, setFilterWeek] = useState('All');
  const [filterStatus] = useState('Pending'); // Fixed to Pending
  
  // Search
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMarker, setSearchMarker] = useState(null);
  const searchTimeoutRef = useRef(null);

  // Geocoding progress
  const [geocoding, setGeocoding] = useState(false);
  const [geocodedCount, setGeocodedCount] = useState(0);

  // Camera state
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(null);

  // --- Load All Data From DB ---
  useEffect(() => {
    const loadData = async () => {
      let data = await db.posmData.toArray();
      data = data.map(item => ({
        ...item,
        week: item.week ? item.week.toString().trim() : '',
        pic: item.pic ? item.pic.toString().trim() : '',
        pic_id: item.pic_id ? item.pic_id.toString().trim() : '',
      }));
      setAllItems(data);
    };
    loadData();
  }, [user, dataVersion]);

  // --- Derive filter options ---
  const weekOptions = useMemo(() => {
    return [...new Set(allItems.map(i => (i.week || '').trim()).filter(Boolean))].sort();
  }, [allItems]);

  // --- Handle default week (Latest) ---
  useEffect(() => {
    if (weekOptions.length > 0) {
      if (filterWeek === 'All' || !filterWeek) {
        setFilterWeek(weekOptions[weekOptions.length - 1]);
      }
    }
  }, [weekOptions, filterWeek]);

  // --- Apply filters ---
  const filteredItems = useMemo(() => {
    let data = [...allItems];

    const isStaffRole = user?.role === 'staff';
    const hasSelectedStaff = !!selectedStaff;

    if (isStaffRole || hasSelectedStaff) {
      const picId = selectedStaff?.user_id || user?.user_id;
      const staffName = selectedStaff?.ho_ten || user?.ho_ten;

      data = data.filter(item => {
        const matchById = picId && item.pic_id && (item.pic_id.toString().trim() === picId.toString().trim());
        const normalizedItemPic = removeAccents(item.pic);
        const normalizedStaffName = removeAccents(staffName);
        const matchByName = staffName && item.pic &&
          (normalizedItemPic === normalizedStaffName ||
           normalizedItemPic.includes(normalizedStaffName) ||
           normalizedStaffName.includes(normalizedItemPic));

        return matchById || matchByName;
      });
    }

    // Force Status: Pending only
    data = data.filter(item => item.status !== 'Done');

    // Force Week: Selected week only (W+1)
    if (filterWeek && filterWeek !== 'All') {
      data = data.filter(item => (item.week || '').trim() === filterWeek.trim());
    }

    return data;
  }, [allItems, filterWeek, selectedStaff, user]);

  const isGeocodingBusy = useRef(false);

  // --- Auto-geocode via OSM Nominatim ---
  useEffect(() => {
    let isActive = true;

    // missingCoords check
    const runGeocoding = async () => {
      if (isGeocodingBusy.current) return;
      
      const itemsToMap = filteredItems.filter(item => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lng);
        return isNaN(lat) || isNaN(lng);
      });

      if (itemsToMap.length === 0) {
        setGeocoding(false);
        return;
      }

      isGeocodingBusy.current = true;
      setGeocoding(true);
      setGeocodedCount(0);

      let batchFound = 0;

      for (let i = 0; i < itemsToMap.length; i++) {
        if (!isActive) break;
        const item = itemsToMap[i];
        
        const tryGeocode = async (query) => {
          const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=vn`;
          const response = await fetch(url, { 
            headers: { 'Accept-Language': 'vi', 'User-Agent': `POSM-Tracker-PWA-${Math.random().toString(36).substr(2, 5)}` } 
          });
          return await response.json();
        };

        try {
          const fullAddress = `${item.address || ''}, ${item.ward || ''}, ${item.district || ''}, ${item.city || ''}`.replace(/, ,/gi, ',').replace(/(^,)|(,$)/g, '').trim();
          const fallbackAddress = `${item.district || ''}, ${item.city || ''}`.trim();

          let results = await tryGeocode(fullAddress);
          
          // Fallback if full address fails
          if ((!results || results.length === 0) && fallbackAddress) {
            results = await tryGeocode(fallbackAddress);
          }

          if (results && results.length > 0) {
            item.lat = results[0].lat;
            item.lng = results[0].lon; 
            
            await db.posmData.put({ ...item });
            batchFound++;
            
            // Update UI every 2 successful finds
            if (batchFound % 2 === 0) {
               setDataVersion(v => v + 1);
            }
          }
        } catch (error) {
          console.error('[Geocoding] API Error:', error);
          await sleep(2000);
        }

        if (isActive) setGeocodedCount(i + 1);
        await sleep(1200); // 1.2s to be safe
      }

      if (isActive) {
        setGeocoding(false);
        isGeocodingBusy.current = false;
        setDataVersion(v => v + 1); // Final refresh
      }
    };

    const timer = setTimeout(runGeocoding, 1500); // Initial delay to prevent mount race
    return () => { isActive = false; clearTimeout(timer); };
  }, [filteredItems.length, filterWeek, selectedStaff]); 

  // Handle Search Input (Switch to Photon API for speed)
  const handleSearch = (e) => {
    const q = e.target.value;
    setSearchInput(q);
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (q.trim().length <= 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Photon is faster and more lenient for autocomplete
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=vi&lat=10.762&lon=106.660`;
        const res = await fetch(url);
        const data = await res.json();
        
        const mappedResults = (data.features || []).map(f => ({
          place_id: f.properties.osm_id || Math.random(),
          display_name: [
            f.properties.name,
            f.properties.street,
            f.properties.district,
            f.properties.city,
            f.properties.country
          ].filter(Boolean).join(', '),
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0]
        }));
        
        setSearchResults(mappedResults);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 600);
  };

  const selectSearchResult = (result) => {
    setSearchInput(result.display_name);
    setSearchResults([]);
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    setSearchMarker({ lat, lng: lon });
    setMapCenter({ lat, lng: lon });
    setMapZoom(17);
  };

  // Process data for standard markers
  const itemsWithCoords = filteredItems.filter(item => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lng);
    return !isNaN(lat) && !isNaN(lng);
  });

  const groupedByCoords = itemsWithCoords.reduce((acc, item) => {
    const lat = parseFloat(item.lat).toFixed(6);
    const lng = parseFloat(item.lng).toFixed(6);
    const key = `${lat},${lng}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="relative min-h-[calc(100vh-140px)] w-full bg-slate-100 flex flex-col">
      {/* Geocoding progress banner */}
      <AnimatePresence>
        {geocoding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 z-[1000] bg-primary text-white px-5 py-3 flex items-center gap-3 shadow-premium"
          >
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black">Đang định vị địa chỉ...</p>
              <p className="text-[10px] text-white/70 font-medium">Đã phân tích {geocodedCount} điểm qua OpenStreetMap (Miễn phí)</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Search + Filter Bar */}
      <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 z-[5000] pointer-events-none">
        
        {/* Search Input */}
        <div className="w-full pointer-events-auto relative">
          <div className="shadow-premium rounded-2xl bg-white overflow-hidden flex items-center pr-3 border border-slate-100">
            <input
              type="text"
              value={searchInput}
              onChange={handleSearch}
              placeholder="📍 Tìm khu vực, tên phường/đường..."
              className="flex-1 h-12 px-5 bg-transparent text-slate-700 font-bold border-none focus:outline-none text-sm placeholder:text-slate-400"
            />
            {isSearching && (
              <div className="mr-2">
                <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            )}
            {searchInput && (
              <button 
                onClick={() => { setSearchInput(''); setSearchResults([]); setSearchMarker(null); }} 
                className="p-2 text-slate-400 hover:text-slate-600 active:scale-90 transition-transform"
              >
                <X size={18} />
              </button>
            )}
          </div>
          
          {/* Search Results Dropdown */}
          <AnimatePresence>
            {searchInput.length > 2 && (searchResults.length > 0 || isSearching) && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[50vh] overflow-y-auto z-[5001]"
              >
                {isSearching && searchResults.length === 0 && (
                  <div className="px-5 py-4 text-xs font-bold text-slate-400 flex items-center gap-3">
                    <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
                    Đang tìm địa điểm...
                  </div>
                )}
                
                {!isSearching && searchResults.length === 0 && searchInput.length > 2 && (
                  <div className="px-5 py-4 text-xs font-bold text-slate-400 italic">
                    Không tìm thấy địa điểm này
                  </div>
                )}

                {searchResults.map((result) => (
                  <button 
                    key={result.place_id} 
                    onClick={() => selectSearchResult(result)}
                    className="w-full text-left px-5 py-4 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 active:bg-slate-100 transition-colors flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      <SearchIcon size={14} className="text-slate-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-800 line-clamp-1">{result.display_name.split(',')[0]}</div>
                      <div className="text-[10px] font-bold text-slate-400 line-clamp-1 mt-0.5">{result.display_name}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Quick Filters Row */}
        <div className="flex gap-2 w-full pointer-events-auto">
          <div className="flex-1 relative shadow-soft rounded-xl bg-white">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Filter size={14} />
            </div>
            <select
               value={filterWeek}
               onChange={e => setFilterWeek(e.target.value)}
               className="w-full h-11 pl-9 pr-8 rounded-xl bg-transparent text-slate-700 text-xs font-black border-2 border-transparent focus:border-primary focus:outline-none appearance-none cursor-pointer"
            >
               {weekOptions.length === 0 && <option value="">📅 Đang tải dữ liệu...</option>}
               {weekOptions.map(w => <option key={w} value={w}>Tuần: {w}</option>)}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]">▼</span>
          </div>
        </div>



        {/* Summary badge */}
        <div className="pointer-events-auto mt-1 flex items-center gap-2">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl px-4 py-2.5 shadow-premium text-[11px] font-black text-slate-700 border border-slate-100 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span>
              {geocoding ? (
                <span className="text-amber-600 animate-pulse">🛠 Đang định vị: {geocodedCount}/{filteredItems.length} địa chỉ...</span>
              ) : itemsWithCoords.length > 0 ? (
                <>📍 <span className="text-primary">{itemsWithCoords.length}</span> cửa hàng trong {filterWeek}</>
              ) : filteredItems.length > 0 ? (
                <span className="text-amber-600">⚠️ {filteredItems.length} việc chưa có tọa độ</span>
              ) : (
                <span className="text-slate-400 italic">Không có công việc tồn đọng</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Leaflet Map */}
      <div className="flex-1 w-full relative bg-[#E5E3DF] z-0 min-h-[500px]">
        <MapContainer 
          center={[10.762622, 106.660172]} 
          zoom={12} 
          className="absolute inset-0 w-full h-full"
          zoomControl={false}
          attributionControl={false}
        >
          <MapController itemsWithCoords={itemsWithCoords} mapCenter={mapCenter} mapZoom={mapZoom} />
          
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ZoomControl position="bottomright" />

          {/* Search marker */}
          {searchMarker && (
            <Marker position={[searchMarker.lat, searchMarker.lng]} icon={createSearchIcon()} />
          )}

          {/* Cluster the coordinates */}
          <MarkerClusterGroup 
            chunkedLoading 
            iconCreateFunction={createClusterCustomIcon}
            maxClusterRadius={40}
            showCoverageOnHover={false}
          >
            {Object.values(groupedByCoords).map((locationItems, idx) => {
              const lat = parseFloat(locationItems[0].lat);
              const lng = parseFloat(locationItems[0].lng);
              const isAllDone = locationItems.every(i => i.status === 'Done');
              
              return (
                <Marker 
                  key={`marker-${lat}-${lng}-${idx}`}
                  position={[lat, lng]} 
                  icon={createPointIcon(locationItems.length, isAllDone)}
                  eventHandlers={{ click: () => setSelectedCluster(locationItems) }}
                />
              );
            })}
          </MarkerClusterGroup>

        </MapContainer>
      </div>

      {/* Bottom Sheet for selected marker */}
      <AnimatePresence>
        {selectedCluster && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedCluster(null)}
              className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-30"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] shadow-premium z-40 max-h-[70vh] flex flex-col"
            >
              <div className="p-5 flex justify-between items-center border-b border-slate-50 gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{selectedCluster.length} địa điểm</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                    {selectedCluster[0].week && <span className="text-primary">[{selectedCluster[0].week}] </span>}
                    {selectedCluster[0].address}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                        const destination = `${selectedCluster[0].lat},${selectedCluster[0].lng}`;
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
                    }}
                    className="h-10 px-4 rounded-xl bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest flex items-center shadow-soft active:scale-95 transition-transform"
                  >
                    Chỉ đường
                  </button>
                  <button onClick={() => setSelectedCluster(null)} className="h-10 w-10 flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 active:bg-slate-100 transition-colors">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe">
                {selectedCluster.map((item, idx) => (
                  <div
                    key={`${item.job_code}-${idx}`}
                    className="bg-slate-50 rounded-3xl p-4 border border-slate-100 shadow-soft"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        {item.brand && <p className="text-xs font-black text-slate-400 mb-1">{item.brand}</p>}
                        <h4 className="text-sm font-black text-slate-800">{item.address}</h4>
                      </div>
                      <span className={`px-2 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest ${
                        item.status === 'Done' ? 'bg-done/10 text-done' : 'bg-accent/10 text-accent'
                      }`}>
                        {item.status === 'Done' ? 'Đã xong' : 'Đang làm'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="bg-white rounded-2xl p-3 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Mã NV</p>
                        <p className="text-xs font-black text-slate-700">{item.pic_id}</p>
                      </div>
                      <div className="bg-white rounded-2xl p-3 border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Họ Tên</p>
                        <p className="text-xs font-black text-slate-700 truncate">{item.pic}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapView;
