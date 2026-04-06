import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle, Navigation, ChevronRight, LayoutGrid, Map as MapIcon, TriangleAlert, Eye, FileEdit } from 'lucide-react';

import ReportModal from '../components/ReportModal';

// --- Simple VisitedModal removed in favor of direct ReportModal ---

const MapView = () => {
  const { user, selectedStaff } = useAuth();
  const [allItems, setAllItems] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [dataVersion, setDataVersion] = useState(0);
  const [editingItem, setEditingItem] = useState(null);
  const [expandedDistrict, setExpandedDistrict] = useState(null);

  // Load data
  useEffect(() => {
    const load = async () => {
      try {
        const data = await db.posmData.toArray();
        const checkinData = db.checkins ? await db.checkins.toArray() : [];
        setAllItems(data.map(i => ({
          ...i,
          week: String(i.week || '').trim(),
          district: String(i.district || i.Quận || 'Cụm khác').trim(),
        })));
        setCheckins(checkinData);
      } catch (err) { console.error(err); }
    };
    load();
  }, [dataVersion]);

  // Map checkins for quick lookup
  const visitedSet = useMemo(() => new Set(checkins.map(c => c.job_code)), [checkins]);

  // Current Week logic (W14+)
  const latestWeek = useMemo(() => {
    const weeks = [...new Set(allItems.map(i => i.week).filter(Boolean))];
    const filtered = weeks.filter(w => {
      const n = parseInt(w.replace(/\D/g, ''), 10) || 0;
      return n >= 14 && n < 50;
    });
    return filtered.sort((a,b) => (parseInt(a.replace(/\D/g,''))||0)-(parseInt(b.replace(/\D/g,''))||0)).slice(-1)[0] || '';
  }, [allItems]);

  // Group by District
  const districtGroups = useMemo(() => {
    const groups = {};
    const filtered = allItems.filter(i => i.week === latestWeek);
    
    // Admin/Staff filter
    let targetData = filtered;
    if (selectedStaff || user?.role === 'staff') {
      const targetId = (selectedStaff?.user_id || user?.user_id || '').toString().toLowerCase();
      targetData = filtered.filter(i => String(i.pic_id || '').toLowerCase() === targetId);
    }

    targetData.forEach(item => {
      const d = item.district;
      if (!groups[d]) groups[d] = { name: d, items: [], done: 0 };
      const isDone = visitedSet.has(item.job_code) || item.status === 'Done';
      groups[d].items.push({ ...item, isDone });
      if (isDone) groups[d].done++;
    });
    
    // Sort districts: in-progress first, then alphabetically
    return Object.values(groups).sort((a,b) => {
      const aDone = a.done === a.items.length;
      const bDone = b.done === b.items.length;
      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [allItems, latestWeek, visitedSet, selectedStaff, user]);

  return (
    <div className="h-full bg-slate-50 overflow-y-auto pb-32 animate-fade-in">
      {/* Dynamic Route Header */}
      <div className="bg-indigo-700 pt-10 pb-12 px-6 rounded-b-[3.5rem] shadow-premium-indigo text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
             <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{latestWeek || 'TUẦN HIỆN TẠI'}</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-2">Tuyến đường hôm nay</h2>
          <p className="text-indigo-100 text-sm font-medium opacity-70">
            {districtGroups.length} khu vực triển khai chính
          </p>
        </div>
      </div>

      <div className="px-5 -mt-6 space-y-6 relative z-10">
        {districtGroups.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-12 text-center shadow-soft border border-slate-100">
            <TriangleAlert className="mx-auto text-slate-200 mb-4" size={48} />
            <p className="text-slate-400 font-black text-sm uppercase tracking-widest">Chưa có kế hoạch tuần</p>
          </div>
        ) : (
          districtGroups.map((group, idx) => (
            <div key={group.name} className="space-y-4">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex items-center justify-between bg-white p-5 rounded-[2rem] shadow-premium border transition-all ${expandedDistrict === group.name ? 'ring-2 ring-indigo-500' : 'border-slate-50'}`}
                onClick={() => setExpandedDistrict(expandedDistrict === group.name ? null : group.name)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${group.done === group.items.length ? 'bg-green-100 text-green-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {group.done === group.items.length ? <CheckCircle size={22} /> : <MapIcon size={22} />}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg leading-tight">{group.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                        {group.done}/{group.items.length} HOÀN THÀNH
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black text-slate-300 uppercase">TIẾN ĐỘ</p>
                      <p className="text-xs font-black text-slate-700">{Math.round((group.done/group.items.length)*100)}%</p>
                   </div>
                   <div className={`p-2 rounded-xl bg-slate-50 text-slate-400 transition-transform ${expandedDistrict === group.name ? 'rotate-90' : ''}`}>
                      <ChevronRight size={18} />
                   </div>
                </div>
              </motion.div>

              <AnimatePresence>
                {expandedDistrict === group.name && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden ml-6 space-y-3"
                  >
                    {group.items.map((item, i) => (
                      <div 
                        key={item.job_code} 
                        className={`p-5 rounded-[1.8rem] shadow-soft border transition-all ${item.isDone ? 'bg-slate-50/50 border-slate-100 opacity-60' : 'bg-white border-slate-50'}`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="min-w-0">
                            <h4 className={`text-sm font-black truncate leading-tight ${item.isDone ? 'text-slate-400' : 'text-slate-800'}`}>
                              {item.brand || 'POSM Point'}
                            </h4>
                            <p className="text-[10px] font-bold text-slate-400 line-clamp-1 mt-1 uppercase">{item.address}</p>
                          </div>
                          {item.isDone ? (
                            <div className="flex gap-2 shrink-0">
                               <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-500">
                                  <CheckCircle size={16} />
                               </div>
                               <Link 
                                to={`/detail/${item.job_code}/${encodeURIComponent(item.brand)}`}
                                className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center active:scale-95 transition-all"
                               >
                                 <ChevronRight size={16} />
                               </Link>
                            </div>
                          ) : (
                            <div className="flex gap-2 shrink-0">
                              <button 
                                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`, '_blank')}
                                className="w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-premium-indigo flex items-center justify-center active:scale-95 transition-all"
                              >
                                <Navigation size={18} />
                              </button>
                              <button 
                                onClick={() => setEditingItem(item)}
                                className="w-10 h-10 bg-white text-indigo-600 border border-indigo-100 rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-all hover:bg-indigo-50"
                              >
                                <FileEdit size={18} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {editingItem && (
          <ReportModal 
            isOpen={!!editingItem} 
            item={editingItem} 
            user={user}
            onClose={() => setEditingItem(null)} 
            onSuccess={() => { setEditingItem(null); setDataVersion(v => v + 1); }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MapView;
