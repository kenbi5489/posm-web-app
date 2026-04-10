import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { fetchAcceptanceData } from '../services/api';
import { TrendingUp, LayoutGrid, CheckCircle2, Image as ImageIcon, MapPin, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminDashboard = () => {
  const [data, setData] = useState({
    posm: [],
    reports: [],
    loading: true
  });
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [posm, adhoc, reports] = await Promise.all([
          db.posmData.toArray(),
          db.adhocPoints ? db.adhocPoints.toArray() : [],
          fetchAcceptanceData()
        ]);

        // Map reports to standard fields based on Sheet headers
        const mappedReports = (reports || []).map(r => ({
          timestamp: r["Timestamp"] || r["Thời gian"],
          job_code: r["Mã CV"] || r["Job Code"],
          brand: r["Brand"] || r["Tên Brand"],
          image1: r["Hình ảnh 1"] || r["Image 1"] || r["image1"],
          status: r["Trạng thái"] || r["Status"] || r["posmStatus"],
          pic: r["Mã NV"] || r["Staff"]
        })).filter(r => r.image1); // Only show reports with images

        setData({
          posm,
          adhoc,
          reports: mappedReports.slice(0, 50), // Show latest 50
          loading: false
        });
      } catch (err) {
        console.error('AdminDashboard Load Error:', err);
        setData(v => ({ ...v, loading: false }));
      }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const assignedFiltered = data.posm.filter(i => !String(i.job_code || '').toUpperCase().includes('NEW_'));
    const syncedAdhocs = data.posm.filter(i => String(i.job_code || '').toUpperCase().includes('NEW_'));

    // De-duplicate local and synced ad-hoc points
    const adhocMap = new Map();
    syncedAdhocs.forEach(item => { if (item.job_code) adhocMap.set(item.job_code, item); });
    (data.adhoc || []).forEach(item => { if (item.job_code) adhocMap.set(item.job_code, item); });
    const finalAdhoc = Array.from(adhocMap.values());

    const totalPosm = assignedFiltered.length;
    const donePosm = assignedFiltered.filter(i => i.status === 'Done' || i.status === 'Hoàn tất').length;

    const adhocCount = finalAdhoc.length;
    const total = totalPosm; // target is fixed to distribution
    const done = donePosm + adhocCount;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;

    const districts = {};
    data.posm.forEach(i => {
      const d = String(i.district || 'Khác').trim();
      if (!districts[d]) districts[d] = { name: d, total: 0, done: 0 };
      districts[d].total++;
      if (i.status === 'Done' || i.status === 'Hoàn tất') districts[d].done++;
    });

    return { total, done, rate, districts: Object.values(districts).sort((a, b) => b.total - a.total) };
  }, [data]);

  if (data.loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tải báo cáo sếp...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-white pb-32 animate-fade-in">
      {/* Header - Simple & Clean */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100 px-6 py-5 flex justify-between items-center bg-white/80 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-indigo-900 tracking-tight">BÁO CÁO TỔNG QUAN</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dữ liệu thực tế điểm POSM</p>
        </div>
        <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
          <TrendingUp size={20} />
        </div>
      </div>

      {/* KPI Section - Large & Clear */}
      <div className="px-5 py-8 space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white">
            <p className="text-[9px] font-black opacity-40 uppercase tracking-widest mb-1">Tổng độ phủ</p>
            <h4 className="text-4xl font-black">{stats.total}</h4>
            <p className="text-[10px] font-bold opacity-60 mt-1 uppercase">Điểm triển khai</p>
          </div>
          <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white shadow-lg shadow-indigo-100">
            <p className="text-[9px] font-black opacity-60 uppercase tracking-widest mb-1">Hoàn tất (%)</p>
            <h4 className="text-4xl font-black">{stats.rate}%</h4>
            <p className="text-[10px] font-bold opacity-80 mt-1 uppercase">{stats.done} điểm đã báo cáo</p>
          </div>
        </div>

        {/* Real Report Grid - Professional grid */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon size={14} className="text-indigo-400" /> HÌNH ẢNH MỚI NHẤT ({data.reports.length})
            </h3>
            <span className="text-[8px] font-black bg-slate-50 text-slate-400 px-2 py-1 rounded-full uppercase">Cloud Data</span>
          </div>

          <div className="grid grid-cols-2 xs:grid-cols-3 gap-3">
            {data.reports.map((report, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedImage(report)}
                className="aspect-square bg-slate-100 rounded-3xl overflow-hidden relative group active:scale-95 transition-all shadow-sm"
              >
                <img
                  src={report.image1}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  alt="POSM"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex flex-col justify-end">
                  <p className="text-[8px] font-black text-white uppercase truncate">{report.brand}</p>
                  <p className="text-[7px] font-bold text-white/60 uppercase">{report.job_code}</p>
                </div>
              </div>
            ))}
            {data.reports.length === 0 && (
              <div className="col-span-full py-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">Không có ảnh nào trên hệ thống</p>
              </div>
            )}
          </div>
        </section>

        {/* Area Progress - Simple list */}
        <section className="space-y-4 pt-4 border-t border-slate-50">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
            <MapPin size={14} className="text-indigo-400" /> TIẾN ĐỘ THEO QUẬN
          </h3>
          <div className="space-y-2">
            {stats.districts.map((d) => (
              <div key={d.name} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <p className="text-xs font-black text-slate-800 uppercase leading-none">{d.name}</p>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-slate-400">{d.done}/{d.total} Done</span>
                  <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${(d.done / d.total) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* LIGHTBOX PREVIEW */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-md p-6 flex flex-col items-center justify-center gap-6"
          >
            <div className="relative w-full max-w-sm aspect-[3/4] bg-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
              <img src={selectedImage.image1} className="w-full h-full object-contain" alt="Full Preview" />
            </div>
            <div className="text-center text-white space-y-2">
              <h4 className="text-lg font-black uppercase tracking-tight">{selectedImage.brand}</h4>
              <div className="flex gap-4 justify-center">
                <span className="text-[10px] font-bold text-white/40 uppercase">PIC: {selectedImage.pic}</span>
                <span className="text-[10px] font-bold text-white/40 uppercase">TIME: {selectedImage.timestamp}</span>
              </div>
              <button className="mt-6 px-12 py-3 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest">Đóng</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
