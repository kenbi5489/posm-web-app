import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ChevronDown, Clock, RefreshCw, Trophy, Users, ShieldAlert, BadgeInfo
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════════════════
// TỔNG QUAN POSM — Executive Overview Dashboard
// ═══════════════════════════════════════════════════════════════════════════

const ACCENT = '#0f3460';
const TEAL = '#0d9488';
const AMBER = '#d97706';
const RED = '#dc2626';

const isMall = (rec) => {
  if (rec.mall_name && rec.mall_name !== 'N/A' && rec.mall_name !== '') return true;
  const type = (rec.location_type || '').toLowerCase();
  return type.includes('mall') || type.includes('ttm') || type.includes('trung tâm');
};

// ─── UI COMPONENTS ───────────────────────────────────────────────────────────

const DoughnutChart = ({ percent, total, done, color = ACCENT }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  
  return (
    <div className="relative w-40 h-40 flex items-center justify-center mx-auto">
      <svg className="w-full h-full transform -rotate-90 drop-shadow-sm">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        <motion.circle 
          cx="80" cy="80" r={radius} fill="none" stroke={color} strokeWidth="12" 
          strokeDasharray={circumference} 
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          strokeLinecap="round" 
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-black text-slate-800 tracking-tighter" style={{ color }}>{percent}%</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{done} / {total}</span>
      </div>
    </div>
  );
};

const BarChart = ({ data, height = 150 }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.total), 1);
  const barW = Math.min(30, Math.floor(250 / data.length) - 8);

  return (
    <svg viewBox={`0 0 ${data.length * (barW + 12) + 20} ${height + 40}`} className="w-full" style={{ maxHeight: height + 40 }}>
      {data.map((d, i) => {
        const x = 10 + i * (barW + 12);
        const totalH = (d.total / max) * height;
        const doneH = (d.done / max) * height;
        return (
          <g key={i}>
            <rect x={x} y={height - totalH} width={barW} height={totalH} rx={barW / 4} fill="#e2e8f0" />
            <motion.rect 
              initial={{ height: 0, y: height }}
              animate={{ height: doneH, y: height - doneH }}
              transition={{ duration: 1, delay: i * 0.1 }}
              x={x} width={barW} height={doneH} y={height - doneH} rx={barW / 4} fill={ACCENT} opacity={0.85} 
             />
            <text x={x + barW / 2} y={height + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94a3b8">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const ProgressBar = ({ percent, color = ACCENT }) => (
  <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex-1 shadow-inner">
    <motion.div
      initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
      className="h-full rounded-full" style={{ backgroundColor: color }}
    />
  </div>
);

const AlertItem = ({ severity, text }) => {
  const config = {
    high: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: <ShieldAlert size={14} className="text-rose-600 mt-0.5" /> },
    medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: <AlertTriangle size={14} className="text-amber-600 mt-0.5" /> },
    low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: <BadgeInfo size={14} className="text-blue-600 mt-0.5" /> },
  };
  const c = config[severity] || config.low;
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-3 p-3.5 mb-2 rounded-xl border ${c.bg} ${c.border}`}
    >
      {c.icon}
      <p className={`text-[13px] font-semibold leading-snug ${c.text}`}>{text}</p>
    </motion.div>
  );
};

const LeaderboardRow = ({ rank, name, value, total, percent, color }) => {
  const barColor = color || (percent < 40 ? RED : percent < 70 ? AMBER : TEAL);
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-b-0">
      <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${rank === 1 ? 'bg-amber-100 text-amber-600' : rank === 2 ? 'bg-slate-100 text-slate-500' : 'bg-orange-50 text-orange-600'}`}>
        #{rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-slate-700 truncate">{name}</span>
          <span className="text-[10px] font-black text-slate-400 shrink-0 ml-2">{value}/{total}</span>
        </div>
        <div className="flex items-center gap-3">
          <ProgressBar percent={percent} color={barColor} />
          <span className="text-[10px] font-black w-8 text-right" style={{ color: barColor }}>{percent}%</span>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════

const OverviewDashboard = () => {
  const { user, selectedStaff, lastSync } = useAuth();
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekFilter, setWeekFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const { syncing, pullData, clearAndResync } = useSync(user);
  const [diag, setDiag] = useState(null);
  const [showDiag, setShowDiag] = useState(false);

  useEffect(() => {
    const info = localStorage.getItem('sync_diag');
    if (info) setDiag(JSON.parse(info));
  }, [lastSync]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await db.posmData.toArray();
        setAllData(data);
      } catch (err) {
        console.error("Overview Load Error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [lastSync]);

  const { filtered, uniqueWeeks, uniqueBrands } = useMemo(() => {
    const picId = selectedStaff?.user_id || (user?.role === 'staff' ? user.user_id : null);
    let base = allData;
    if (picId) {
      const pidNorm = String(picId).trim().toLowerCase();
      const pNameNorm = stripAccents(selectedStaff?.ho_ten || user?.ho_ten || '').toLowerCase().trim();

      base = allData.filter(i => {
         const mPId = String(i.pic_id || '').trim().toLowerCase();
         const mPName = stripAccents(i.pic || '').toLowerCase().trim();
         return (pidNorm && mPId && mPId === pidNorm) || (pNameNorm && mPName && mPName === pNameNorm);
      });
    }

    const uWeeks = [...new Set(base.map(i => i.week))].filter(Boolean).sort((a, b) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0));
    const uBrands = [...new Set(base.map(i => i.brand))].filter(Boolean).sort();

    let f = base;
    if (weekFilter !== 'All') f = f.filter(i => i.week === weekFilter);
    if (brandFilter !== 'All') f = f.filter(i => i.brand === brandFilter);

    return { filtered: f, uniqueWeeks: uWeeks, uniqueBrands: uBrands };
  }, [allData, user, selectedStaff, weekFilter, brandFilter]);

  // Master KPI
  const kpis = useMemo(() => {
    const assignedFiltered = filtered.filter(i => !i.is_virtual && !String(i.job_code || '').startsWith('NEW_'));
    const adhocFiltered = filtered.filter(i => i.is_virtual || String(i.job_code || '').startsWith('NEW_'));

    const assignedTotal = assignedFiltered.length;
    const assignedDone = assignedFiltered.filter(i => i.status?.toLowerCase() === 'done').length;
    const adhocDone = adhocFiltered.filter(i => i.status?.toLowerCase() === 'done').length;
    const totalDone = assignedDone + adhocDone;
    
    // Tỉ lệ hoàn thành: 75 points = 100%
    const percent = Math.min(100, Math.round((totalDone / 75) * 100));
    
    // Hiệu suất tuyến: % on total assigned (excluding adhoc)
    const efficiency = assignedTotal > 0 ? Math.round((assignedDone / assignedTotal) * 100) : 0;

    const mallRecs = filtered.filter(isMall);
    const nonMallRecs = filtered.filter(r => !isMall(r));
    return { 
      total: assignedTotal, 
      done: totalDone, 
      percent,
      adhocDone,
      efficiency,
      mall: { total: mallRecs.length, done: mallRecs.filter(r => r.status === 'Done').length },
      nonMall: { total: nonMallRecs.length, done: nonMallRecs.filter(r => r.status === 'Done').length }
    };
  }, [filtered, user?.role]);

  // Insights
  const chartData = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const w = item.week || 'N/A';
      if (!map[w]) map[w] = { total: 0, done: 0 };
      map[w].total++;
      if (item.status === 'Done') map[w].done++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0))
      .map(([label, d]) => ({ label: label.replace(/\D/g, '') ? `W${label.replace(/\D/g, '')}` : label, ...d }));
  }, [filtered]);

  const brandMetrics = useMemo(() => {
     const map = {};
     filtered.forEach(item => {
       const b = item.brand || 'Khác';
       if (!map[b]) map[b] = { total: 0, done: 0 };
       map[b].total++;
       if (item.status === 'Done') map[b].done++;
     });
     const sorted = Object.entries(map).map(([name, d]) => ({ name, done: d.done, total: d.total, percent: Math.round((d.done / Math.max(d.total, 1)) * 100) }))
       .filter(d => d.total >= 5).sort((a, b) => b.percent - a.percent);
     return { top: sorted.slice(0, 3), bottom: sorted.slice(-3).reverse() };
  }, [filtered]);

  const alerts = useMemo(() => {
    const res = [];
    if (brandMetrics.bottom.length > 0) {
      res.push({ severity: 'high', text: `Báo động đỏ: Brand ${brandMetrics.bottom[0].name} chỉ đạt ${brandMetrics.bottom[0].percent}%. Cần ưu tiên xử lý ngay.` });
    }
    const pendingDistricts = {};
    filtered.forEach(i => { if (i.status !== 'Done') { pendingDistricts[i.district || 'Khác'] = (pendingDistricts[i.district || 'Khác'] || 0) + 1; }});
    const hotD = Object.entries(pendingDistricts).sort((a,b) => b[1]-a[1]);
    if (hotD.length > 0 && hotD[0][1] >= 5) {
      res.push({ severity: 'medium', text: `${hotD[0][0]} đang kẹt lại ${hotD[0][1]} điểm thi công.` });
    }
    if (kpis.percent < 70 && kpis.total > 10) res.push({ severity: 'medium', text: `Tổng tiến độ chiến dịch (${kpis.percent}%) đang có dấu hiệu chững lại.` });
    if (res.length === 0) res.push({ severity: 'low', text: `Hệ thống ổn định. Không có rủi ro nào được phát hiện.` });
    return res;
  }, [brandMetrics, filtered, kpis]);

  if (loading) return <div className="flex justify-center py-32"><RefreshCw className="animate-spin text-slate-300" size={28} /></div>;

  return (
    <div className="min-h-full bg-slate-50 pb-32 font-sans selection:bg-indigo-100">
      
      {/* ── HEADER & FILTER ── */}
      <div className="bg-white border-b border-slate-200 px-5 pt-8 pb-6 shadow-sm sticky top-0 z-10">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Executive Board</h1>
        <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1.5"><Clock size={12}/> Dữ liệu lúc {lastSync ? new Date(lastSync).toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : '--'}</p>
        
        <div className="flex gap-3 mt-6">
          <select value={weekFilter} onChange={e => setWeekFilter(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400">
            <option value="All">Tuần: Toàn chiến dịch</option>
            {uniqueWeeks.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400">
            <option value="All">Brand: Tất cả</option>
            {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="px-5 pt-6 space-y-6">
        
        {/* ── HERO HEARTBEAT ── */}
        <section className="bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col items-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400" />
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">Tỉ Lệ Hoàn Thành</h2>
          <DoughnutChart percent={kpis.percent} total={kpis.total} done={kpis.done} color={kpis.percent > 75 ? TEAL : kpis.percent > 40 ? AMBER : RED} />
          
          <div className="grid grid-cols-2 lg:grid-cols-4 w-full mt-8 gap-4 px-2">
            <div className="text-center bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm">
               <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">HIỆU SUẤT TUYẾN</p>
               <p className="text-lg font-black text-indigo-600">{kpis.efficiency}%</p>
            </div>
            <div className="text-center bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm">
               <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">ĐIỂM NGOÀI DS</p>
               <p className="text-lg font-black text-violet-600">{kpis.adhocDone}</p>
            </div>
            <div className="text-center bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm">
               <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">MALL</p>
               <p className="text-lg font-black text-slate-800">{Math.round((kpis.mall.done / Math.max(kpis.mall.total, 1))*100)}%</p>
            </div>
            <div className="text-center bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm">
               <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">NGOÀI MALL</p>
               <p className="text-lg font-black text-slate-800">{Math.round((kpis.nonMall.done / Math.max(kpis.nonMall.total, 1))*100)}%</p>
            </div>
          </div>
        </section>

        {/* ── SMART ALERTS ── */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
             <AlertTriangle size={16} className="text-rose-500" />
             <h2 className="text-sm font-black text-slate-800">Cổng Cảnh Báo</h2>
          </div>
          {alerts.map((a, i) => <AlertItem key={i} severity={a.severity} text={a.text} />)}
        </section>

        {/* ── TOP OUTCOMES & TRENDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
             <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-5">Tốc Độ Tuần</h2>
             <BarChart data={chartData} />
           </section>

           <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
             <div className="flex justify-between items-end mb-5">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Brand Phủ Kém Nhất</h2>
             </div>
             {brandMetrics.bottom.length > 0 ? brandMetrics.bottom.map((b, i) => (
                <LeaderboardRow key={b.name} rank={i+1} name={b.name} value={b.done} total={b.total} percent={b.percent} color={RED} />
             )) : <p className="text-xs text-slate-300 font-bold text-center py-6">Không có dữ liệu rủi ro</p>}
           </section>
        </div>

      </div>
    </div>
  );
};

export default OverviewDashboard;
