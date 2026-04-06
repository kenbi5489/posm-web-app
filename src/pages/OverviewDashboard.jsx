import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import {
  LayoutGrid, CheckCircle2, CircleDashed, TrendingUp,
  AlertTriangle, ChevronDown, Clock, RefreshCw
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// TỔNG QUAN POSM — Executive Overview Dashboard
// Data source: posmData (same as main Dashboard)
// KPI logic: status === 'Done' vs 'On-going' (consistent with main Dashboard)
// ═══════════════════════════════════════════════════════════════════════════

const ACCENT = '#0f3460';
const ACCENT_LIGHT = '#e8eef6';
const TEAL = '#0d9488';
const TEAL_LIGHT = '#ccfbf1';
const AMBER = '#d97706';
const AMBER_LIGHT = '#fef3c7';
const RED = '#dc2626';
const RED_LIGHT = '#fee2e2';
const SLATE_50 = '#f8fafc';

// ─── Symbols for readability
const isMall = (rec) => {
  if (rec.mall_name && rec.mall_name !== 'N/A' && rec.mall_name !== '') return true;
  const type = (rec.location_type || '').toLowerCase();
  return type.includes('mall') || type.includes('ttm') || type.includes('trung tâm');
};


// ─── Lightweight SVG Bar Chart ──────────────────────────────────────────────
const BarChart = ({ data, height = 200 }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.total), 1);
  const barW = Math.min(40, Math.floor(280 / data.length) - 8);

  return (
    <svg viewBox={`0 0 ${data.length * (barW + 12) + 20} ${height + 40}`} className="w-full" style={{ maxHeight: height + 40 }}>
      {data.map((d, i) => {
        const x = 10 + i * (barW + 12);
        const totalH = (d.total / max) * height;
        const doneH = (d.done / max) * height;
        return (
          <g key={i}>
            <rect x={x} y={height - totalH} width={barW} height={totalH} rx={barW / 4} fill={ACCENT_LIGHT} />
            <rect x={x} y={height - doneH} width={barW} height={doneH} rx={barW / 4} fill={ACCENT} opacity={0.85} />
            <text x={x + barW / 2} y={height + 18} textAnchor="middle" fontSize="10" fontWeight="700" fill="#94a3b8">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Horizontal Progress Bar ────────────────────────────────────────────────
const ProgressBar = ({ percent, color = ACCENT }) => (
  <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex-1">
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${percent}%` }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="h-full rounded-full"
      style={{ backgroundColor: color }}
    />
  </div>
);

// ─── KPI Card ───────────────────────────────────────────────────────────────
const KPICard = ({ icon, label, value, sub, accent = false }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className={`rounded-2xl p-6 border transition-all ${
      accent
        ? 'bg-[#0f3460] text-white border-[#0f3460] shadow-lg'
        : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
    }`}
  >
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 ${accent ? 'bg-white/15' : 'bg-slate-50'}`}>
      {icon}
    </div>
    <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${accent ? 'text-white/60' : 'text-slate-400'}`}>
      {label}
    </p>
    <p className={`text-3xl font-extrabold tracking-tight leading-none ${accent ? 'text-white' : 'text-slate-800'}`}>
      {value}
    </p>
    {sub && (
      <p className={`text-[11px] font-medium mt-2 ${accent ? 'text-white/50' : 'text-slate-400'}`}>
        {sub}
      </p>
    )}
  </motion.div>
);

// ─── Alert Item ─────────────────────────────────────────────────────────────
const AlertItem = ({ severity, text }) => {
  const colors = {
    high: { bg: RED_LIGHT, text: RED, badge: 'Quan trọng' },
    medium: { bg: AMBER_LIGHT, text: AMBER, badge: 'Chú ý' },
    low: { bg: TEAL_LIGHT, text: TEAL, badge: 'Thông tin' },
  };
  const c = colors[severity] || colors.low;
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-slate-50 last:border-b-0">
      <span
        className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0 mt-0.5"
        style={{ backgroundColor: c.bg, color: c.text }}
      >
        {c.badge}
      </span>
      <p className="text-[13px] text-slate-600 font-medium leading-snug">{text}</p>
    </div>
  );
};

// ─── Breakdown Row ──────────────────────────────────────────────────────────
const BreakdownRow = ({ rank, name, value, total, percent, color }) => {
  const barColor = color || (percent < 40 ? RED : percent < 70 ? AMBER : TEAL);
  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-slate-50 last:border-b-0">
      <span className="text-[11px] font-bold text-slate-300 w-5 text-right">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-semibold text-slate-700 truncate">{name}</span>
          <span className="text-xs font-bold text-slate-400 shrink-0 ml-2">{value}/{total}</span>
        </div>
        <div className="flex items-center gap-3">
          <ProgressBar percent={percent} color={barColor} />
          <span className="text-xs font-bold w-10 text-right" style={{ color: barColor }}>{percent}%</span>
        </div>
      </div>
    </div>
  );
};

const PhotoCard = ({ url, label, code }) => (
  <div className="min-w-[120px] aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden relative group">
    {url ? (
      <img src={url} alt={label} className="w-full h-full object-cover" />
    ) : (
      <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-300 font-bold p-2 text-center">Không có ảnh</div>
    )}
    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 backdrop-blur-sm">
      <p className="text-[8px] font-black text-white truncate">{code}</p>
      <p className="text-[7px] text-white/70 uppercase tracking-tighter">{label}</p>
    </div>
  </div>
);


// ═══════════════════════════════════════════════════════════════════════════
// Main Component — uses SAME data source & logic as Dashboard.jsx
// ═══════════════════════════════════════════════════════════════════════════

const OverviewDashboard = () => {
  const { user, selectedStaff, lastSync } = useAuth();
  const [allData, setAllData] = useState([]);
  const [acceptance, setAcceptance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekFilter, setWeekFilter] = useState('All');
  const [brandFilter, setBrandFilter] = useState('All');


  // ── Load from posmData (same source as Dashboard.jsx) ─────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [posm, acc] = await Promise.all([
        db.posmData.toArray(),
        db.acceptanceData.toArray()
      ]);
      setAllData(posm);
      setAcceptance(acc);
      setLoading(false);
    };
    load();
  }, [lastSync]);


  // ── Filter by selected staff (same logic as Dashboard.jsx) ────────────────
  const { filtered, uniqueWeeks, uniqueBrands } = useMemo(() => {
    const picId = selectedStaff?.user_id || (user?.role === 'staff' ? user.user_id : null);
    const staffName = selectedStaff?.ho_ten || (user?.role === 'staff' ? user.ho_ten : null);

    let base = allData;
    if (picId || staffName) {
      const matchId = picId ? picId.toString().trim() : null;
      const normalizedStaffName = staffName ? staffName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : null;

      base = allData.filter(item => {
        const itemPicId = (item.pic_id || '').toString().trim();
        const matchById = matchId && itemPicId && (itemPicId === matchId);

        const itemPic = item.pic ? item.pic.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
        const matchByName = normalizedStaffName && itemPic && (itemPic === normalizedStaffName || itemPic.includes(normalizedStaffName) || normalizedStaffName.includes(itemPic));

        return matchById || matchByName;
      });
    }

    const uWeeks = [...new Set(base.map(i => i.week))].filter(Boolean).sort((a, b) => {
      return (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0);
    });
    const uBrands = [...new Set(base.map(i => i.brand))].filter(Boolean).sort();

    let f = base;
    if (weekFilter !== 'All') f = f.filter(i => i.week === weekFilter);
    if (brandFilter !== 'All') f = f.filter(i => i.brand === brandFilter);

    return { filtered: f, uniqueWeeks: uWeeks, uniqueBrands: uBrands };
  }, [allData, user, selectedStaff, weekFilter, brandFilter]);

  // ── KPIs (same formula as Dashboard.jsx) ──────────────────────────────────
  const kpis = useMemo(() => {
    const total = filtered.length;
    const done = filtered.filter(i => i.status === 'Done').length;
    const pending = total - done;
    const percent = Math.min(100, Math.round((done / Math.max(total, 1)) * 100));

    // Mall vs Non-mall Analysis
    const mallRecs = filtered.filter(isMall);
    const nonMallRecs = filtered.filter(r => !isMall(r));
    
    const mallDone = mallRecs.filter(r => r.status === 'Done').length;
    const nonMallDone = nonMallRecs.filter(r => r.status === 'Done').length;

    return { 
      total, done, pending, percent,
      mall: { total: mallRecs.length, done: mallDone, percent: Math.round((mallDone / Math.max(mallRecs.length, 1)) * 100) },
      nonMall: { total: nonMallRecs.length, done: nonMallDone, percent: Math.round((nonMallDone / Math.max(nonMallRecs.length, 1)) * 100) }
    };
  }, [filtered]);


  // ── Chart Data (by week) ──────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const weekMap = {};
    filtered.forEach(item => {
      const w = item.week || 'N/A';
      if (!weekMap[w]) weekMap[w] = { total: 0, done: 0 };
      weekMap[w].total++;
      if (item.status === 'Done') weekMap[w].done++;
    });

    return Object.entries(weekMap)
      .sort(([a], [b]) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0))
      .map(([label, d]) => ({ label: label.replace(/\D/g, '') ? `W${label.replace(/\D/g, '')}` : label, ...d }));
  }, [filtered]);

  // ── Smart Alerts ──────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const result = [];

    // Brand with lowest completion
    const brandMap = {};
    filtered.forEach(item => {
      const b = item.brand || 'Unknown';
      if (!brandMap[b]) brandMap[b] = { total: 0, done: 0 };
      brandMap[b].total++;
      if (item.status === 'Done') brandMap[b].done++;
    });

    const lowBrands = Object.entries(brandMap)
      .filter(([, d]) => d.total >= 3 && (d.done / d.total) < 0.4)
      .sort((a, b) => (a[1].done / a[1].total) - (b[1].done / b[1].total));

    if (lowBrands.length > 0) {
      const [name, d] = lowBrands[0];
      result.push({
        severity: 'high',
        text: `${name} có tỷ lệ hoàn thành thấp nhất: ${Math.round((d.done / d.total) * 100)}% (${d.done}/${d.total})`
      });
    }

    // District bottlenecks
    const districtMap = {};
    filtered.forEach(item => {
      const d = item.district || 'Khác';
      if (!districtMap[d]) districtMap[d] = { total: 0, pending: 0 };
      districtMap[d].total++;
      if (item.status !== 'Done') districtMap[d].pending++;
    });

    const hotDistricts = Object.entries(districtMap)
      .filter(([, d]) => d.pending >= 3)
      .sort((a, b) => b[1].pending - a[1].pending);

    if (hotDistricts.length > 0) {
      const [name, d] = hotDistricts[0];
      result.push({
        severity: 'medium',
        text: `${name} còn ${d.pending} điểm chưa triển khai (${d.total} tổng)`
      });
    }

    // Overall rate
    if (kpis.percent < 50 && kpis.total > 5) {
      result.push({
        severity: 'high',
        text: `Tỷ lệ hoàn thành tổng thể chỉ đạt ${kpis.percent}% — cần đẩy mạnh triển khai`
      });
    } else if (kpis.percent >= 80) {
      result.push({
        severity: 'low',
        text: `Tỷ lệ hoàn thành đạt ${kpis.percent}% — tiến độ rất tốt`
      });
    }

    if (kpis.pending > 0 && kpis.pending <= 5) {
      result.push({
        severity: 'low',
        text: `Chỉ còn ${kpis.pending} điểm chưa hoàn thành — sắp đạt mục tiêu`
      });
    }

    return result.slice(0, 5);
  }, [filtered, kpis]);

  // ── Breakdown: Top 5 Districts (High performance)
  const topDistricts = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const d = item.district || 'Khác';
      if (!map[d]) map[d] = { total: 0, done: 0 };
      map[d].total++;
      if (item.status === 'Done') map[d].done++;
    });

    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        done: d.done,
        total: d.total,
        percent: Math.round((d.done / d.total) * 100)
      }))
      .filter(d => d.total >= 1)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 5);
  }, [filtered]);

  // ── Recent Evidence Gallery
  const recentPhotos = useMemo(() => {
    const doneJobCodes = new Set(filtered.filter(r => r.status === 'Done').map(r => r.job_code));
    return acceptance
      .filter(a => doneJobCodes.has(a.job_code))
      .filter(a => a.image1 || a.image2)
      .slice(-10)
      .reverse();
  }, [filtered, acceptance]);


// Breakdown section removed to be replaced by Gallery


  // ── Sync label ────────────────────────────────────────────────────────────
  const syncLabel = lastSync
    ? `Cập nhật: ${new Date(lastSync).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}`
    : 'Chưa đồng bộ';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="animate-spin text-slate-300" size={28} />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-full bg-[#f8f9fb] pb-32">

      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-6 pt-5 pb-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Tổng quan POSM
            </h1>
            <p className="text-[12px] text-slate-400 font-medium mt-1">
              Theo dõi nhanh tình hình POSM toàn hệ thống
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium bg-slate-50 px-3 py-2 rounded-xl">
            <Clock size={12} className="text-slate-300" />
            {syncLabel}
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative">
            <select
              value={weekFilter}
              onChange={e => setWeekFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-100 rounded-xl pl-4 pr-9 py-2.5 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all"
            >
              <option value="All">Tuần: Tất cả</option>
              {uniqueWeeks.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-100 rounded-xl pl-4 pr-9 py-2.5 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all max-w-[160px]"
            >
              <option value="All">Brand: Tất cả</option>
              {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="px-6 pt-6 space-y-6">

        {/* ─── KPI CARDS ───────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={<LayoutGrid size={18} style={{ color: ACCENT }} />}
            label="Tổng điểm"
            value={kpis.total}
            sub="Toàn bộ hệ thống"
          />
          <KPICard
            icon={<CheckCircle2 size={18} style={{ color: '#fff' }} />}
            label="Đã hoàn thành"
            value={kpis.done}
            sub={`${kpis.percent}% mục tiêu`}
            accent
          />
          <KPICard
            icon={<CircleDashed size={18} style={{ color: AMBER }} />}
            label="Chưa hoàn thành"
            value={kpis.pending}
            sub="Cần triển khai"
          />
          <KPICard
            icon={<TrendingUp size={18} style={{ color: TEAL }} />}
            label="Tỷ lệ hoàn thành"
            value={`${kpis.percent}%`}
            sub={kpis.percent >= 80 ? 'Tiến độ tốt' : kpis.percent >= 50 ? 'Đang triển khai' : 'Cần đẩy mạnh'}
          />
        </section>

        {/* ─── INSIGHT AREA (Chart + Alerts) ───────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-span-3 bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Tiến độ theo tuần</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Tổng điểm (sáng) vs Đã hoàn thành (đậm)</p>
              </div>
            </div>
            {chartData.length > 0 ? (
              <BarChart data={chartData} height={180} />
            ) : (
              <div className="flex items-center justify-center h-[180px] text-slate-300 text-xs font-medium">
                Chưa có dữ liệu biểu đồ
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
          >
            <div className="flex items-center gap-2 mb-5">
              <AlertTriangle size={15} className="text-amber-500" />
              <h2 className="text-sm font-bold text-slate-800">Cần chú ý</h2>
            </div>
            {alerts.length > 0 ? (
              <div>
                {alerts.map((a, i) => (
                  <AlertItem key={i} severity={a.severity} text={a.text} />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-slate-300 text-xs font-medium">
                Không có cảnh báo
              </div>
            )}
          </motion.div>
        </section>

        {/* ─── SECONDARY INSIGHTS ─────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
           {/* Mall vs Non-mall */}
           <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white rounded-2xl p-6 border border-slate-100 shadow-soft"
           >
              <h2 className="text-sm font-bold text-slate-800 mb-4">Mall vs Ngoài Mall</h2>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Trong Mall</span>
                    <span className="text-sm font-black text-slate-800">{kpis.mall.percent}% <span className="text-[10px] text-slate-400 font-normal">({kpis.mall.done}/{kpis.mall.total})</span></span>
                  </div>
                  <ProgressBar percent={kpis.mall.percent} color={ACCENT} />
                </div>
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Ngoài Mall</span>
                    <span className="text-sm font-black text-slate-800">{kpis.nonMall.percent}% <span className="text-[10px] text-slate-400 font-normal">({kpis.nonMall.done}/{kpis.nonMall.total})</span></span>
                  </div>
                  <ProgressBar percent={kpis.nonMall.percent} color={TEAL} />
                </div>
              </div>
           </motion.div>

           {/* Top Districts */}
           <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }}
            className="bg-white rounded-2xl p-6 border border-slate-100 shadow-soft"
           >
              <h2 className="text-sm font-bold text-slate-800 mb-4">Khu vực có POSM cao nhất (Top 5)</h2>
              {topDistricts.length > 0 ? (
                <div>
                  {topDistricts.map((d, i) => (
                    <BreakdownRow key={d.name} rank={i + 1} name={d.name} value={d.done} total={d.total} percent={d.percent} color={TEAL} />
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-xs text-slate-300 font-bold">Chưa có dữ liệu khu vực</div>
              )}
           </motion.div>
        </section>

        {/* ─── EVIDENCE GALLERY ────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white rounded-2xl p-6 border border-slate-100 shadow-soft"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800">Ảnh nghiệm thu thực tế</h2>
            <p className="text-[10px] text-slate-400 font-medium">Bằng chứng triển khai mới nhất</p>
          </div>
          
          {recentPhotos.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar snap-x">
               {recentPhotos.map((p, idx) => (
                 <React.Fragment key={idx}>
                   {p.image1 && <PhotoCard url={p.image1} label="Ảnh 1" code={p.job_code} />}
                   {p.image2 && <PhotoCard url={p.image2} label="Ảnh 2" code={p.job_code} />}
                 </React.Fragment>
               ))}
            </div>
          ) : (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chưa có ảnh nghiệm thu</p>
            </div>
          )}
        </motion.section>

        {/* ─── FOOTER NOTE ─────────────────────────────────────────────────── */}
        <div className="text-center pb-4 pt-2">
          <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
            Dữ liệu lấy từ hệ thống Google Sheets · Tự động làm mới khi đăng nhập · {syncLabel}
          </p>
        </div>
      </div>
    </div>
  );
};

export default OverviewDashboard;
