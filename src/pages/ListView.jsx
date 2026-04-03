import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, ChevronRight, CheckCircle2, Navigation, MapPin, Eye, FileEdit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import ReportModal from '../components/ReportModal';

const ListView = () => {
  const { user, selectedStaff } = useAuth();
  const [allItems, setAllItems] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [filter, setFilter] = useState(() => sessionStorage.getItem('lv_filter') || 'All');
  const [search, setSearch] = useState(() => sessionStorage.getItem('lv_search') || '');
  const [district, setDistrict] = useState(() => sessionStorage.getItem('lv_district') || 'All');
  const [week, setWeek] = useState(() => sessionStorage.getItem('lv_week') || 'All');
  const [displayCount, setDisplayCount] = useState(() => parseInt(sessionStorage.getItem('lv_count')) || 30);
  const [reportingItem, setReportingItem] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

  // Persistence
  useEffect(() => {
    sessionStorage.setItem('lv_filter', filter);
    sessionStorage.setItem('lv_search', search);
    sessionStorage.setItem('lv_district', district);
    sessionStorage.setItem('lv_week', week);
    sessionStorage.setItem('lv_count', displayCount.toString());
  }, [filter, search, district, week, displayCount]);

  // Load Base Data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [data, checkinData] = await Promise.all([
          db.posmData.toArray(),
          db.checkins ? db.checkins.toArray() : Promise.resolve([])
        ]);
        
        const picId = selectedStaff?.user_id || (user.role === 'staff' ? user.user_id : null);
        let targetData = data;
        if (picId) {
          targetData = data.filter(i => String(i.pic_id || '').toLowerCase() === picId.toString().toLowerCase());
        }
        setAllItems(targetData);
        setCheckins(checkinData);
      } catch (err) { console.error('ListView Load Error:', err); }
    };
    loadData();
  }, [selectedStaff, user, dataVersion]);

  // Derived filter options
  const weeks = useMemo(() => [...new Set(allItems.map(i => i.week))].filter(Boolean).sort(), [allItems]);
  const districtsList = useMemo(() => [...new Set(allItems.map(i => i.district))].filter(Boolean).sort(), [allItems]);

  // Main Filtering & Grouping
  const districtGroups = useMemo(() => {
    let filtered = allItems;
    
    if (filter !== 'All') filtered = filtered.filter(i => i.status === (filter === 'Done' ? 'Done' : 'On-going'));
    if (week !== 'All') filtered = filtered.filter(i => i.week === week);
    if (district !== 'All') filtered = filtered.filter(i => i.district === district);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(i => i.brand?.toLowerCase().includes(s) || i.job_code?.toLowerCase().includes(s) || i.address?.toLowerCase().includes(s));
    }

    const groups = {};
    filtered.forEach(item => {
      const d = String(item.district || 'Khác').trim();
      if (!groups[d]) groups[d] = { name: d, items: [], done: 0 };
      groups[d].items.push(item);
      if (item.status === 'Done') groups[d].done++;
    });

    return Object.values(groups).sort((a,b) => b.items.length - a.items.length);
  }, [allItems, filter, week, district, search]);

  const totalPoints = useMemo(() => districtGroups.reduce((s, g) => s + g.items.length, 0), [districtGroups]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header & Controls */}
      <div className="bg-indigo-700 pt-6 pb-12 px-5 rounded-b-[3.5rem] shadow-premium-indigo sticky top-0 z-20">
        <div className="relative mb-6">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" size={20} />
          <input 
            type="text"
            placeholder="Tìm kiếm điểm POSM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white/10 border border-white/20 rounded-[1.8rem] text-white text-sm font-bold placeholder-white/30 focus:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/5 transition-all"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
          {['All', 'Pending', 'Done'].map(k => (
            <button 
              key={k} 
              onClick={() => setFilter(k)}
              className={`whitespace-nowrap px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${filter === k ? 'bg-white text-indigo-700 border-white shadow-xl' : 'bg-transparent text-white/70 border-white/10 hover:bg-white/10'}`}
            >
              {k === 'All' ? 'Tất cả' : k === 'Pending' ? 'Chưa báo báo' : 'Hoàn tất'}
            </button>
          ))}
          <div className="w-[1px] h-6 bg-white/20 mx-2 shrink-0 self-center" />
          <select 
            value={week} onChange={(e) => setWeek(e.target.value)}
            className="bg-indigo-800/40 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl border border-white/10 px-4 py-2 outline-none appearance-none"
          >
            <option value="All" className="text-slate-800">TUẦN</option>
            {weeks.map(w => <option key={w} value={w} className="text-slate-800">{w}</option>)}
          </select>
        </div>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto px-5 py-8 space-y-10 pb-32 -mt-4">
        <div className="flex justify-between items-center px-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{totalPoints} ĐIỂM TRIỂN KHAI</h3>
            <div className="flex gap-1">
               <div className="w-1.5 h-1.5 rounded-full bg-indigo-200" />
               <div className="w-1.5 h-1.5 rounded-full bg-indigo-100" />
            </div>
        </div>

        <AnimatePresence mode='popLayout'>
          {districtGroups.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-32 text-center space-y-4">
               <Search size={48} className="mx-auto text-slate-100" />
               <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">Không tìm thấy dữ liệu</p>
            </motion.div>
          ) : (
            districtGroups.map((group, gIdx) => (
              <motion.section 
                key={group.name} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gIdx * 0.05 }}
                className="space-y-5"
              >
                <div className="flex items-center justify-between px-3">
                   <div className="flex items-center gap-3">
                      <div className="h-6 w-1 rounded-full bg-indigo-500" />
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{group.name}</h4>
                   </div>
                   <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full">{group.done}/{group.items.length}</span>
                </div>
                
                <div className="space-y-4">
                  {group.items.slice(0, displayCount).map((item, iIdx) => (
                     <ListItem 
                      key={item.job_code} 
                      item={item} 
                      onReport={() => setReportingItem(item)}
                     />
                  ))}
                </div>
              </motion.section>
            ))
          )}
        </AnimatePresence>

        {totalPoints > displayCount && (
           <button 
            onClick={() => setDisplayCount(v => v + 30)}
            className="w-full py-6 bg-white border border-slate-100 rounded-[2.5rem] text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] shadow-soft active:scale-95 transition-all"
           >
             Xem tiếp 30 điểm khác
           </button>
        )}
      </div>

      <AnimatePresence>
        {reportingItem && (
          <ReportModal 
            isOpen={!!reportingItem}
            item={reportingItem}
            user={user}
            onClose={() => setReportingItem(null)}
            onSuccess={() => {
              setReportingItem(null);
              setDataVersion(v => v + 1);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ListItem = ({ item, onReport }) => {
  const isDone = item.status === 'Done';
  
  return (
    <motion.div 
      layout
      className={`relative bg-white p-6 rounded-[2.8rem] shadow-soft border transition-all ${isDone ? 'border-slate-50' : 'border-slate-100 hover:border-indigo-100'}`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0 pr-2">
           <div className="flex items-center gap-2 mb-2">
             <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isDone ? 'bg-green-500 shadow-green-200' : 'bg-amber-400 shadow-amber-100'} shadow-[0_0_10px]`} />
             <h4 className={`text-base font-black truncate tracking-tight ${isDone ? 'text-slate-400' : 'text-slate-800'}`}>
                {item.brand || 'POSM Point'}
             </h4>
           </div>
           <p className="text-[10px] font-bold text-slate-400 line-clamp-1 uppercase tracking-tighter ml-4.5 mb-4 opacity-70">
             {item.address}
           </p>
           
           <div className="flex flex-wrap gap-2 ml-4.5">
              <span className="text-[9px] font-black bg-slate-50 text-slate-400 px-3 py-1 rounded-full uppercase tracking-widest border border-slate-100">
                #{item.job_code}
              </span>
              {isDone && (
                 <span className="text-[9px] font-black bg-green-50 text-green-600 px-3 py-1 rounded-full uppercase tracking-widest border border-green-100">
                   HOÀN TẤT
                 </span>
              )}
           </div>
        </div>

        <div className="flex gap-2">
           <Link 
            to={`/detail/${item.job_code}/${encodeURIComponent(item.brand)}`}
            className="w-12 h-12 bg-slate-50 text-slate-300 rounded-[1.2rem] flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90"
          >
            <Eye size={22} />
          </Link>
        </div>
      </div>
      
      {!isDone && (
        <div className="mt-8 flex gap-3">
          <button 
            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${item.lat || item.address},${item.lng || ''}`, '_blank')}
            className="flex-1 py-4 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-[0.1em] rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all border border-indigo-100/50"
          >
            <Navigation size={16} /> Chỉ đường
          </button>
          <button 
            onClick={onReport}
            className="flex-1 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.1em] rounded-2xl flex items-center justify-center gap-2 shadow-premium active:scale-95 transition-all"
          >
            <FileEdit size={16} /> Báo cáo
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default ListView;
