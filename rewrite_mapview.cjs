const fs = require('fs');

const code = `
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Loader } from '@googlemaps/js-api-loader';
import { X, Navigation, Search as SearchIcon, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const removeAccents = (str) => {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const MapView = () => {
  const { user, selectedStaff } = useAuth();
  
  const [allItems, setAllItems] = useState([]);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

  // Filters
  const [filterWeek, setFilterWeek] = useState('All');
  const [filterStatus] = useState('Pending'); 
  
  // Search
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMarker, setSearchMarker] = useState(null);
  const searchTimeoutRef = useRef(null);

  // Geocoding progress
  const [geocoding, setGeocoding] = useState(false);
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [geocodingError, setGeocodingError] = useState(null);

  // Editing state
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [tempCoords, setTempCoords] = useState(null);

  // Google Maps Refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const geocoderRef = useRef(null);
  const searchMarkerRef = useRef(null);

  // Load All Data From DB
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

  // Derive filter options
  const weekOptions = useMemo(() => {
    return [...new Set(allItems.map(i => (i.week || '').trim()).filter(Boolean))].sort();
  }, [allItems]);

  // Handle default week
  useEffect(() => {
    if (weekOptions.length > 0) {
      if (filterWeek === 'All' || !filterWeek) {
        setFilterWeek(weekOptions[weekOptions.length - 1]);
      }
    }
  }, [weekOptions, filterWeek]);

  // Apply filters
  const filteredItems = useMemo(() => {
    let data = [...allItems];
    const isStaffRole = user?.role === 'staff';
    const hasSelectedStaff = !!selectedStaff;

    if (isStaffRole || hasSelectedStaff) {
      const picId = (selectedStaff?.user_id || user?.user_id || '').toString().trim().toLowerCase();
      const staffName = selectedStaff?.ho_ten || user?.ho_ten;
      const normalizedStaffName = removeAccents(staffName);

      data = data.filter(item => {
        const itemPicId = (item.pic_id || '').toString().trim().toLowerCase();
        const matchById = picId && itemPicId && (itemPicId === picId);
        
        const normalizedItemPic = removeAccents(item.pic);
        const matchByName = normalizedStaffName && normalizedItemPic &&
          (normalizedItemPic === normalizedStaffName ||
           normalizedItemPic.includes(normalizedStaffName) ||
           normalizedStaffName.includes(normalizedItemPic));

        return matchById || matchByName;
      });
    }

    data = data.filter(item => item.status !== 'Done');

    if (filterWeek && filterWeek !== 'All') {
      data = data.filter(item => (item.week || '').trim() === filterWeek.trim());
    }

    return data;
  }, [allItems, filterWeek, selectedStaff, user]);

  const isGeocodingBusy = useRef(false);

  // Process data for maps
  const itemsWithCoords = useMemo(() => {
    return filteredItems.filter(item => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lng);
      return !isNaN(lat) && !isNaN(lng);
    });
  }, [filteredItems]);

  const scatteredItems = useMemo(() => {
    const coordsUsage = {};
    return itemsWithCoords.map(item => {
       const lat = parseFloat(item.lat);
       const lng = parseFloat(item.lng);
       const key = \`\${lat.toFixed(5)},\${lng.toFixed(5)}\`;
       
       if (!coordsUsage[key]) coordsUsage[key] = 0;
       const count = coordsUsage[key]++;
       
       let displayLat = lat;
       let displayLng = lng;
       
       if (count > 0) {
          // Calculate scatter offset for Google Maps (slightly smaller than Leaflet)
          const radius = 0.0001 * Math.ceil(count / 5); 
          const angle = count * 1.375; 
          displayLat += radius * Math.cos(angle);
          displayLng += radius * Math.sin(angle);
       }
       
       return { ...item, displayLat, displayLng };
    });
  }, [itemsWithCoords]);

  // Initialize Google Maps Native API & Geocoder
  useEffect(() => {
    const initMap = async () => {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        setGeocodingError("Thiếu Google Maps API Key.");
        return;
      }

      try {
        const loader = new Loader({
          apiKey,
          version: "weekly",
          libraries: ["places", "marker"]
        });

        const { Map } = await loader.importLibrary("maps");
        const { Geocoder } = await loader.importLibrary("geocoding");
        
        geocoderRef.current = new Geocoder();

        if (mapRef.current && !mapInstanceRef.current) {
          mapInstanceRef.current = new Map(mapRef.current, {
            center: { lat: 10.762622, lng: 106.660172 }, // Default HCMC
            zoom: 12,
            mapId: "DEMO_MAP_ID", // Required for AdvancedMarkerElement
            disableDefaultUI: true,
            zoomControl: true,
          });
        }
      } catch (err) {
        console.error("Google Maps Load Error:", err);
        setGeocodingError("Lỗi tải bản đồ Google. Vui lòng kiểm tra API Key.");
      }
    };
    initMap();
  }, []);

  // Sync Markers to Native Map
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;

    // Clear old markers
    markersRef.current.forEach(m => m.map = null);
    markersRef.current = [];

    // Create new markers using standard Marker (widely supported)
    scatteredItems.forEach((item, idx) => {
      const isDone = item.status === 'Done';
      const color = isDone ? '#2E7D32' : '#F57C00';

      const dotIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
        scale: 8,
      };

      const marker = new window.google.maps.Marker({
        position: { lat: item.displayLat, lng: item.displayLng },
        map: mapInstanceRef.current,
        icon: dotIcon,
        title: item.address
      });

      marker.addListener("click", () => {
        setSelectedCluster([item]);
      });

      markersRef.current.push(marker);
    });

    // Fit map bounds
    if (scatteredItems.length > 0 && !isEditingLocation) {
      const bounds = new window.google.maps.LatLngBounds();
      scatteredItems.forEach(item => {
        bounds.extend({ lat: item.displayLat, lng: item.displayLng });
      });
      mapInstanceRef.current.fitBounds(bounds);
    }
  }, [scatteredItems, isEditingLocation]);

  // Sync Search Marker
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;
    
    if (searchMarkerRef.current) {
      searchMarkerRef.current.map = null;
      searchMarkerRef.current = null;
    }

    if (searchMarker) {
      searchMarkerRef.current = new window.google.maps.Marker({
        position: { lat: searchMarker.lat, lng: searchMarker.lng },
        map: mapInstanceRef.current,
      });
      mapInstanceRef.current.panTo({ lat: searchMarker.lat, lng: searchMarker.lng });
      mapInstanceRef.current.setZoom(16);
    }
  }, [searchMarker]);

  // Handle Editing Location Click
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;

    let clickListener;
    if (isEditingLocation) {
      mapInstanceRef.current.setOptions({ draggableCursor: 'crosshair' });
      clickListener = mapInstanceRef.current.addListener("click", (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setTempCoords({ lat, lng });
        
        if (searchMarkerRef.current) searchMarkerRef.current.map = null;
        searchMarkerRef.current = new window.google.maps.Marker({
          position: { lat, lng },
          map: mapInstanceRef.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#FF0000",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFFFFF',
            scale: 8,
          }
        });
      });
    } else {
      mapInstanceRef.current.setOptions({ draggableCursor: '' });
      if (searchMarkerRef.current && tempCoords) {
        searchMarkerRef.current.map = null;
        searchMarkerRef.current = null;
      }
    }

    return () => {
      if (clickListener) window.google.maps.event.removeListener(clickListener);
    };
  }, [isEditingLocation, tempCoords]);


  // Auto-geocode via Native Google Geocoder API
  useEffect(() => {
    let isActive = true;

    const runGeocoding = async () => {
      if (isGeocodingBusy.current) return;
      if (!geocoderRef.current) return; // Wait for Google SDK
      
      const itemsToMap = filteredItems.filter(item => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lng);
        return (isNaN(lat) || isNaN(lng)) && !item.geocoded_failed;
      });

      if (itemsToMap.length === 0) {
        setGeocoding(false);
        return;
      }

      isGeocodingBusy.current = true;
      setGeocoding(true);
      setGeocodedCount(0);
      setGeocodingError(null);

      const geocodeCache = new Map();

      for (let i = 0; i < itemsToMap.length; i++) {
        if (!isActive) break;
        const item = itemsToMap[i];
        
        const tryNativeGeocode = async (query) => {
          if (geocodeCache.has(query)) return geocodeCache.get(query);
          return new Promise((resolve, reject) => {
             geocoderRef.current.geocode({ address: query, region: 'vn' }, (results, status) => {
                if (status === "OK" && results && results.length > 0) {
                   const loc = results[0].geometry.location;
                   const res = [{ lat: loc.lat(), lon: loc.lng() }];
                   geocodeCache.set(query, res);
                   resolve(res);
                } else {
                   reject(new Error(status));
                }
             });
          });
        };

        try {
          const address = item.address || '';
          
          const expandVi = (txt) => {
             if (!txt) return '';
             return txt.replace(/\\bP\\./gi, 'Phường ')
                       .replace(/\\bQ\\./gi, 'Quận ')
                       .replace(/\\bTP\\.HCM\\b/gi, 'Hồ Chí Minh')
                       .replace(/\\bTP\\./gi, 'Thành phố ')
                       .replace(/\\bTX\\./gi, 'Thị xã ')
                       .replace(/\\bTT\\./gi, 'Thị trấn ')
                       .replace(/Hồ Chí Minh/gi, 'Hồ Chí Minh');
          };

          // Google is extremely smart, we just clean up garbage keywords
          const cleanQuery = address.replace(/Tầng\\s+[A-Za-z0-9&]+\\s*,?/gi, '')
                                  .replace(/L\\d+-\\d+[A-Z]?\\s*,?/gi, '')
                                  .replace(/(?:TTTM|Trung tâm thương mại)\\s*/gi, '')
                                  .trim();

          const parts = cleanQuery.split(',');
          const tail = parts.slice(Math.max(0, parts.length - 3)).join(', ');

          let results = null;

          try {
             // 1. Try cleaned full string
             results = await tryNativeGeocode(cleanQuery + ", Vietnam");
          } catch (e1) {
             try {
                // 2. Try the tail if it looks meaningful
                if (tail.length > 5 && tail !== cleanQuery) {
                  results = await tryNativeGeocode(tail + ", Vietnam");
                } else throw new Error("skip");
             } catch (e2) {
                try {
                   // 3. Try fallback to Ward/District columns
                   const w = expandVi(item.ward || '');
                   const d = expandVi(item.district || '');
                   const c = expandVi(item.city || 'Hồ Chí Minh');
                   if (w.length > 2 && d.length > 1) {
                      results = await tryNativeGeocode(\`\${w}, \${d}, \${c}, Vietnam\`);
                   } else throw new Error("skip");
                } catch(e3) {
                   results = null;
                }
             }
          }

          if (results && results.length > 0) {
            item.lat = parseFloat(results[0].lat);
            item.lng = parseFloat(results[0].lon); 
            await db.posmData.put({ ...item });
            
            if (i % 2 === 0) {
               setDataVersion(v => v + 1);
            }
          } else {
             item.geocoded_failed = true;
             await db.posmData.put({ ...item });
          }
        } catch (error) {
          console.error('[Geocoding] SDK Error:', error);
          if (error.message === "OVER_QUERY_LIMIT") {
             setGeocodingError('Google API báo quá giới hạn. Đợi chút nhé.');
             break;
          }
        }

        if (isActive) setGeocodedCount(i + 1);
        await sleep(150); // SDK handles requests very fast, small delay applies
      }

      if (isActive) {
        setGeocoding(false);
        isGeocodingBusy.current = false;
        setDataVersion(v => v + 1);
      }
    };

    // Give loader time to initialize
    const startTimeout = setTimeout(() => {
       runGeocoding();
    }, 1500);

    return () => {
      isActive = false;
      clearTimeout(startTimeout);
      isGeocodingBusy.current = false;
    };
  }, [filteredItems]);


  // Search Input handlers
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      if (!geocoderRef.current) {
        const local = itemsWithCoords.filter(i => (i.address||'').toLowerCase().includes(value.toLowerCase()));
        setSearchResults(local.slice(0,5));
        setIsSearching(false);
        return;
      }
      geocoderRef.current.geocode({ address: value + ', Vietnam' }, (results, status) => {
        if (status === 'OK' && results) {
           setSearchResults(results.map(r => ({
              display_name: r.formatted_address,
              lat: r.geometry.location.lat(),
              lon: r.geometry.location.lng()
           })).slice(0,5));
        } else {
           setSearchResults([]);
        }
        setIsSearching(false);
      });
    }, 600);
  };

  const handleSelectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setSearchMarker({ lat, lng, display_name: result.display_name });
    setSearchInput(result.display_name);
    setSearchResults([]);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchResults([]);
    setSearchMarker(null);
  };

  const handleConfirmLocation = async () => {
    if (!selectedCluster || selectedCluster.length !== 1 || !tempCoords) return;
    try {
      const itemToUpdate = selectedCluster[0];
      itemToUpdate.lat = tempCoords.lat.toString();
      itemToUpdate.lng = tempCoords.lng.toString();
      itemToUpdate.geocoded_failed = false; 
      
      await db.posmData.put(itemToUpdate);
      setDataVersion(v => v + 1);
      setIsEditingLocation(false);
      setTempCoords(null);
      setSelectedCluster(null);
      alert('Đã cập nhật vị trí mới thành công!');
    } catch (error) {
      console.error("Lỗi cập nhật vị trí:", error);
      alert('Có lỗi xảy ra khi lưu vị trí mới. Vui lòng thử lại.');
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50 overflow-hidden relative">
      {/* Top Banner Status */}
      <div className="bg-white px-3 py-2 shadow-sm flex items-center justify-between z-10 sticky top-0 relative">
        <div className="flex flex-col">
          <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            {geocodingError ? (
              <span className="text-red-500 font-bold px-2 py-1 bg-red-50 rounded">⚠️ {geocodingError}</span>
            ) : geocoding ? (
              <span className="text-amber-600 animate-pulse font-bold px-2 py-1 bg-amber-50 rounded flex items-center gap-1">
                 <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 Đang định vị (Google API): {geocodedCount}/{filteredItems.filter(i => isNaN(parseFloat(i.lat)) && !i.geocoded_failed).length} ...
              </span>
            ) : itemsWithCoords.length > 0 ? (
              <>📍 <span className="text-blue-600 font-bold">{itemsWithCoords.length}</span> cửa hàng trong {filterWeek}</>
            ) : (
              <span className="text-slate-500">Chưa có tọa độ hoặc lỗi phân tích.</span>
            )}
          </div>
          {itemsWithCoords.length < filteredItems.length && !geocoding && !geocodingError && (
            <span className="text-[10px] text-slate-400 mt-0.5">Bỏ qua {filteredItems.length - itemsWithCoords.length} điểm không tồn tại trên bản đồ</span>
          )}
        </div>
      </div>

      {/* Header Utilities */}
      <div className="flex-none p-3 space-y-2 z-10 sticky top-0 mt-[-1px]">
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-10 py-3 sm:py-2 bg-white border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm transition-all"
            placeholder="Tìm kiếm địa chỉ, tên đường..."
            value={searchInput}
            onChange={handleSearchChange}
          />
          {searchInput && (
            <button onClick={clearSearch} className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
            </button>
          )}

          {/* Search Dropdown */}
          <AnimatePresence>
            {searchInput && (searchResults.length > 0 || isSearching) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute z-20 w-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden"
              >
                {isSearching ? (
                  <div className="p-4 text-sm text-slate-500 text-center animate-pulse">Đang rà soát Google Maps...</div>
                ) : (
                  <ul className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                    {searchResults.map((result, idx) => (
                      <li
                        key={idx}
                        className="p-3 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 flex items-start gap-2 transition-colors"
                        onClick={() => handleSelectSearchResult(result)}
                      >
                        <Navigation className="h-4 w-4 text-blue-500 mt-0.5 min-w-4" />
                        <span className="line-clamp-2">{result.display_name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm text-slate-700 shadow-sm whitespace-nowrap sticky left-0 z-10 font-medium">
            <Filter className="h-3.5 w-3.5 text-blue-500" /> Week
          </div>
          {weekOptions.map(week => (
            <button
              key={week}
              onClick={() => setFilterWeek(week)}
              className={\`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all shadow-sm \${
                filterWeek === week 
                  ? 'bg-blue-600 text-white border border-transparent shadow-md transform scale-105' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }\`}
            >
              {week}
            </button>
          ))}
        </div>
      </div>

      {/* Google Maps Container */}
      <div className="flex-1 relative z-0">
         <div ref={mapRef} className="w-full h-full" />
      </div>

      {/* Editing Toolbar */}
      {isEditingLocation && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[1000] drop-shadow-xl" style={{marginTop: '-20px'}}>
           <div className="text-[#FF0000] text-4xl animate-bounce">📍</div>
        </div>
      )}

      {isEditingLocation && (
        <div className="absolute bottom-6 left-4 right-4 z-50 flex gap-3">
          <button
            onClick={() => {
              setIsEditingLocation(false);
              setTempCoords(null);
            }}
            className="flex-1 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-medium shadow-lg hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            Hủy
          </button>
          <button
            // Disable if they haven't explicitly clicked somewhere to define tempCoords
            disabled={!tempCoords && !searchMarker} 
            onClick={handleConfirmLocation}
            className={\`flex-1 py-3 text-white rounded-xl font-medium shadow-lg transition-colors \${
              (!tempCoords && !searchMarker) ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }\`}
          >
             Lưu Vị Trí
          </button>
        </div>
      )}

      {/* Bottom Sheet for Points */}
      <AnimatePresence>
        {selectedCluster && !isEditingLocation && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 z-30"
              onClick={() => setSelectedCluster(null)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl z-40 shadow-2xl max-h-[85vh] flex flex-col"
            >
              <div className="flex-none p-4 pb-2 border-b border-slate-100">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-lg">
                      {selectedCluster.length === 1 ? 'Thông tin cửa hàng' : \`Danh sách điểm (\${selectedCluster.length})\`}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedCluster(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors bg-slate-50 text-slate-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedCluster.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm min-h-[140px] flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                       <span className={\`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium \${
                        item.status === 'Done' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }\`}>
                        {item.status === 'Done' ? 'Đã nghiệm thu' : 'Chưa nghiệm thu'}
                      </span>
                      {selectedCluster.length === 1 && (
                        <button
                          onClick={() => setIsEditingLocation(true)}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center justify-center border border-blue-200 bg-white shadow-sm"
                          title="Sửa ghim vị trí"
                        >
                           <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                           </svg>
                        </button>
                      )}
                    </div>
                    
                    <h4 className="font-bold text-slate-800 text-[15px] mb-1">{item.brand || 'No Brand'}</h4>
                    <p className="text-sm text-slate-600 font-medium mb-1">
                      Mã Job: <span className="text-slate-800">{item.job_code}</span>
                    </p>
                    <div className="flex flex-col gap-1 mt-1 text-sm text-slate-500">
                       <p className="flex items-start gap-1">
                         <span>PIC:</span> <span className="font-medium text-slate-700">{item.pic}</span>
                       </p>
                       <p className="flex items-start gap-1">
                         <span>KV:</span> <span>{item.city} - {item.district}</span>
                       </p>
                    </div>

                    <div className="mt-3 flex gap-2">
                       {item.status !== 'Done' && (
                         <button 
                           onClick={() => window.location.href = '#/report'}
                           className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                         >
                            Báo cáo ngay
                         </button>
                       )}
                       <button
                         onClick={() => {
                           if (window.google) {
                             const url = \`https://www.google.com/maps/dir/?api=1&destination=\${item.lat},\${item.lng}\`;
                             window.open(url, '_blank');
                           }
                         }}
                         className="flex-1 py-2 px-3 bg-white text-blue-600 border border-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 shadow-sm"
                       >
                         Chỉ đường
                       </button>
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
`;
fs.writeFileSync('src/pages/MapView.jsx', code);
