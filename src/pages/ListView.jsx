import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Search, Eye, Calendar, LayoutGrid, CheckCircle, Image as ImageIcon, MapPin, Hash, ExternalLink, Camera, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

const stripAccents = (s) => s?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D') || '';

const ListView = () => {
  const { user, selectedStaff, lastSync, localRefreshTick } = useAuth();
  const location = useLocation();
  const [allItems, setAllItems] = useState([]);
  const [listItems, setListItems] = useState([]);
  const [acceptanceMap, setAcceptanceMap] = useState(new Map());
  const [search, setSearch] = useState(() => sessionStorage.getItem('lv_search') || '');
  const [week, setWeek] = useState(() => sessionStorage.getItem('lv_week') || 'All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [displayCount, setDisplayCount] = useState(() => parseInt(sessionStorage.getItem('lv_count')) || 50);
  const [statusTab, setStatusTab] = useState(() => sessionStorage.getItem('lv_status') || 'pending');
  const [isLoading, setIsLoading] = useState(true);

  // Re-sync filters from sessionStorage whenever navigating to this page
  // This handles the case where ListView is already mounted (not re-mounted)
  useEffect(() => {
    setStatusTab(sessionStorage.getItem('lv_status') || 'pending');
    setWeek(sessionStorage.getItem('lv_week') || 'All');
    setSearch(sessionStorage.getItem('lv_search') || '');
  }, [location.key]);

  // Persistence
  useEffect(() => {
    sessionStorage.setItem('lv_search', search);
    sessionStorage.setItem('lv_week', week);
    sessionStorage.setItem('lv_count', displayCount.toString());
    sessionStorage.setItem('lv_status', statusTab);
  }, [search, week, displayCount, statusTab]);

  // Load Base Data & Join (Optimized for 37k Rows)
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const picId = selectedStaff?.user_id || (user.role === 'staff' ? user.user_id : null);
        
        const [allDbItems, adhocDbItems] = await Promise.all([
          db.posmData.toArray(),
          db.adhocPoints ? db.adhocPoints.toArray() : []
        ]);
        
        // Merge datasets
        const mergedItems = [...allDbItems, ...adhocDbItems];
        setAllItems(mergedItems);
        
        // Apply PIC filter if necessary for the actual list
        let filteredByPic = mergedItems;
        if (picId) {
          const pidNorm = String(picId).trim().toLowerCase();
          const pName = stripAccents(user?.ho_ten || selectedStaff?.ho_ten || '').toLowerCase().trim();
          
          filteredByPic = mergedItems.filter(i => {
             const mPId = String(i.pic_id || '').trim().toLowerCase();
             const mPName = stripAccents(i.pic || '').toLowerCase().trim();
             return (pidNorm && mPId && mPId === pidNorm) || (pName && mPName && mPName === pName);
          });
        }
        
        const acc = await db.acceptanceData.toArray();
        const accMap = new Map();
        acc.forEach(a => accMap.set(a.job_code, a));
        
        setAcceptanceMap(accMap);
        setListItems(filteredByPic); 
      } catch (err) { 
        console.error('ListView Load Error:', err); 
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [selectedStaff, user, lastSync, localRefreshTick]);

  const { filteredItems, uniqueWeeks, uniqueBrands } = useMemo(() => {
    // 1. Derive weeks & brands from user-filtered listItems only (fast + user-scoped)
    //    This avoids loading all brands from 37k rows which is slow and shows irrelevant data.
    const sortedWeeks = [...new Set(listItems.map(i => i.week))].filter(Boolean).sort((a,b) => {
        const numA = parseInt(String(a).match(/\d+/)?.[0]) || 0;
        const numB = parseInt(String(b).match(/\d+/)?.[0]) || 0;
        return numA - numB;
    });
    const brands = ['All', ...new Set(listItems.map(i => i.brand).filter(Boolean))].sort();

    // 2. Filter for Status + Filters (From items visible to user)
    let filtered = listItems;
    if (statusTab === 'pending') {
      filtered = filtered.filter(i => i.status?.toLowerCase() !== 'done' && i.status?.toLowerCase() !== 'hoàn tất');
    } else {
      filtered = filtered.filter(i => i.status?.toLowerCase() === 'done' || i.status?.toLowerCase() === 'hoàn tất');
    }
    
    if (week !== 'All') filtered = filtered.filter(i => i.week === week);
    if (selectedBrand !== 'All') filtered = filtered.filter(i => i.brand === selectedBrand);
    
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(i => 
        i.brand?.toLowerCase().includes(s) || 
        i.job_code?.toLowerCase().includes(s) || 
        i.address?.toLowerCase().includes(s)
      );
    }
    
    return { filteredItems: filtered, uniqueWeeks: sortedWeeks, uniqueBrands: brands };
  }, [allItems, listItems, week, search, selectedBrand, statusTab]);

  const districtGroups = useMemo(() => {
    const groups = {};
    // Group by Week instead of District
    filteredItems.slice(0, displayCount).forEach(item => {
      const w = String(item.week || 'W??').toUpperCase();
      if (!groups[w]) groups[w] = { name: w, items: [], done: 0 };
      groups[w].items.push(item);
      groups[w].done++;
    });
    // Sort by week number descending
    return Object.values(groups).sort((a,b) => {
        const numA = parseInt(a.name.match(/\d+/)?.[0]) || 0;
        const numB = parseInt(b.name.match(/\d+/)?.[0]) || 0;
        return numB - numA;
    });
  }, [filteredItems, displayCount]);

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      <div className="bg-indigo-600 pt-6 pb-20 px-6 rounded-b-[3.5rem] shadow-xl relative z-20 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative mb-6">
           <div className="flex items-center gap-2 mb-2 opacity-60">
              <CheckCircle size={14} className="text-white" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Chi tiết biểu mẫu</span>
           </div>
           <h2 className="text-2xl font-black text-white tracking-tight uppercase">BÁO CÁO CHI TIẾT</h2>
        </div>
        <div className="relative mb-6">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/40" size={20} />
          <input 
            type="text"
            placeholder="Tìm kiếm báo cáo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-16 pr-6 py-5 bg-white/10 border border-white/20 rounded-[2rem] text-white text-base font-bold placeholder-white/30 focus:outline-none focus:bg-white/15"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 relative z-10 mb-4">
          <select value={week} onChange={(e) => setWeek(e.target.value)} className="bg-white/10 text-white text-[10px] font-black uppercase rounded-2xl border border-white/10 px-5 py-4 outline-none appearance-none">
            <option value="All">TUẦN: ALL</option>
            {uniqueWeeks.map(w => <option key={w} value={w}>{w.toUpperCase()}</option>)}
          </select>
          <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="bg-white/10 text-white text-[10px] font-black uppercase rounded-2xl border border-white/10 px-5 py-4 outline-none appearance-none">
            <option value="All">BRAND: ALL</option>
            {uniqueBrands.filter(b => b !== 'All').map(b => <option key={b} value={b}>{b.toUpperCase()}</option>)}
          </select>
        </div>
        
        <div className="flex bg-white/10 p-1.5 rounded-2xl relative z-10 w-full shadow-inner">
          <button 
            onClick={() => setStatusTab('pending')}
            className={`flex-1 py-3.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${statusTab === 'pending' ? 'bg-white text-indigo-600 shadow-md' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            Cần làm
          </button>
          <button 
            onClick={() => setStatusTab('done')}
            className={`flex-1 py-3.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${statusTab === 'done' ? 'bg-emerald-500 text-white shadow-md' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            Đã xong
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-12 space-y-12 pb-32">
        {isLoading ? (
          <div className="text-center py-20 animate-pulse text-slate-400 font-bold uppercase tracking-widest text-[10px]">Đang nạp dữ liệu...</div>
        ) : districtGroups.length === 0 ? (
          <div className="p-20 text-center space-y-4">
             <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Không tìm thấy báo cáo</p>
          </div>
        ) : (
          <AnimatePresence mode='popLayout'>
            {/* PINNED PRIORITY SECTION (Pending Tab Only) */}
            {statusTab === 'pending' && filteredItems.some(i => i.priority) && (
              <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="flex items-center gap-2 px-2">
                  <Zap size={14} className="text-amber-500 fill-amber-500" />
                  <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none">ĐIỂM ƯU TIÊN</h3>
                  <div className="flex-1 h-px bg-amber-100" />
                </div>
                <div className="space-y-6">
                  {filteredItems.filter(i => i.priority).map((item) => (
                    <ListItem key={`${item.job_code}_${item.week}`} item={item} />
                  ))}
                </div>
                <div className="mt-12 mb-6 flex items-center gap-2 px-2">
                  <div className="flex-1 h-px bg-slate-100" />
                  <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">CÁC ĐIỂM CÒN LẠI</h3>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
              </motion.section>
            )}

            {districtGroups.map((group, gIdx) => {
              const groupItems = statusTab === 'pending' 
                ? group.items.filter(i => !i.priority)
                : group.items;
              
              if (groupItems.length === 0) return null;

              return (
                <motion.section key={group.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gIdx * 0.05 }} className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                     <div className="flex items-center gap-3"><div className="w-1 h-5 bg-indigo-600 rounded-full"/><h3 className="text-xs font-black text-slate-800 tracking-widest uppercase">TUẦN: {group.name}</h3></div>
                     <span className="bg-slate-100/50 text-slate-400 text-[10px] font-black px-4 py-1 rounded-full">{groupItems.length} báo cáo</span>
                  </div>
                  <div className="space-y-6">
                    {groupItems.map((item) => (
                      <ListItem key={`${item.job_code}_${item.week}`} item={item} />
                    ))}
                  </div>
                </motion.section>
              );
            })}
          </AnimatePresence>
        )}
        {filteredItems.length > displayCount && (
           <button onClick={() => setDisplayCount(v => v + 50)} className="w-full py-6 bg-white border border-slate-100 rounded-[2.5rem] text-xs font-black text-indigo-600 uppercase tracking-widest active:scale-95 shadow-sm">Xem thêm dữ liệu</button>
        )}
      </div>
    </div>
  );
};

const ListItem = ({ item }) => {
  const isMall = item.mall_name && item.mall_name !== 'N/A' && item.mall_name.trim().length > 0;
  const status = item.posm_status || 'Chưa báo cáo';
  const hasPosm = status.toLowerCase().includes('có') || status.toLowerCase().includes('yes');
  const isDone = item.status?.toLowerCase() === 'done' || item.status?.toLowerCase() === 'hoàn tất';

  return (
    <motion.div 
      layout 
      className={`bg-white p-8 rounded-[3rem] shadow-soft border ${item.priority && !isDone ? 'border-amber-200' : 'border-slate-50'} transition-all relative overflow-hidden`}
    >
      {item.priority && !isDone && (
        <div className="absolute top-0 right-12 transform -translate-y-1">
          <div className="bg-amber-500 text-white px-3 py-1.5 rounded-b-xl flex items-center gap-1 shadow-sm">
            <Zap size={10} className="fill-white" />
            <span className="text-[8px] font-black uppercase tracking-widest">Ưu tiên</span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-lg font-black text-slate-800 tracking-tight uppercase">{item.brand || 'POSM Point'}</h4>
              {item.priority && !isDone && <Zap size={14} className="text-amber-500 fill-amber-500" />}
            </div>
            <div className="flex items-center gap-2 mb-4"><MapPin size={12} className="text-slate-300"/><p className="text-xs font-bold text-slate-400 line-clamp-1">{item.address}</p></div>
           <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-widest ${isDone ? 'bg-indigo-600 text-white border-indigo-700' : item.priority ? 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                {isDone ? 'Đã báo cáo' : 'Chưa làm'}
              </span>
              <span className="text-[9px] font-black bg-slate-50 text-slate-400 px-3 py-1.5 rounded-xl border border-slate-100 uppercase tracking-widest"><Hash size={10} className="inline mr-1" />{item.job_code}</span>
              {isDone && <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl border uppercase ${hasPosm ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{hasPosm ? 'Có POSM' : 'KHÔNG POSM'}</span>}
              {isMall && <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl border border-indigo-100 uppercase tracking-widest">MALL</span>}
           </div>
        </div>
        <Link 
          to={`/detail/${item.job_code}/${encodeURIComponent(item.brand)}`} 
          className={`w-14 h-14 text-white rounded-2xl flex flex-col items-center justify-center transition-all active:scale-90 shadow-lg ${isDone ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : item.priority ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)]'}`}
        >
          {isDone ? <Eye size={24} /> : <><Camera size={20} /><span className="text-[8px] font-black mt-0.5">NỘP</span></>}
        </Link>
      </div>

      <div className="flex gap-3 pt-6 mt-2 border-t border-slate-50">
        <a 
          href={item.image1 || '#'} 
          target={item.image1 ? "_blank" : "_self"} 
          rel="noopener noreferrer" 
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all ${item.image1 ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-slate-100/50 text-slate-300 pointer-events-none'}`}
        >
          <ExternalLink size={14} /> Ảnh 1
        </a>
        <a 
          href={item.image2 || '#'} 
          target={item.image2 ? "_blank" : "_self"} 
          rel="noopener noreferrer" 
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all ${item.image2 ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100' : 'bg-slate-100/50 text-slate-300 pointer-events-none'}`}
        >
          <ExternalLink size={14} /> Ảnh 2
        </a>
      </div>
    </motion.div>
  );
};

export default ListView;
