import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock, RefreshCw, Trophy, Users, CheckCircle2, ShieldAlert, AlertTriangle, BadgeInfo
} from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../hooks/useSync';
import { getCustomWeekNumber, getWeekLabelHelper } from '../utils/weekUtils';


// ═══════════════════════════════════════════════════════════════════════════
// TỔNG QUAN POSM — Executive Overview Dashboard
// ═══════════════════════════════════════════════════════════════════════════

const ACCENT = '#0f3460';
const TEAL = '#0d9488';
const AMBER = '#d97706';
const RED = '#dc2626';

const stripAccents = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Mall keywords — dùng để detect từ address khi mall_name (cột BE) chưa có
const MALL_KEYWORDS = ['aeon', 'vincom', 'lotte', 'big c', 'bigc', 'coopxtra', 'coopmart',
  'van hanh', 'vạn hạnh', 'gigamall', 'thiso', 'crescent', 'vivo city', 'sc vivo',
  'tttm', 'trung tâm thương mại', 'trung tam thuong mai', 'parkson', 'nowzone',
  'sense city', 'pandora', 'estella'];

// isMall: ưu tiên cột BE (Mall_Name từ acceptance sheet) → location_type → address scan
const isMall = (rec) => {
  // 1. Cột BE: Mall_Name được GAS ghi vào acceptance sheet
  const mn = (rec.mall_name || '').trim();
  if (mn && mn !== 'N/A' && mn !== 'Standalone' && mn !== '') return true;
  // 2. Location_Type
  const type = (rec.location_type || '').toLowerCase();
  if (type === 'mall' || type.includes('ttm') || type.includes('trung tâm')) return true;
  // 3. Address fallback — khi chưa có acceptance data
  const addr = (rec.address || '').toLowerCase();
  return MALL_KEYWORDS.some(kw => addr.includes(kw));
};

// ─── UI COMPONENTS ───────────────────────────────────────────────────────────

const DoughnutChart = ({ percent, total, done, color = ACCENT }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative w-44 h-44 flex items-center justify-center mx-auto">
      <svg className="w-full h-full transform -rotate-90">
        <circle cx="88" cy="88" r={radius} fill="none" stroke="#f8fafc" strokeWidth="14" />
        <motion.circle
          cx="88" cy="88" r={radius} fill="none" stroke={color} strokeWidth="14"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-black text-slate-800 tracking-tighter" style={{ color }}>{percent}%</span>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{done} / {total}</span>
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
            <rect x={x} y={height - totalH} width={barW} height={totalH} rx={barW / 4} fill="#f1f5f9" />
            <motion.rect
              initial={{ height: 0, y: height }}
              animate={{ height: doneH, y: height - doneH }}
              x={x} width={barW} height={doneH} y={height - doneH} rx={barW / 4} fill={ACCENT} opacity={0.85}
            />
            <text x={x + barW / 2} y={height + 18} textAnchor="middle" fontSize="10" fontWeight="800" fill="#cbd5e1">
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
    high: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', icon: <ShieldAlert size={14} className="text-rose-600 mt-0.5" /> },
    medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', icon: <AlertTriangle size={14} className="text-amber-600 mt-0.5" /> },
    low: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', icon: <BadgeInfo size={14} className="text-indigo-600 mt-0.5" /> },
  };
  const c = config[severity] || config.low;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-3 p-4 mb-3 rounded-2xl border ${c.bg} ${c.border}`}
    >
      {c.icon}
      <p className={`text-[13px] font-bold leading-snug ${c.text}`}>{text}</p>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════

const OverviewDashboard = () => {
  const { user, selectedStaff, lastSync } = useAuth();
  const [allData, setAllData] = useState([]);
  const [adhocData, setAdhocData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekFilter, setWeekFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');
  const { syncing, pullData } = useSync(user);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [posm, adhoc] = await Promise.all([
          db.posmData.toArray(),
          db.adhocPoints ? db.adhocPoints.toArray() : []
        ]);
        setAllData(posm);
        setAdhocData(adhoc);
      } catch (err) {
        console.error("Overview Load Error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [lastSync]);

  // Auto-select the best default week whenever data reloads (lastSync changes).
  // Reset ref each time lastSync changes so a fresh sync always re-picks the right week.
  const autoSelectedRef = useRef(false);
  useEffect(() => { autoSelectedRef.current = false; }, [lastSync]);
  useEffect(() => {
    if (autoSelectedRef.current || allData.length === 0) return;
    autoSelectedRef.current = true;

    const today = new Date();
    const currentNum = getCustomWeekNumber(today);
    // Company week runs Fri→Thu. Thursday is last day of outgoing week,
    // but staff already work on next-week data → look ahead by 1.
    const isThursday = today.getDay() === 4;
    const effectiveNum = isThursday ? currentNum + 1 : currentNum;

    const weeks = [...new Set(allData.map(i => i.week).filter(Boolean))].sort((a, b) =>
      (parseInt(String(a).match(/\d+/)?.[0]) || 0) - (parseInt(String(b).match(/\d+/)?.[0]) || 0)
    );
    // Priority 1: exact match on effective current week (e.g. W16)
    let match = weeks.find(w => (parseInt(String(w).match(/\d+/)?.[0]) || 0) === effectiveNum);
    // Priority 2: latest week <= effectiveNum (most recent past week)
    if (!match) {
      const past = weeks.filter(w => (parseInt(String(w).match(/\d+/)?.[0]) || 0) < effectiveNum);
      match = past[past.length - 1];
    }
    // Priority 3: all weeks are future — pick earliest (W16 before W17)
    if (!match) match = weeks[0];
    if (match) setWeekFilter(match);
  }, [allData]); // eslint-disable-line react-hooks/exhaustive-deps

  const { filtered, filteredAdhoc, uniqueWeeks, uniqueBrands, allStaff, syncedAdhocs } = useMemo(() => {
    const activeStaff = selectedStaff || (user?.role === 'staff' ? user : null);
    const pidNorm = String(activeStaff?.user_id || '').trim().toLowerCase();
    const pNameNorm = stripAccents(activeStaff?.ho_ten || '').toLowerCase().trim();

    const base = activeStaff ? allData.filter(i => {
      const mPId = String(i.pic_id || '').trim().toLowerCase();
      const mPName = stripAccents(i.pic || '').toLowerCase().trim();
      return (pidNorm && mPId && mPId === pidNorm) || (pNameNorm && mPName && mPName === pNameNorm);
    }) : allData;

    let filteredData = base;
    if (weekFilter !== 'All') {
      const targetWeekNum = parseInt(String(weekFilter).match(/\d+/)?.[0]) || 0;
      filteredData = filteredData.filter(i => (parseInt(String(i.week).match(/\d+/)?.[0]) || 0) === targetWeekNum);
    }
    if (brandFilter !== 'All') filteredData = filteredData.filter(i => i.brand === brandFilter);

    const f = filteredData.filter(i => !String(i.job_code || '').toUpperCase().includes('NEW_'));
    const sAdhocs = filteredData.filter(i => String(i.job_code || '').toUpperCase().includes('NEW_'));

    const adhocFiltered = adhocData.filter(i => {
      const okWeek = weekFilter === 'All' || (parseInt(String(i.week).match(/\d+/)?.[0]) || 0) === (parseInt(String(weekFilter).match(/\d+/)?.[0]) || 0);
      const okBrand = brandFilter === 'All' || i.brand === brandFilter;
      const mPId = String(i.pic_id || '').trim().toLowerCase();
      const mPName = stripAccents(i.pic || '').toLowerCase().trim();
      const picMatch = !activeStaff || (pidNorm && mPId && mPId === pidNorm) || (pNameNorm && mPName && mPName === pNameNorm);
      return okWeek && okBrand && picMatch;
    });

    const staffSet = [...new Set(allData.map(i => i.pic).filter(Boolean))].sort();
    const _todayNum = getCustomWeekNumber(new Date());
    const _effNum = new Date().getDay() === 4 ? _todayNum + 1 : _todayNum;
    const uWeeks = [...new Set(allData.map(i => i.week).filter(Boolean))].sort((a,b) => {
        const na = parseInt(String(a).match(/\d+/)?.[0]) || 0;
        const nb = parseInt(String(b).match(/\d+/)?.[0]) || 0;
        // Current effective week always first, then descending (newest → oldest)
        if (na === _effNum) return -1;
        if (nb === _effNum) return 1;
        return nb - na;
    });
    const uBrands = [...new Set(allData.map(i => i.brand).filter(Boolean))].sort();

    return { filtered: f, syncedAdhocs: sAdhocs, filteredAdhoc: adhocFiltered, uniqueWeeks: uWeeks, uniqueBrands: uBrands, allStaff: staffSet };
  }, [allData, adhocData, user, selectedStaff, weekFilter, brandFilter]);

  const kpis = useMemo(() => {
    const assignedTotal = filtered.length;
    const assignedDone = filtered.filter(i => i.status === 'Done').length;
    const syncAdhocCount = syncedAdhocs.length;
    const localAdhocCount = filteredAdhoc.length;
    
    // De-duplicate adhoc points by job_code
    const adhocMap = new Map();
    syncedAdhocs.forEach(i => adhocMap.set(i.job_code, i));
    filteredAdhoc.forEach(i => adhocMap.set(i.job_code, i));
    const totalDone = assignedDone + adhocMap.size;

    const percent = Math.min(100, Math.round((totalDone / 75) * 100)); // Target 75/week
    const efficiency = assignedTotal > 0 ? Math.round((assignedDone / assignedTotal) * 100) : 0;

    // ── PROFESSIONAL ADJUSTED FORMULA (Reference: modern-dashboard) ──
    const EXCLUDE_REASONS = ["đóng cửa", "chính sách", "không hợp tác", "ngoài giờ", "tháo", "không liên lạc"];
    
    const calculateProfessionalStats = (recs) => {
      const completed = recs.filter(r => r.status === 'Done');

      const hasPosm = completed.filter(r => {
        const s = stripAccents(r.posm_status || "");
        // Match chính xác: "co posm", "co", "yes", "dat", "co posm" — KHÔNG match "khong"
        return (s.startsWith("co") && !s.startsWith("cong") && !s.startsWith("con ") && !s.startsWith("copy")) ||
               s === "yes" || s === "ok" || s === "dat" ||
               s.includes("co posm") || s.includes("yes posm") || s.includes("co khung");
      }).length;

      const noPosm = completed.filter(r => {
        const s = stripAccents(r.posm_status || "");
        return s.includes("khong") || s.includes("no posm") || s === "no" || s.includes("da thao") || s.includes("thao posm");
      }).length;

      const exemptCount = completed.filter(r => {
        const reason = stripAccents(r.posm_status || r.acceptance_note || "");
        const exemptNorm = EXCLUDE_REASONS.map(e => stripAccents(e));
        return exemptNorm.some(ex => reason.includes(ex));
      }).length;

      const hasFrame = completed.filter(r => r.is_frame).length;

      // Adjusted Denominator: chỉ tính những điểm đã check thực sự (loại trừ exempt)
      const adjustedNoPosm = Math.max(0, noPosm - exemptCount);
      const denominator = hasPosm + adjustedNoPosm;
      const rate = denominator > 0 ? Math.round((hasPosm / denominator) * 100) : 0;

      const frameRate = completed.length > 0 ? Math.round((hasFrame / completed.length) * 100) : 0;
      return { total: recs.length, done: completed.length, hasPosm, noPosm, exemptCount, hasFrame, frameRate, rate, denominator };
    };

    const overall = calculateProfessionalStats(filtered);
    const mallStats = calculateProfessionalStats(filtered.filter(isMall));
    const streetStats = calculateProfessionalStats(filtered.filter(r => !isMall(r)));

    const strip = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    // ── URGIFT STATUS ANALYSIS (cột H: Hoạt động UrGift) ──────────────────
    // Các giá trị chính thức từ cột H:
    //   "Đóng cửa"                          → cửa hàng đóng cửa
    //   "Hoạt động ngoài giờ hành chính"    → hoạt động ngoài giờ
    //   "Site check"                         → bình thường
    //   "Hoạt động"                          → bình thường

    // ── TỈ LỆ ĐÓNG CỬA (Cột H: Hoạt động UrGift) ───────────────────────────
    // urgift_status được overlay từ acceptance sheet (cột "Hoạt động UrGift")
    // Giá trị thực: "Đóng cửa/Hoạt động ngoài giờ hành chính", "Site check - Kiểm tra...", etc.
    // Tất cả records Done đều có urgift_status nếu nhân viên đã báo cáo
    const getUrgiftStatus = (r) => strip(r.urgift_status || r.raw_mission_status || '');

    // Tính trên TẤT CẢ filtered (kể cả chưa Done) để bắt những điểm đóng cửa bị skip
    const closedCount = filtered.filter(r => getUrgiftStatus(r).includes('dong cua')).length;

    // Fallback: nếu không có urgift_status nào (chưa sync), đếm từ acceptance_note
    const closedCountFallback = closedCount === 0
      ? filtered.filter(r => strip(r.acceptance_note || r.posm_status || '').includes('dong cua')).length
      : 0;
    const closedTotal = closedCount + closedCountFallback;

    const closedRate = assignedTotal > 0 ? Math.round((closedTotal / assignedTotal) * 100) : 0;
    const afterHoursCount = filtered.filter(r => {
      const u = getUrgiftStatus(r);
      return !u.includes('dong cua') && u.includes('ngoai gio');
    }).length;
    const afterHoursRate = assignedTotal > 0 ? Math.round((afterHoursCount / assignedTotal) * 100) : 0;
    const urgiftDistribution = {};

    const staffStats = allStaff.map(name => {
      const staffPoints = allData.filter(i => i.pic === name);
      let staffFiltered = staffPoints;
      if (weekFilter !== 'All') {
        const targetWeekNum = parseInt(String(weekFilter).match(/\d+/)?.[0]) || 0;
        staffFiltered = staffFiltered.filter(i => (parseInt(String(i.week).match(/\d+/)?.[0]) || 0) === targetWeekNum);
      }
      const sDone = staffFiltered.filter(i => i.status === 'Done').length;
      const sAssigned = staffFiltered.filter(i => !String(i.job_code || '').toUpperCase().includes('NEW_')).length;
      return {
        name,
        done: sDone,
        percent: Math.min(100, Math.round((sDone / 75) * 100)),
        efficiency: sAssigned > 0 ? Math.round((staffFiltered.filter(i => i.status === 'Done' && !String(i.job_code || '').toUpperCase().includes('NEW_')).length / sAssigned) * 100) : 0
      };
    }).sort((a,b) => b.percent - a.percent);

    return {
      total: assignedTotal,
      done: totalDone,
      percent,
      efficiency,
      closedRate,
      afterHoursCount,
      afterHoursRate,
      urgiftDistribution,
      posmRate: overall.rate,
      hasFrame: overall.hasFrame,
      exemptCount: overall.exemptCount,
      denominator: overall.denominator,
      closedCount: closedTotal,
      staffStats,
      frameRate: overall.frameRate,
      mall: { posmRate: mallStats.rate, hasFrame: mallStats.hasFrame, frameRate: mallStats.frameRate, total: mallStats.total },
      nonMall: { posmRate: streetStats.rate, hasFrame: streetStats.hasFrame, frameRate: streetStats.frameRate, total: streetStats.total }
    };
  }, [filtered, syncedAdhocs, filteredAdhoc, allStaff, allData, weekFilter]);

  const chartData = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const w = item.week || 'N/A';
      if (!map[w]) map[w] = { total: 0, done: 0 };
      map[w].total++;
      if (item.status === 'Done') map[w].done++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => (parseInt(String(a).match(/\d+/)?.[0]) || 0) - (parseInt(String(b).match(/\d+/)?.[0]) || 0))
      .map(([label, d]) => ({ label: label.match(/\d+/)?.[0] ? `W${label.match(/\d+/)?.[0]}` : label, ...d }));
  }, [filtered]);

  const alerts = useMemo(() => {
    const res = [];
    if (kpis.closedRate > 15) res.push({ severity: 'high', text: `Tỉ lệ cửa hàng đóng cửa cao (${kpis.closedRate}% — ${kpis.closedCount} điểm). Cần kiểm tra lại lộ trình hoặc giờ giấc thi công.` });
    if (kpis.afterHoursRate > 10) res.push({ severity: 'medium', text: `${kpis.afterHoursCount} điểm hoạt động ngoài giờ hành chính (${kpis.afterHoursRate}%). Cân nhắc bố trí ca chiều/tối.` });
    if (kpis.percent < 50 && weekFilter !== 'All') res.push({ severity: 'medium', text: `Tiến độ tuần đang chậm. Hiện chỉ mới đạt ${kpis.percent}% mục tiêu.` });
    if (res.length === 0) res.push({ severity: 'low', text: `Chiến dịch đang vận hành ổn định.` });
    return res;
  }, [kpis, weekFilter]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <RefreshCw className="animate-spin text-indigo-600" size={32} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tải báo cáo sếp...</p>
    </div>
  );

  return (
    <div className="min-h-full bg-slate-50 pb-32 font-sans selection:bg-indigo-100 italic-none">
      
      {/* ── HEADER ── */}
      <div className="bg-white px-6 pt-12 pb-8 shadow-sm border-b border-slate-100 sticky top-0 z-20 bg-white/80 backdrop-blur-md">
        <div className="flex justify-between items-start mb-8">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Executive Dashboard</h1>
                <p className="text-[10px] font-black text-slate-400 mt-1 flex items-center gap-2 uppercase tracking-widest">
                    <Clock size={12} /> Sync: {lastSync ? new Date(lastSync).toLocaleTimeString() : '--'}
                </p>
            </div>
            <div className="bg-indigo-900 p-3 rounded-2xl text-white shadow-lg shadow-indigo-100">
                <ShieldAlert size={20} />
            </div>
        </div>

        <div className="flex gap-3">
          <select value={weekFilter} onChange={e => setWeekFilter(e.target.value)} className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-4 text-xs font-black text-slate-800 outline-none shadow-inner appearance-none">
            <option value="All">Tuần</option>
            {uniqueWeeks.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
          <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-4 text-xs font-black text-slate-800 outline-none shadow-inner appearance-none">
            <option value="All">Tất cả Brand</option>
            {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      <div className="px-6 pt-8 space-y-8">
        
        {/* ── MAIN KPI ── */}
        <section className="bg-white rounded-[3.5rem] p-10 shadow-premium border border-slate-50 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-60" />
            <h2 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] mb-8 relative z-10">Tiến độ hoàn thành hệ thống</h2>
            <DoughnutChart percent={kpis.percent} total={kpis.total} done={kpis.done} color={kpis.percent > 75 ? TEAL : kpis.percent > 40 ? AMBER : RED} />

            <div className="grid grid-cols-2 w-full mt-12 gap-4 relative z-10">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Hiệu suất tuyến</p>
                    <p className="text-3xl font-black text-indigo-900 tracking-tighter">{kpis.efficiency}%</p>
                </div>
                <div className="bg-teal-50 p-6 rounded-3xl border border-teal-100">
                    <p className="text-[9px] font-black text-teal-500 uppercase tracking-widest mb-1">Tỉ lệ Frame</p>
                    <p className="text-3xl font-black text-teal-600 tracking-tighter">{kpis.frameRate}%</p>
                    <p className="text-[9px] font-bold text-teal-300 mt-1">{kpis.hasFrame} điểm</p>
                </div>
            </div>
        </section>

        {/* ── POSM DENSITY ANALYSIS ── */}
        <section className="space-y-4">
            <div className="flex items-center gap-2 px-2">
                <Trophy size={16} className="text-amber-500" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Số liệu POSM thực tế</h2>
            </div>
            
            <div className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/20 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="flex justify-between items-start relative z-10">
                    <div>
                        <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2">Tỉ lệ có POSM (ADJUSTED)</p>
                        <h4 className="text-6xl font-black tracking-tighter">{kpis.posmRate}%</h4>
                        <div className="flex gap-4 mt-6">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Loại trừ</span>
                                <span className="text-sm font-black text-rose-400">{kpis.exemptCount}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Frame</span>
                                <span className="text-sm font-black text-teal-400">{kpis.frameRate}%</span>
                            </div>
                            <div className="flex flex-col border-l border-slate-700 pl-4">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight font-black">MẪU SỐ CHUẨN</span>
                                <span className="text-sm font-black text-indigo-300">{kpis.denominator}</span>
                            </div>
                        </div>
                    </div>
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-md">
                        <CheckCircle2 size={32} className="text-indigo-400" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-50 flex flex-col gap-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">POSM Tại Mall</p>
                    <div className="flex items-end justify-between">
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-slate-800">{kpis.mall.posmRate}%</span>
                            <span className="text-[8px] font-bold text-teal-400 uppercase">Frame: {kpis.mall.frameRate}%</span>
                        </div>
                        <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-500" style={{width: `${kpis.mall.posmRate}%`}} />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-50 flex flex-col gap-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">POSM Street</p>
                    <div className="flex items-end justify-between">
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-slate-800">{kpis.nonMall.posmRate}%</span>
                            <span className="text-[8px] font-bold text-amber-400 uppercase">Frame: {kpis.nonMall.frameRate}%</span>
                        </div>
                        <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500" style={{width: `${kpis.nonMall.posmRate}%`}} />
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* ── STAFF PERFORMANCE ── */}
        <section className="bg-white rounded-[3rem] p-8 shadow-premium border border-slate-50 overflow-hidden">
            <div className="flex justify-between items-center mb-8 px-2">
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                    <Users size={16} className="text-indigo-600" /> Hiệu suất nhân sự
                </h2>
                <div className="text-[9px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">TARGET: 75/W</div>
            </div>

            <div className="space-y-6">
                {kpis.staffStats.slice(0, 10).map((s, idx) => (
                    <div key={s.name} className="flex items-center gap-4 group">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                            #{idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-xs font-black text-slate-700 truncate">{s.name}</span>
                                <span className="text-[10px] font-black text-indigo-600">{s.percent}%</span>
                            </div>
                            <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden relative">
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${s.percent}%` }}
                                    className="h-full bg-indigo-500 rounded-full" 
                                />
                            </div>
                            <div className="flex justify-between mt-1.5 px-0.5">
                                <span className="text-[8px] font-bold text-slate-300 uppercase">Hiệu suất: {s.efficiency}%</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{s.done} Done</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>


      </div>
    </div>
  );
};

export default OverviewDashboard;
