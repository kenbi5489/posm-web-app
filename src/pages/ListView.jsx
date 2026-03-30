import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Search, Filter, ChevronRight, CheckCircle2, Clock, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const ListView = () => {
  const { user, selectedStaff } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState(() => sessionStorage.getItem('lv_filter') || 'All');
  const [search, setSearch] = useState(() => sessionStorage.getItem('lv_search') || '');
  const [district, setDistrict] = useState(() => sessionStorage.getItem('lv_district') || 'All');
  const [districts, setDistricts] = useState([]);
  const [week, setWeek] = useState(() => sessionStorage.getItem('lv_week') || 'All');
  const [weeks, setWeeks] = useState([]);
  const [displayCount, setDisplayCount] = useState(() => parseInt(sessionStorage.getItem('lv_count')) || 20);
  
  const isFirstRender = useRef(true);

  // Save state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('lv_filter', filter);
    sessionStorage.setItem('lv_search', search);
    sessionStorage.setItem('lv_district', district);
    sessionStorage.setItem('lv_week', week);
    sessionStorage.setItem('lv_count', displayCount.toString());
  }, [filter, search, district, week, displayCount]);

  useEffect(() => {
    const loadItems = async () => {
      let data = await db.posmData.toArray();
      const picId = selectedStaff?.user_id || (user.role === 'staff' ? user.user_id : null);
      const staffName = selectedStaff?.ho_ten || (user.role === 'staff' ? user.ho_ten : null);
      
      if (picId) {
        data = data.filter(item => item.pic_id === picId || item.pic === staffName);
      }
      
      const uniqueDistricts = [...new Set(data.map(i => i.district))].filter(Boolean).sort();
      setDistricts(uniqueDistricts);

      const uniqueWeeks = [...new Set(data.map(i => i.week))].filter(Boolean).sort();
      setWeeks(uniqueWeeks);

      // Apply Filters
      if (filter !== 'All') {
        data = data.filter(item => item.status === (filter === 'Done' ? 'Done' : 'On-going'));
      }
      if (district !== 'All') {
        data = data.filter(item => item.district === district);
      }
      if (week !== 'All') {
        data = data.filter(item => item.week === week);
      }
      if (search) {
        const s = search.toLowerCase();
        data = data.filter(item => 
          item.brand?.toLowerCase().includes(s) || 
          item.job_code?.toLowerCase().includes(s)
        );
      }

      setItems(data);
      if (!isFirstRender.current) {
        setDisplayCount(20); // Reset count when filters change (but not on initial load)
      }
      isFirstRender.current = false;
    };

    loadItems();
  }, [user, filter, search, district, week, selectedStaff]);
  const loadMore = () => setDisplayCount(prev => prev + 20);

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      {/* Search & Filters */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 py-4 space-y-3 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Tìm Brand hoặc Mã..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-soft text-sm font-bold placeholder-slate-300 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
          <FilterTab active={filter === 'All'} label="Tất cả" onClick={() => setFilter('All')} />
          <FilterTab active={filter === 'Pending'} label="Chưa" onClick={() => setFilter('Pending')} />
          <FilterTab active={filter === 'Done'} label="Xong" onClick={() => setFilter('Done')} />
          
          <div className="h-10 border-r border-slate-200 mx-1 shrink-0" />
          
          <select 
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="h-10 px-4 bg-white border-none rounded-xl shadow-soft text-xs font-black uppercase tracking-tight text-slate-600 focus:ring-0 shrink-0"
          >
            <option value="All">Tuần</option>
            {weeks.map(w => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          <select 
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="h-10 px-4 bg-white border-none rounded-xl shadow-soft text-xs font-black uppercase tracking-tight text-slate-600 focus:ring-0 shrink-0"
          >
            <option value="All">Quận</option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Header */}
      <div className="px-5 py-2.5 flex justify-between items-center bg-white/50 border-b border-slate-100">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {items.length} điểm {filter !== 'All' ? `(${filter.toLowerCase()})` : ''}
        </span>
        <div className="flex gap-3">
           <div className="flex items-center gap-1 text-done font-bold text-[10px]">
             <div className="w-1.5 h-1.5 rounded-full bg-done" /> {items.filter(i => i.status === 'Done').length}
           </div>
           <div className="flex items-center gap-1 text-accent font-bold text-[10px]">
             <div className="w-1.5 h-1.5 rounded-full bg-accent" /> {items.filter(i => i.status !== 'Done').length}
           </div>
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3 pb-32">
        <AnimatePresence mode='popLayout'>
          {items.slice(0, displayCount).map((item) => (
            <motion.div
              key={item.job_code}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              layout
            >
              <ListItem item={item} />
            </motion.div>
          ))}
        </AnimatePresence>
        
        {items.length > displayCount && (
          <button 
            onClick={loadMore}
            className="w-full py-6 text-[10px] font-black text-primary uppercase tracking-widest bg-white rounded-2xl border-2 border-dashed border-slate-100 active:bg-slate-50 transition-colors"
          >
            Xem thêm 20 điểm khác (+{items.length - displayCount} còn lại)
          </button>
        )}
        
        {items.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-100 rounded-full mx-auto flex items-center justify-center text-slate-300">
               <Search size={32} />
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Không tìm thấy dữ liệu</p>
          </div>
        )}
      </div>
    </div>
  );
};

const FilterTab = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    className={`whitespace-nowrap h-10 px-5 rounded-xl text-xs font-black uppercase tracking-tight transition-all duration-200 ${
      active 
        ? 'bg-primary text-white shadow-premium' 
        : 'bg-white text-slate-500 shadow-soft'
    }`}
  >
    {label}
  </button>
);

const ListItem = ({ item }) => {
  const isDone = item.status === 'Done';
  
  return (
    <Link to={`/detail/${item.job_code}/${encodeURIComponent(item.brand)}`} className="block bg-white rounded-3xl p-5 shadow-soft border border-slate-50 active:scale-[0.98] transition-transform">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="text-base font-black text-slate-800 leading-tight">{item.brand}</h4>
          <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full uppercase tracking-tighter">
            {item.job_code}
          </span>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
          isDone ? 'bg-green-50 text-done border border-green-100' : 'bg-orange-50 text-accent border border-orange-100'
        }`}>
          {isDone ? 'Đã xong' : 'Chưa xong'}
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold mt-3">
        <MapPin size={14} className="text-slate-300" />
        <span className="truncate">{item.district}, {item.city}</span>
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Chi tiết</span>
        <ChevronRight size={16} className="text-slate-200" />
      </div>
    </Link>
  );
};

export default ListView;
