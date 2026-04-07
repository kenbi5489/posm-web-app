import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Search, Eye, Calendar, LayoutGrid, CheckCircle, Image as ImageIcon, MapPin, Hash, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const ListView = () => {
  const { user, selectedStaff } = useAuth();
  const [allItems, setAllItems] = useState([]);
  const [acceptanceMap, setAcceptanceMap] = useState(new Map());
  const [search, setSearch] = useState(() => sessionStorage.getItem('lv_search') || '');
  const [week, setWeek] = useState(() => sessionStorage.getItem('lv_week') || 'All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [showImages, setShowImages] = useState(false);
  const [displayCount, setDisplayCount] = useState(() => parseInt(sessionStorage.getItem('lv_count')) || 30);
  const [dataVersion, setDataVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Persistence
  useEffect(() => {
    sessionStorage.setItem('lv_search', search);
    sessionStorage.setItem('lv_week', week);
    sessionStorage.setItem('lv_count', displayCount.toString());
  }, [search, week, displayCount]);

  // Performance Optimized Load: Only fetch 'Done' items for the relevant user
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const picId = selectedStaff?.user_id || (user.role === 'staff' ? user.user_id : null);
        
        let posmPromise;
        if (picId) {
          // Indexed query on pic_id + status (approx via where/filter)
          posmPromise = db.posmData.where('pic_id').equals(picId.toString()).and(i => i.status === 'Done').toArray();
        } else {
          // Admin view: limiting to Done items to avoid 37k row lag
          posmPromise = db.posmData.where('status').equals('Done').toArray();
        }

        const [posm, acc] = await Promise.all([
          posmPromise,
          db.acceptanceData.toArray() // Acceptance is usually smaller than master data
        ]);
        
        const accMap = new Map();
        acc.forEach(a => accMap.set(a.job_code, a));
        setAcceptanceMap(accMap);
        setAllItems(posm);
      } catch (err) { 
        console.error('ListView Load Error:', err); 
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [selectedStaff, user, dataVersion]);

  const uniqueBrands = useMemo(() => {
    return ['All', ...new Set(allItems.map(i => i.brand).filter(Boolean))].sort();
  }, [allItems]);

  const weeksList = useMemo(() => [...new Set(allItems.map(i => i.week))].filter(Boolean).sort((a,b) => (parseInt(a.replace(/\D/g,''))||0) - (parseInt(b.replace(/\D/g,''))||0)), [allItems]);

  const getWeekLabel = (w) => {
    if (w === 'All') return 'TUẦN: TẤT CẢ';
    const sample = allItems.find(i => i.week === w);
    if (!sample || !sample.date_assigned) return `TUẦN: ${w}`;
    const match = sample.date_assigned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return `W${w.replace(/\D/g,'')} (T.${match[2]})`;
    return `TUẦN: ${w}`;
  };

  const filteredItems = useMemo(() => {
    let filtered = allItems; // already pre-filtered for 'Done' status in loadData
    
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
    return filtered;
  }, [allItems, week, search, selectedBrand]);

  const districtGroups = useMemo(() => {
    const groups = {};
    filteredItems.forEach(item => {
      const d = String(item.district || 'Khác').toUpperCase();
      if (!groups[d]) groups[d] = { name: d, items: [], done: 0 };
      groups[d].items.push(item);
      groups[d].done++;
    });
    return Object.values(groups).sort((a,b) => b.items.length - a.items.length);
  }, [filteredItems]);

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
            className="w-full pl-16 pr-6 py-5 bg-white/10 border border-white/20 rounded-[2rem] text-white text-base font-bold placeholder-white/30 focus:outline-none focus:bg-white/15 shadow-inner"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 relative z-10 mb-6">
          <select value={week} onChange={(e) => setWeek(e.target.value)} className="bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl border border-white/10 px-5 py-4 outline-none appearance-none">
            <option value="All" className="text-slate-800">TUẦN: ALL</option>
            {weeksList.map(w => <option key={w} value={w} className="text-slate-800">{getWeekLabel(w).toUpperCase()}</option>)}
          </select>
          <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl border border-white/10 px-5 py-4 outline-none appearance-none">
            <option value="All" className="text-slate-800">BRAND: ALL</option>
            {uniqueBrands.filter(b => b !== 'All').map(b => <option key={b} value={b} className="text-slate-800">{b.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-end px-2">
            <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={showImages} onChange={(e) => setShowImages(e.target.checked)} className="hidden" />
                <span className="text-[10px] font-black text-white/70 group-active:text-white uppercase tracking-widest">Xem hình ảnh (Link)</span>
                <div className={`w-10 h-6 rounded-full p-1 transition-all duration-300 ${showImages ? 'bg-emerald-500' : 'bg-white/20'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 ${showImages ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
            </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-12 space-y-12 pb-32">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
             <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tải dữ liệu...</p>
          </div>
        ) : districtGroups.length === 0 ? (
          <div className="p-20 text-center space-y-4">
             <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300">
                <LayoutGrid size={32} />
             </div>
             <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Không tìm thấy báo cáo</p>
          </div>
        ) : (
          <AnimatePresence mode='popLayout'>
            {districtGroups.map((group, gIdx) => (
              <motion.section key={group.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gIdx * 0.05 }} className="space-y-6">
                <div className="flex items-center justify-between px-2">
                   <div className="flex items-center gap-3"><div className="w-1 h-5 bg-indigo-600 rounded-full"/><h3 className="text-xs font-black text-slate-800 tracking-widest uppercase">{group.name}</h3></div>
                   <span className="bg-slate-100/50 text-slate-400 text-[10px] font-black px-4 py-1 rounded-full">{group.done}/XONG</span>
                </div>
                <div className="space-y-6">
                  {group.items.slice(0, displayCount).map((item) => (
                     <ListItem key={item.job_code} item={item} report={acceptanceMap.get(item.job_code)} showImages={showImages} />
                  ))}
                </div>
              </motion.section>
            ))}
          </AnimatePresence>
        )}
        {filteredItems.length > displayCount && (
           <button onClick={() => setDisplayCount(v => v + 30)} className="w-full py-6 bg-white border border-slate-100 rounded-[2.5rem] text-xs font-black text-indigo-600 uppercase tracking-widest active:scale-95 shadow-sm">Xem thêm dữ liệu</button>
        )}
      </div>
    </div>
  );
};

const ListItem = ({ item, report, showImages }) => {
  const isMall = item.mall_name && item.mall_name !== 'N/A' && item.mall_name.trim().length > 0;
  const status = item.posm_status || 'K. POSM';
  const hasPosm = status.toLowerCase().includes('có') || status.toLowerCase().includes('yes');

  return (
    <motion.div layout className="bg-white p-8 rounded-[3rem] shadow-soft border border-slate-50 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0 pr-4">
            <h4 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-tight mb-2">{item.brand || 'POSM Point'}</h4>
            <div className="flex items-center gap-2 mb-4"><MapPin size={12} className="text-slate-300"/><p className="text-xs font-bold text-slate-400 line-clamp-1 tracking-tight">{item.address}</p></div>
           <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-black bg-slate-50 text-slate-400 px-3 py-1.5 rounded-xl border border-slate-100 uppercase tracking-widest"><Hash size={10} className="inline mr-1" />{item.job_code}</span>
              <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-widest ${hasPosm ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{hasPosm ? 'Có POSM' : 'K. POSM'}</span>
              {isMall && <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl border border-indigo-100 uppercase tracking-widest">MALL</span>}
           </div>
        </div>
        <Link to={`/detail/${item.job_code}/${encodeURIComponent(item.brand)}`} className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-90 shadow-lg shadow-indigo-100"><Eye size={24} /></Link>
      </div>

      {showImages && report && (report.image1 || report.image2) && (
        <div className="flex gap-3 pt-4 border-t border-slate-50">
            {report.image1 && (
                <a href={report.image1} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors">
                  <ExternalLink size={14} /> Ảnh 1
                </a>
            )}
            {report.image2 && (
                <a href={report.image2} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors">
                  <ExternalLink size={14} /> Ảnh 2
                </a>
            )}
        </div>
      )}
    </motion.div>
  );
};

export default ListView;
