import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Search, Navigation, Eye, FileEdit, Calendar, LayoutGrid, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const ListView = () => {
  const { user, selectedStaff } = useAuth();
  const [allItems, setAllItems] = useState([]);
  const [search, setSearch] = useState(() => sessionStorage.getItem('lv_search') || '');
  const [week, setWeek] = useState(() => sessionStorage.getItem('lv_week') || 'All');
  const [displayCount, setDisplayCount] = useState(() => parseInt(sessionStorage.getItem('lv_count')) || 30);
  const [dataVersion, setDataVersion] = useState(0);

  // Persistence
  useEffect(() => {
    sessionStorage.setItem('lv_search', search);
    sessionStorage.setItem('lv_week', week);
    sessionStorage.setItem('lv_count', displayCount.toString());
  }, [search, week, displayCount]);

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
  }, [selectedStaff, user, dataVersion, dataVersion]);

  // Helper to get Week Label with Month
  const getWeekLabel = (w) => {
    if (w === 'All') return 'TUẦN: TẤT CẢ';
    const sample = allItems.find(i => i.week === w);
    if (!sample || !sample.date_assigned) return `TUẦN: ${w}`;
    const match = sample.date_assigned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      return `W${w.replace(/\D/g,'')} (T.${match[2]})`;
    }
    return `TUẦN: ${w}`;
  };

  // Extract all unique weeks
  const weeksList = useMemo(() => [...new Set(allItems.map(i => i.week))].filter(Boolean).sort((a,b) => (parseInt(a.replace(/\D/g,''))||0) - (parseInt(b.replace(/\D/g,''))||0)), [allItems]);

  // Filtering & Grouping (Report History Only)
  const districtGroups = useMemo(() => {
    let filtered = allItems.filter(i => i.status === 'Done');
    
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
      groups[d].done++;
    });

    return Object.values(groups).sort((a,b) => b.items.length - a.items.length);
  }, [allItems, week, search]);

  const totalPoints = useMemo(() => districtGroups.reduce((s, g) => s + g.items.length, 0), [districtGroups]);

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      {/* Header - "LỊCH SỬ BÁO CÁO" */}
      <div className="bg-indigo-600 pt-6 pb-16 px-6 rounded-b-[3.5rem] shadow-xl relative z-20 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        
        <div className="relative mb-6">
           <div className="flex items-center gap-2 mb-2 opacity-60">
              <CheckCircle size={14} className="text-white" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Kế hoạch đã triển khai</span>
           </div>
           <h2 className="text-2xl font-black text-white tracking-tight uppercase">Lịch sử báo cáo</h2>
        </div>

        <div className="relative mb-10">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/40" size={20} />
          <input 
            type="text"
            placeholder="Tìm kiếm báo cáo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-16 pr-6 py-5 bg-white/10 border border-white/20 rounded-[2rem] text-white text-base font-bold placeholder-white/30 focus:outline-none transition-all shadow-inner focus:bg-white/15"
          />
        </div>

        <div className="flex items-center gap-3 relative z-10">
             <div className="flex-1 relative">
                <select 
                    value={week} 
                    onChange={(e) => setWeek(e.target.value)}
                    className="w-full bg-white/10 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl border border-white/10 pl-6 pr-10 py-4 outline-none appearance-none transition-all focus:bg-white/20 shadow-sm"
                >
                    <option value="All" className="text-slate-800 font-bold">TUẦN: CẢ THÁNG</option>
                    {weeksList.map(w => <option key={w} value={w} className="text-slate-800 font-bold">{getWeekLabel(w).toUpperCase()}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40">
                    <Calendar size={16} />
                </div>
            </div>
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto px-6 py-12 space-y-12 pb-32">
        {districtGroups.length === 0 ? (
          <div className="p-20 text-center space-y-4">
             <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300">
                <LayoutGrid size={32} />
             </div>
             <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest leading-relaxed">Chưa có báo cáo hoàn tất<br/>trong danh sách này</p>
          </div>
        ) : (
          <AnimatePresence mode='popLayout'>
            {districtGroups.map((group, gIdx) => (
              <motion.section 
                key={group.name} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gIdx * 0.05 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between px-2">
                   <div className="flex items-center gap-3">
                      <div className="w-1 h-5 bg-indigo-600 rounded-full" />
                      <h3 className="text-xs font-black text-slate-800 tracking-widest uppercase">{group.name}</h3>
                   </div>
                   <span className="bg-slate-100/50 text-slate-400 text-[10px] font-black px-4 py-1 rounded-full">{group.done}/XONG</span>
                </div>
                
                <div className="space-y-6">
                  {group.items.slice(0, displayCount).map((item) => (
                     <ListItem key={item.job_code} item={item} />
                  ))}
                </div>
              </motion.section>
            ))}
          </AnimatePresence>
        )}

        {totalPoints > displayCount && (
           <button 
            onClick={() => setDisplayCount(v => v + 30)}
            className="w-full py-6 bg-white border border-slate-100 rounded-[2.5rem] text-xs font-black text-indigo-600 uppercase tracking-widest shadow-sm active:scale-95 transition-all"
           >
             Trình thêm dữ liệu
           </button>
        )}
      </div>
    </div>
  );
};

const ListItem = ({ item }) => {
  const isMall = item.mall_name && item.mall_name !== 'N/A' && item.mall_name.trim().length > 0;
  const posmStatus = item.posm_status || 'Không xác định';
  const hasPosm = posmStatus.toLowerCase().includes('có') || posmStatus.toLowerCase().includes('yes');

  return (
    <motion.div 
      layout
      className="relative bg-white p-8 rounded-[3rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-50 transition-all"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 pr-4">
           <div className="flex items-center gap-3 mb-2">
             <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)] shrink-0" />
             <h4 className="text-lg font-black text-slate-800 truncate tracking-tight uppercase leading-tight">
                {item.brand || 'POSM Point'}
             </h4>
           </div>
           <p className="text-xs font-bold text-slate-400 line-clamp-1 truncate tracking-tight mb-5 opacity-80 leading-relaxed">
             {item.address}
           </p>
           
           <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-[10px] font-black bg-slate-50 text-slate-400 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-slate-100">
                #{item.job_code}
              </span>
              
              {hasPosm ? (
                <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-emerald-100">
                  Có POSM
                </span>
              ) : (
                <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-amber-100">
                  K. POSM
                </span>
              )}

              {isMall && (
                <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-blue-100">
                  Mall
                </span>
              )}

              <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-indigo-100">
                XONG
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
    </motion.div>
  );
};

export default ListView;
