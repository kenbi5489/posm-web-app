import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Search, Navigation, Eye, FileEdit, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import ReportModal from '../components/ReportModal';

const ListView = () => {
  const { user, selectedStaff } = useAuth();
  const [allItems, setAllItems] = useState([]);
  const [filter, setFilter] = useState(() => sessionStorage.getItem('lv_filter') || 'All');
  const [search, setSearch] = useState(() => sessionStorage.getItem('lv_search') || '');
  const [week, setWeek] = useState(() => sessionStorage.getItem('lv_week') || 'All');
  const [displayCount, setDisplayCount] = useState(() => parseInt(sessionStorage.getItem('lv_count')) || 30);
  const [reportingItem, setReportingItem] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

  // Persistence
  useEffect(() => {
    sessionStorage.setItem('lv_filter', filter);
    sessionStorage.setItem('lv_search', search);
    sessionStorage.setItem('lv_week', week);
    sessionStorage.setItem('lv_count', displayCount.toString());
  }, [filter, search, week, displayCount]);

  // Load Base Data
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await db.posmData.toArray();
        const picId = selectedStaff?.user_id || (user.role === 'staff' ? user.user_id : null);
        let targetData = data;
        if (picId) {
          targetData = data.filter(i => String(i.pic_id || '').toLowerCase() === picId.toString().toLowerCase());
        }
        setAllItems(targetData);
      } catch (err) { console.error('ListView Load Error:', err); }
    };
    loadData();
  }, [selectedStaff, user, dataVersion]);

  // Extract all unique weeks from the dataset
  const weeksList = useMemo(() => [...new Set(allItems.map(i => i.week))].filter(Boolean).sort(), [allItems]);

  // Main Filtering & Grouping
  const districtGroups = useMemo(() => {
    let filtered = allItems;
    
    if (filter === 'Pending') filtered = filtered.filter(i => i.status !== 'Done');
    if (filter === 'Done') filtered = filtered.filter(i => i.status === 'Done');
    if (week !== 'All') filtered = filtered.filter(i => i.week === week);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(i => i.brand?.toLowerCase().includes(s) || i.job_code?.toLowerCase().includes(s) || i.address?.toLowerCase().includes(s));
    }

    const groups = {};
    filtered.forEach(item => {
      const d = String(item.district || 'Khác').toUpperCase();
      if (!groups[d]) groups[d] = { name: d, items: [], done: 0 };
      groups[d].items.push(item);
      if (item.status === 'Done') groups[d].done++;
    });

    return Object.values(groups).sort((a,b) => b.items.length - a.items.length);
  }, [allItems, filter, week, search]);

  const totalPoints = useMemo(() => districtGroups.reduce((s, g) => s + g.items.length, 0), [districtGroups]);

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      {/* Header & Controls - Matching Screenshot 17:23 but with Week Filter */}
      <div className="bg-indigo-600 pt-6 pb-16 px-6 rounded-b-[3.5rem] shadow-xl relative z-20">
        <div className="relative mb-8">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/40" size={20} />
          <input 
            type="text"
            placeholder="Tìm kiếm điểm POSM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-16 pr-6 py-5 bg-white/10 border border-white/20 rounded-[2rem] text-white text-base font-bold placeholder-white/30 focus:outline-none transition-all shadow-inner"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar px-1">
          <CategoryBtn active={filter === 'All'} label="TẤT CẢ" onClick={() => { setFilter('All'); setDisplayCount(30); }} />
          <CategoryBtn active={filter === 'Pending'} label="CHƯA BÁO BÁO" onClick={() => { setFilter('Pending'); setDisplayCount(30); }} />
          <CategoryBtn active={filter === 'Done'} label="HOÀN TẤT" onClick={() => { setFilter('Done'); setDisplayCount(30); }} />
          
          <div className="w-[1px] h-6 bg-white/20 mx-2 shrink-0 self-center" />
          
          <div className="relative">
            <select 
                value={week} 
                onChange={(e) => setWeek(e.target.value)}
                className="bg-white/10 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl border border-white/10 pl-6 pr-10 py-3 outline-none appearance-none min-w-[120px] transition-all focus:bg-white/20"
            >
                <option value="All" className="text-slate-800 font-bold">TUẦN: ALL</option>
                {weeksList.map(w => <option key={w} value={w} className="text-slate-800 font-bold">TUẦN: {w}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                <Calendar size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto px-6 py-10 space-y-12 pb-32 -mt-4">
        <div className="flex justify-between items-center px-2">
            <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">{totalPoints} ĐIỂM TRIỂN KHAI</h3>
            <div className="flex gap-1.5">
               <div className="w-2 h-2 rounded-full bg-indigo-100" />
               <div className="w-2 h-2 rounded-full bg-indigo-50" />
            </div>
        </div>

        <AnimatePresence mode='popLayout'>
          {districtGroups.map((group, gIdx) => (
            <motion.section 
              key={group.name} 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gIdx * 0.05 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between px-3">
                 <div className="flex items-center gap-3">
                    <div className="h-6 w-1 rounded-full bg-indigo-600" />
                    <h4 className="text-base font-black text-slate-800 tracking-tight">{group.name}</h4>
                 </div>
                 <span className="bg-slate-100/50 text-slate-400 text-[10px] font-black px-4 py-1 rounded-full">{group.done}/{group.items.length}</span>
              </div>
              
              <div className="space-y-6">
                {group.items.slice(0, displayCount).map((item) => (
                   <ListItem 
                    key={item.job_code} 
                    item={item} 
                    onReport={() => setReportingItem(item)}
                   />
                ))}
              </div>
            </motion.section>
          ))}
        </AnimatePresence>

        {totalPoints > displayCount && (
           <button 
            onClick={() => setDisplayCount(v => v + 30)}
            className="w-full py-6 bg-white border border-slate-100 rounded-[2.5rem] text-xs font-black text-indigo-600 uppercase tracking-widest shadow-sm active:scale-95 transition-all"
           >
             Trình thêm dữ liệu
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

const CategoryBtn = ({ active, label, onClick }) => (
  <button 
    onClick={onClick}
    className={`whitespace-nowrap px-8 py-3.5 rounded-2xl text-[11px] font-black tracking-widest transition-all ${active ? 'bg-white text-indigo-600 shadow-xl scale-105' : 'bg-transparent text-white/50 hover:bg-white/5'}`}
  >
    {label}
  </button>
);

const ListItem = ({ item, onReport }) => {
  const isDone = item.status === 'Done';
  
  return (
    <motion.div 
      layout
      className={`relative bg-white p-8 rounded-[3rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border transition-all ${isDone ? 'border-slate-50' : 'border-slate-100/50'}`}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 min-w-0 pr-4">
           <div className="flex items-center gap-3 mb-2">
             <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)] shrink-0" />
             <h4 className="text-lg font-black text-slate-800 truncate tracking-tight uppercase">
                {item.brand || 'POSM Point'}
             </h4>
           </div>
           <p className="text-xs font-bold text-slate-300 line-clamp-1 truncate tracking-tight mb-4 opacity-80 leading-relaxed">
             {item.address}
           </p>
           
           <div className="mt-4">
              <span className="text-[10px] font-black bg-slate-50 text-slate-300 px-4 py-1.5 rounded-xl uppercase tracking-widest border border-slate-100">
                #{item.job_code}
              </span>
           </div>
        </div>

        <Link 
          to={`/detail/${item.job_code}/${encodeURIComponent(item.brand)}`}
          className="w-14 h-14 bg-indigo-600 text-white rounded-[1.2rem] flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-90 shadow-lg shadow-indigo-100"
        >
          <Eye size={26} />
        </Link>
      </div>
      
      <div className="flex gap-4">
        <button 
          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${item.lat || item.address},${item.lng || ''}`, '_blank')}
          className="flex-1 py-5 bg-indigo-50 text-indigo-600 text-[11px] font-black uppercase tracking-widest rounded-[1.5rem] flex items-center justify-center gap-2 active:scale-95 transition-all border border-indigo-100/30"
        >
          <Navigation size={18} /> Chỉ đường
        </button>
        <button 
          onClick={onReport}
          disabled={isDone}
          className={`flex-1 py-5 text-[11px] font-black uppercase tracking-widest rounded-[1.5rem] flex items-center justify-center gap-2 transition-all ${isDone ? 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50' : 'bg-indigo-600 text-white shadow-xl active:scale-95 shadow-indigo-100'}`}
        >
          <FileEdit size={18} /> Báo cáo
        </button>
      </div>
    </motion.div>
  );
};

export default ListView;
