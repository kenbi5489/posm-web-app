import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Loader } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { MapPin, Navigation, Info, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const MapView = ({ apiKey = '' }) => {
  const { user, selectedStaff } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const inputRef = useRef(null);
  const [map, setMap] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    const loadMap = async () => {
      const activeKey = apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!activeKey) return; // Must have an API key to initialize JS API
      
      const loader = new Loader({
        apiKey: activeKey,
        version: "weekly",
      });

      const { Map } = await loader.importLibrary("maps");
      const { SearchBox } = await loader.importLibrary("places");
      
      const newMap = new Map(mapRef.current, {
        center: { lat: 10.762622, lng: 106.660172 }, // Default to HCM City
        zoom: 12,
        mapId: 'POSM_MAP_ID',
        disableDefaultUI: true,
        zoomControl: true,
      });

      setMap(newMap);

      if (inputRef.current) {
        const searchBox = new SearchBox(inputRef.current);
        searchBox.addListener("places_changed", () => {
          const places = searchBox.getPlaces();
          if (places.length == 0) return;
          
          const bounds = new google.maps.LatLngBounds();
          places.forEach((place) => {
            if (!place.geometry || !place.geometry.location) return;
            if (place.geometry.viewport) {
              bounds.union(place.geometry.viewport);
            } else {
              bounds.extend(place.geometry.location);
            }
          });
          newMap.fitBounds(bounds);
        });
      }
    };

    loadMap();
  }, [apiKey]);

  useEffect(() => {
    const loadData = async () => {
      let data = await db.posmData.toArray();
      const picId = selectedStaff?.user_id || (user.role === 'staff' ? user.user_id : null);
      const staffName = selectedStaff?.ho_ten || (user.role === 'staff' ? user.ho_ten : null);
      
      if (picId) {
        data = data.filter(item => item.pic_id === picId || item.pic === staffName);
      }
      
      if (filter !== 'All') {
        data = data.filter(item => item.status === (filter === 'Done' ? 'Done' : 'On-going'));
      }
      
      setItems(data);
    };
    loadData();
  }, [user, filter, selectedStaff]);

  useEffect(() => {
    if (!map || items.length === 0) return;

    // Clear existing markers (basic implementation)
    // In a production app, you'd manage marker instances more carefully
    
    const markers = [];
    const groupedByLocation = {};

    items.forEach(item => {
      const key = `${item.lat},${item.lng}`;
      if (!groupedByLocation[key]) {
        groupedByLocation[key] = [];
      }
      groupedByLocation[key].push(item);
    });

    Object.entries(groupedByLocation).forEach(([key, locationItems]) => {
      const [lat, lng] = key.split(',').map(Number);
      if (isNaN(lat) || !lat) return;

      const allDone = locationItems.every(i => i.status === 'Done');
      const allPending = locationItems.every(i => i.status !== 'Done');
      
      const color = allDone ? '#2E7D32' : allPending ? '#E65100' : '#F57C00';
      
      const marker = new google.maps.Marker({
        position: { lat, lng },
        label: locationItems.length > 1 ? {
          text: locationItems.length.toString(),
          color: 'white',
          fontSize: '12px',
          fontWeight: 'bold'
        } : null,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
          scale: locationItems.length > 1 ? 15 : 10,
        }
      });

      marker.addListener('click', () => {
        setSelectedCluster(locationItems);
      });

      markers.push(marker);
    });

    const clusterer = new MarkerClusterer({ map, markers });

    // Center map on first marker if available
    if (markers.length > 0) {
      map.setCenter(markers[0].getPosition());
    }

    return () => {
      clusterer.clearMarkers();
    };
  }, [map, items]);

  return (
    <div className="relative min-h-[calc(100vh-140px)] w-full bg-slate-100 overflow-hidden flex flex-col">
      {!(apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY) && (
        <div className="absolute inset-0 z-20 bg-slate-200 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm mb-4 bg-yellow-100 text-yellow-800 p-4 rounded-2xl text-center shadow-sm text-xs font-bold ring-1 ring-yellow-400">
             Tính năng gom cụm Bản đồ nâng cao đang tạm khóa (Chưa cấu hình API Key). <br/> Dưới đây là chế độ xem cơ bản:
          </div>
          <div className="w-full h-[60vh] rounded-3xl overflow-hidden shadow-inner border border-slate-300">
            <iframe
            title="Google Maps Fallback"
            width="100%"
            height="100%"
            frameBorder="0"
            style={{ border: 0 }}
            src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d14896.602758117962!2d105.793437!3d21.007424!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1svi!2sVN!4v1700000000000!5m2!1svi!2sVN"
            allowFullScreen
          />
          </div>
        </div>
      )}

      <div ref={mapRef} className="h-full w-full" />

      {/* Floating Filter & Search */}
      <div className="absolute top-4 left-4 right-4 flex flex-col gap-3 z-10 pointer-events-none">
        <input 
          ref={inputRef}
          type="text"
          placeholder="Tìm địa chỉ (Google Maps)..."
          className="w-full h-12 px-6 rounded-[1.5rem] bg-white text-slate-800 font-bold shadow-premium border-none focus:ring-2 focus:ring-primary pointer-events-auto"
        />
        <div className="flex gap-2 overflow-x-auto pb-2 pointer-events-auto scrollbar-hide">
          <MapFilterTab active={filter === 'All'} label="Tất cả" onClick={() => setFilter('All')} />
          <MapFilterTab active={filter === 'Pending'} label="Chưa xong" onClick={() => setFilter('Pending')} />
          <MapFilterTab active={filter === 'Done'} label="Đã xong" onClick={() => setFilter('Done')} />
        </div>
      </div>

      {/* Bottom Sheet */}
      <AnimatePresence>
        {selectedCluster && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCluster(null)}
              className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-30"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] shadow-premium z-40 max-h-[70vh] flex flex-col"
            >
              <div className="p-6 flex justify-between items-center border-b border-slate-50">
                <div>
                   <h3 className="text-xl font-black text-slate-900 tracking-tight">
                     {selectedCluster.length} địa điểm
                   </h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedCluster[0].address}</p>
                </div>
                <button onClick={() => setSelectedCluster(null)} className="p-2 bg-slate-50 rounded-full text-slate-400">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe">
                {selectedCluster.map((item, idx) => (
                  <div 
                    key={`${item.job_code}-${idx}`}
                    onClick={() => navigate(`/detail/${item.job_code}/${encodeURIComponent(item.brand)}`)}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl active:bg-slate-100 transition-colors"
                  >
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-800 truncate">{item.brand}</h4>
                      <p className="text-[10px] font-black text-primary uppercase tracking-tighter">{item.job_code}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`w-2 h-2 rounded-full ${item.status === 'Done' ? 'bg-done' : 'bg-accent'}`} />
                      <ChevronRight size={16} className="text-slate-300" />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="p-4 pt-0">
                 <button 
                  onClick={() => {
                    const dest = `${selectedCluster[0].address}, ${selectedCluster[0].district}, ${selectedCluster[0].city}`;
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, '_blank');
                  }}
                  className="w-full bg-primary text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-premium"
                 >
                   <Navigation size={20} />
                   <span>DẪN ĐƯỜNG</span>
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const MapFilterTab = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`whitespace-nowrap h-10 px-6 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-200 border-2 ${
      active 
        ? 'bg-primary text-white border-primary shadow-premium' 
        : 'bg-white text-slate-600 border-white shadow-soft'
    }`}
  >
    {label}
  </button>
);

export default MapView;
