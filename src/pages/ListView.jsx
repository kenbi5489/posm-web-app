import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { Search, ExternalLink, CheckCircle2, Clock, MapPin, Hash, Zap, RefreshCw, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import MultiSelect from '../components/MultiSelect';
import { isSameWeek, getWeekMonth } from '../utils/weekUtils';

const stripAccents = (s) => s?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').replace(/\u0110/g, 'D') || '';

// ─── Admin ListItem ───────────────────────────────────────────────────────────
const AdminListItem = ({ item }) => {
  const navigate = useNavigate();
  const isDone = item.status?.toLowerCase() === 'done';
  const hasPosm = (item.posm_status || '').toLowerCase().includes('c\u00f3');
  const hasImg1 = item.image1 && item.image1.length > 4 && !item.image1.startsWith('data:');
  const hasImg2 = item.image2 && item.image2.length > 4 && !item.image2.startsWith('data:');

  return (
    <motion.div layout onClick={() => navigate(`/detail/${item.job_code}/${encodeURIComponent(item.brand)}`)} className='bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all'>
      {/* Top strip: status color */}
      <div className={`h-1.5 w-full ${isDone ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : 'bg-gradient-to-r from-amber-300 to-orange-300'}`} />

      <div className='p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between'>
        {/* Left Side: Detail Info */}
        <div className='flex-1 space-y-3 min-w-0 w-full'>
          <div className='flex items-center gap-2 mb-1'>
            <span className='text-[10px] font-black text-white bg-slate-800 px-2.5 py-1 rounded-full uppercase tracking-widest'>{item.job_code}</span>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${isDone ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
              {isDone ? '\u2713 Xong' : '\u23f3 Ch\u01b0a'}
            </span>
          </div>

          <h4 className='text-lg font-black text-slate-900 leading-tight truncate'>{item.brand || 'POSM Point'}</h4>
          
          <div className='flex items-center gap-1.5 text-slate-500'>
            <MapPin size={14} className='shrink-0 text-slate-300' />
            <p className='text-xs font-medium line-clamp-1'>{item.address || 'N/A'}</p>
          </div>

          <div className='flex items-center gap-2 flex-wrap pt-1'>
            {item.pic && (
              <span className='flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100'>
                <User size={12} />{item.pic}
              </span>
            )}
            {isDone && (
              <span className={`text-[11px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border ${hasPosm ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                {hasPosm ? '\u2713 C\u00d3 POSM' : '\u2717 KH\u00d4NG POSM'}
              </span>
            )}
            {item.district && <span className='shrink-0 text-[10px] font-bold bg-slate-50 text-slate-500 px-2.5 py-1.5 rounded-full border border-slate-100'>{item.district}</span>}
          </div>
        </div>

        {/* Right Side: Actions (Images) */}
        {isDone && (
          <div className='flex sm:flex-col gap-2 w-full sm:w-36 shrink-0'>
            <a
              href={hasImg1 ? item.image1 : undefined}
              target='_blank' rel='noopener noreferrer'
              onClick={(e) => e.stopPropagation()}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all
                ${hasImg1
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95'
                  : 'bg-slate-50 text-slate-400 pointer-events-none border border-slate-100'}`}
            >
              <ExternalLink size={14} /> Ảnh 1
            </a>
            <a
              href={hasImg2 ? item.image2 : undefined}
              target='_blank' rel='noopener noreferrer'
              onClick={(e) => e.stopPropagation()}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all
                ${hasImg2
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95'
                  : 'bg-slate-50 text-slate-400 pointer-events-none border border-slate-100'}`}
            >
              <ExternalLink size={14} /> Ảnh 2
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Staff ListItem (giữ nguyên như cũ) ─────────────────────────────────────
const ListItem = ({ item }) => {
  const navigate = useNavigate();
  const isMall = item.mall_name && item.mall_name !== 'N/A' && item.mall_name.trim().length > 0;
  const status = item.posm_status || 'Ch\u01b0a b\u00e1o c\u00e1o';
  const hasPosm = status.toLowerCase().includes('c\u00f3') || status.toLowerCase().includes('yes');
  const isDone = item.status?.toLowerCase() === 'done' || item.status?.toLowerCase() === 'ho\u00e0n t\u1ea5t';
  const hasImg1 = item.image1 && item.image1.length > 4 && !item.image1.startsWith('data:');
  const hasImg2 = item.image2 && item.image2.length > 4 && !item.image2.startsWith('data:');

  return (
    <motion.div layout onClick={() => navigate(`/detail/${item.job_code}/${encodeURIComponent(item.brand)}`)} className={`bg-white rounded-3xl border shadow-sm transition-all overflow-hidden cursor-pointer hover:shadow-md hover:border-indigo-300 relative ${item.priority ? 'border-amber-200' : 'border-slate-100'}`}>
      {/* Top strip */}
      <div className={`h-1.5 w-full ${isDone ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : item.priority ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-slate-200 to-slate-300'}`} />
      
      {item.priority && (
        <div className='absolute top-0 right-8 transform -translate-y-1'>
          <div className={`${isDone ? 'bg-amber-400' : 'bg-amber-500'} text-white px-3 py-1.5 rounded-b-xl flex items-center gap-1 shadow-sm`}>
            <Zap size={10} className='fill-white' />
            <span className='text-[8px] font-black uppercase tracking-widest'>{isDone ? '\u2605 \u01afu ti\u00ean' : '\u01afu ti\u00ean'}</span>
          </div>
        </div>
      )}

      <div className='p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between'>
        {/* Left Side: Info */}
        <div className='flex-1 space-y-3 min-w-0 w-full'>
          <div className='flex items-center gap-2 mb-1'>
            <span className='text-[10px] font-black text-white bg-slate-800 px-2.5 py-1 rounded-full uppercase tracking-widest'>{item.job_code}</span>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border ${isDone ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
              {isDone ? '\u2713 \u0110\u00e3 b\u00e1o c\u00e1o' : 'Ch\u01b0a l\u00e0m'}
            </span>
          </div>

          <h4 className='text-lg font-black text-slate-900 tracking-tight uppercase truncate'>{item.brand || 'POSM Point'}</h4>

          <div className='flex items-center gap-1.5 text-slate-500'>
            <MapPin size={14} className='shrink-0 text-slate-300'/>
            <p className='text-xs font-medium line-clamp-1'>{item.address || 'N/A'}</p>
          </div>

          <div className='flex flex-wrap items-center gap-2 pt-1'>
            {isDone && <span className={`text-[11px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${hasPosm ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>{hasPosm ? '\u2713 C\u00d3 POSM' : '\u2717 KH\u00d4NG POSM'}</span>}
            {isMall && <span className='text-[10px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-1.5 rounded-full border border-indigo-100 uppercase tracking-widest'>MALL</span>}
          </div>
        </div>

        {/* Right Side: Actions */}
        <div className='flex sm:flex-col gap-2 w-full sm:w-36 shrink-0'>
          {!isDone ? (
             <Link onClick={(e) => e.stopPropagation()} to={`/detail/${item.job_code}/${encodeURIComponent(item.brand)}`} className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-black transition-all active:scale-95 shadow-md ${item.priority ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                <Hash size={18} /> N\u1ed8P
             </Link>
          ) : (
             <>
                <a onClick={(e) => e.stopPropagation()} href={hasImg1 ? item.image1 : '#'} target={hasImg1 ? '_blank' : '_self'} rel='noopener noreferrer' className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${hasImg1 ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 shadow-sm border border-indigo-100 active:scale-95' : 'bg-slate-50 text-slate-300 pointer-events-none border border-slate-100'}`}><ExternalLink size={14} /> Ảnh 1</a>
                <a onClick={(e) => e.stopPropagation()} href={hasImg2 ? item.image2 : '#'} target={hasImg2 ? '_blank' : '_self'} rel='noopener noreferrer' className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${hasImg2 ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 shadow-sm border border-indigo-100 active:scale-95' : 'bg-slate-50 text-slate-300 pointer-events-none border border-slate-100'}`}><ExternalLink size={14} /> Ảnh 2</a>
             </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main ListView ────────────────────────────────────────────────────────────
const ListView = () => {
  const { user, selectedStaff, lastSync, localRefreshTick } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  const [allItems, setAllItems] = useState([]);
  const [listItems, setListItems] = useState([]);
  const [search, setSearch] = useState(() => sessionStorage.getItem('lv_search') || '');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('lv_month')) || ['All']; } catch { return ['All']; }
  });
  const [week, setWeek] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('lv_week')) || ['All']; } catch { return ['All']; }
  });
  const [selectedBrand, setSelectedBrand] = useState(['All']);
  const [selectedPic, setSelectedPic] = useState(['All']);
  const [posmFilter, setPosmFilter] = useState('all'); // 'all' | 'yes' | 'no'
  const [displayCount, setDisplayCount] = useState(() => parseInt(sessionStorage.getItem('lv_count')) || 50);
  const [statusTab, setStatusTab] = useState(() => sessionStorage.getItem('lv_status') || 'pending');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setStatusTab(sessionStorage.getItem('lv_status') || 'pending');
    setSearch(sessionStorage.getItem('lv_search') || '');
  }, [location.key]);

  useEffect(() => {
    sessionStorage.setItem('lv_search', search);
    sessionStorage.setItem('lv_month', JSON.stringify(selectedMonth));
    sessionStorage.setItem('lv_week', JSON.stringify(week));
    sessionStorage.setItem('lv_count', displayCount.toString());
    sessionStorage.setItem('lv_status', statusTab);
  }, [search, selectedMonth, week, selectedBrand, selectedPic, displayCount, statusTab]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const picId = selectedStaff?.user_id || (user.role === 'staff' ? user.user_id : null);
        const [allDbItems, adhocDbItems] = await Promise.all([
          db.posmData.toArray(),
          db.adhocPoints ? db.adhocPoints.toArray() : []
        ]);
        const mergedItems = [...allDbItems, ...adhocDbItems];
        setAllItems(mergedItems);

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
        setListItems(filteredByPic);

        // Removing auto-select logic to default to All weeks/months per user request
      } catch (err) {
        console.error('ListView Load Error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [selectedStaff, user, lastSync, localRefreshTick]);

  const { filteredItems, uniqueWeeks, uniqueMonths, uniqueBrands, uniquePics } = useMemo(() => {
    const sortedWeeks = [...new Set(listItems.map(i => i.week))]
      .filter(w => Boolean(w) && !w.includes('??'))
      .sort((a, b) => {
        const numA = parseInt(String(a).match(/\d+/)?.[0]) || 0;
        const numB = parseInt(String(b).match(/\d+/)?.[0]) || 0;
        return numB - numA;
      });
      
    const months = [...new Set(sortedWeeks.map(w => getWeekMonth(w)))].filter(m => m !== 'N/A').sort();

    const brands = [...new Set(listItems.map(i => i.brand).filter(Boolean))].sort();
    const pics   = [...new Set(listItems.map(i => i.pic).filter(Boolean))].sort();

    let filtered = listItems;
    if (statusTab === 'pending') {
      filtered = filtered.filter(i => i.status?.toLowerCase() !== 'done' && i.status?.toLowerCase() !== 'ho\u00e0n t\u1ea5t');
    } else {
      filtered = filtered.filter(i => i.status?.toLowerCase() === 'done' || i.status?.toLowerCase() === 'ho\u00e0n t\u1ea5t');
    }
    
    if (!selectedMonth.includes('All')) {
      filtered = filtered.filter(i => selectedMonth.includes(getWeekMonth(i.week)));
    }
    if (!week.includes('All')) {
      filtered = filtered.filter(i => week.some(w => isSameWeek(i.week, w)));
    }
    if (!selectedBrand.includes('All')) filtered = filtered.filter(i => selectedBrand.includes(i.brand));
    if (!selectedPic.includes('All')) filtered = filtered.filter(i => selectedPic.includes(i.pic));
    if (posmFilter === 'yes') filtered = filtered.filter(i => (i.posm_status || '').toLowerCase().includes('c\u00f3'));
    if (posmFilter === 'no')  filtered = filtered.filter(i => (i.posm_status || '').toLowerCase().includes('kh\u00f4ng') || (i.posm_status || '').toLowerCase().includes('khong'));
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(i =>
        i.brand?.toLowerCase().includes(s) ||
        i.job_code?.toLowerCase().includes(s) ||
        i.address?.toLowerCase().includes(s) ||
        i.pic?.toLowerCase().includes(s)
      );
    }
    
    // Sort all filtered items by week descending before display slicing
    filtered.sort((a, b) => {
      const numA = parseInt(String(a.week).match(/\d+/)?.[0]) || 0;
      const numB = parseInt(String(b.week).match(/\d+/)?.[0]) || 0;
      return numB - numA;
    });

    return { 
      filteredItems: filtered, 
      uniqueWeeks: ['All', ...sortedWeeks], 
      uniqueMonths: ['All', ...months],
      uniqueBrands: ['All', ...brands], 
      uniquePics: ['All', ...pics] 
    };
  }, [allItems, listItems, week, selectedMonth, search, selectedBrand, selectedPic, posmFilter, statusTab]);

  const doneCount    = filteredItems.filter(i => i.status?.toLowerCase() === 'done').length;
  const pendingCount = filteredItems.length - doneCount;
  const pct          = filteredItems.length > 0 ? Math.round((doneCount / filteredItems.length) * 100) : 0;

  // Group by week for display
  const weekGroups = useMemo(() => {
    const groups = {};
    filteredItems.slice(0, displayCount).forEach(item => {
      const w = String(item.week || 'W??').toUpperCase();
      if (!groups[w]) groups[w] = { name: w, items: [], done: 0 };
      groups[w].items.push(item);
      if (item.status?.toLowerCase() === 'done') groups[w].done++;
    });
    return Object.values(groups).sort((a, b) => {
      const nA = parseInt(a.name.match(/\d+/)?.[0]) || 0;
      const nB = parseInt(b.name.match(/\d+/)?.[0]) || 0;
      return nB - nA;
    });
  }, [filteredItems, displayCount]);


  return (
    <div className="flex flex-col h-full bg-slate-50/30">

      {/* ── HEADER ── */}
      <div className="bg-indigo-600 pt-6 pb-10 px-5 rounded-b-[3.5rem] shadow-xl relative z-20">
        <div className="absolute inset-0 rounded-b-[3.5rem] overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        </div>

        {/* Title */}
        <div className="relative mb-5">
          <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">
            {isAdmin ? 'Tổng quan nghiệm thu' : 'Tuyến đường của bạn'}
          </p>
          <h2 className="text-2xl font-black text-white tracking-tight uppercase">
            {isAdmin ? 'DANH SÁCH NGHIỆM THU' : 'DANH SÁCH TUYẾN ĐƯỜNG'}
          </h2>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input
            type="text"
            placeholder={isAdmin ? 'Tìm brand, địa chỉ, nhân viên...' : 'Tìm kiếm...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-14 pr-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white text-sm font-bold placeholder-white/30 focus:outline-none focus:bg-white/15"
          />
        </div>

        {/* Filters */}
        <div className="space-y-2.5 relative z-50 mb-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            <MultiSelect label="Tháng" theme="dark" options={uniqueMonths} value={selectedMonth} onChange={setSelectedMonth} />
            <MultiSelect label="Tuần" theme="dark" options={uniqueWeeks} value={week} onChange={setWeek} />
            <MultiSelect label="Brand" theme="dark" options={uniqueBrands} value={selectedBrand} onChange={setSelectedBrand} />
          </div>
          {isAdmin && (
            <MultiSelect label="Nhân viên" theme="dark" options={uniquePics} value={selectedPic} onChange={setSelectedPic} />
          )}

          {/* POSM quick-filter — admin only, shown in Done tab */}
          {isAdmin && statusTab === 'done' && (
            <div className="flex gap-2">
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'yes', label: '✓ Có POSM' },
                { key: 'no',  label: '✗ Không POSM' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setPosmFilter(opt.key)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                    ${posmFilter === opt.key
                      ? opt.key === 'no' ? 'bg-rose-500 text-white shadow-md' : 'bg-white text-indigo-700 shadow-md'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex bg-white/10 p-1.5 rounded-2xl relative z-10 w-full shadow-inner mb-4">
          <button
            onClick={() => { setStatusTab('pending'); setPosmFilter('all'); }}
            className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${statusTab === 'pending' ? 'bg-white text-indigo-600 shadow-md' : 'text-white/60'}`}
          >
            Cần làm
          </button>
          <button
            onClick={() => setStatusTab('done')}
            className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${statusTab === 'done' ? 'bg-emerald-500 text-white shadow-md' : 'text-white/60'}`}
          >
            Đã xong
          </button>
        </div>

        {/* Summary bar */}
        <div className="flex items-center justify-between px-1 relative z-10">
          <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">
            {filteredItems.length} kết quả
          </span>
          {filteredItems.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] font-black text-emerald-300">
                <CheckCircle2 size={11} /> {doneCount} xong
              </span>
              <span className="flex items-center gap-1 text-[10px] font-black text-amber-300">
                <Clock size={11} /> {pendingCount} còn
              </span>
              <span className="text-[10px] font-black text-white bg-white/20 px-2.5 py-1 rounded-full">{pct}%</span>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-y-auto px-5 py-8 space-y-8 pb-32">
        {isLoading ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <RefreshCw className="animate-spin text-indigo-300" size={32} />
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Đang tải dữ liệu...</p>
          </div>
        ) : weekGroups.length === 0 ? (
          <div className="p-20 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
              <Search size={28} className="text-slate-300" />
            </div>
            <p className="text-slate-400 font-bold text-xs">Không tìm thấy kết quả nào</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {weekGroups.map((group, gIdx) => {
              const groupItems = statusTab === 'pending'
                ? group.items.filter(i => !i.priority)
                : group.items;
              const priorityItems = statusTab === 'pending' ? group.items.filter(i => i.priority) : [];

              return (
                <motion.section
                  key={group.name}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gIdx * 0.04 }}
                  className="space-y-3"
                >
                  {/* Week header */}
                  <div className="flex items-center justify-between px-1 py-1">
                    <div className="flex items-center gap-2.5">
                      <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                      <h3 className="text-[13px] sm:text-sm font-black text-indigo-800 tracking-widest uppercase">TUẦN {group.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">{group.done} xong</span>
                      <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{group.items.length} tổng</span>
                    </div>
                  </div>

                  {/* Priority items */}
                  {priorityItems.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 px-1">
                        <Zap size={11} className="text-amber-500 fill-amber-400" />
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Ưu tiên</span>
                      </div>
                      {priorityItems.map(item =>
                        isAdmin
                          ? <AdminListItem key={`${item.job_code}_${item.week}`} item={item} />
                          : <ListItem      key={`${item.job_code}_${item.week}`} item={item} />
                      )}
                    </div>
                  )}

                  {/* Regular items */}
                  <div className="space-y-2">
                    {groupItems.map(item =>
                      isAdmin
                        ? <AdminListItem key={`${item.job_code}_${item.week}`} item={item} />
                        : <ListItem      key={`${item.job_code}_${item.week}`} item={item} />
                    )}
                  </div>
                </motion.section>
              );
            })}
          </AnimatePresence>
        )}

        {filteredItems.length > displayCount && (
          <button
            onClick={() => setDisplayCount(v => v + 50)}
            className="w-full py-5 bg-white border border-slate-100 rounded-[2rem] text-xs font-black text-indigo-600 uppercase tracking-widest active:scale-95 shadow-sm"
          >
            Xem thêm 50 kết quả
          </button>
        )}
      </div>
    </div>
  );
};

export default ListView;
