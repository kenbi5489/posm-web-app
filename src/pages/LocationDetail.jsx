import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { MapPin, Navigation, Calendar, Hash, UserCircle, Briefcase, CheckCircle, ChevronLeft, Link as LinkIcon, MessageCircle, TriangleAlert, FileEdit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import ReportModal from '../components/ReportModal';

const LocationDetail = () => {
  const { jobCode, brand } = useParams();
  const navigate = useNavigate();
  const { user, triggerLocalRefresh } = useAuth();
  const [item, setItem] = useState(null);
  const [acceptance, setAcceptance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    const loadItem = async () => {
      let found = await db.posmData.where({ job_code: jobCode, brand: decodeURIComponent(brand) }).first();
      
      // Fallback to ad-hoc points if not found in master data
      if (!found && db.adhocPoints) {
        found = await db.adhocPoints.where({ job_code: jobCode, brand: decodeURIComponent(brand) }).first();
      }

      setItem(found);
      
      if (found) {
        const acc = await db.acceptanceData.where({ job_code: jobCode }).first();
        setAcceptance(acc);
      }
      setLoading(false);
    };
    loadItem();
  }, [jobCode, brand]);

  const handleReportSuccess = async (updatedItem) => {
    await db.posmData.put(updatedItem);
    await db.acceptanceData.put({
      job_code: updatedItem.job_code,
      posm_status: updatedItem.posm_status,
      timestamp: Date.now()
    });
    setItem(updatedItem);
    // Notify dashboard to re-fetch from IndexedDB immediately
    triggerLocalRefresh();
    // Navigate to dashboard after 2s (lets the modal success animation complete first)
    setTimeout(() => navigate('/'), 2000);
  };

  const handleIncomplete = async () => {
    const updated = { ...item, status: 'On-going', completion_date: '' };
    await db.posmData.put(updated);
    await db.syncQueue.add({
      type: 'COMPLETE_POSM',
      payload: { jobCode: item.job_code, brand: item.brand, status: 'On-going' },
      timestamp: Date.now()
    });
    setItem(updated);
    setReverting(false);
  };

  const handleDirections = () => {
    const destination = `${item.address}, ${item.district}, ${item.city}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    window.open(url, '_blank');
  };

  if (loading) return <div className="p-10 text-center animate-pulse text-indigo-400 font-black uppercase text-xs tracking-widest">Đang tải dữ liệu...</div>;
  if (!item) return <div className="p-10 text-center font-bold text-slate-400">Không tìm thấy thông tin điểm POSM</div>;

  const isDone = item.status === 'Done';

  return (
    <div className="flex flex-col min-h-full bg-slate-50/50 animate-fade-in pb-24">
      {/* Navigation Header */}
      <div className="bg-white p-6 flex items-center gap-4 sticky top-0 z-50 shadow-sm border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="p-3 -ml-3 rounded-2xl active:bg-slate-100 transition-colors">
          <ChevronLeft size={24} className="text-slate-900" />
        </button>
        <h2 className="text-lg font-black text-slate-900 truncate uppercase tracking-tight">{item.brand}</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Banner */}
        {isDone ? (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-indigo-600 text-white p-7 rounded-[2.5rem] shadow-premium-indigo flex items-center gap-6"
          >
            <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center shadow-inner">
               <CheckCircle size={40} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">TRẠNG THÁI HOÀN TẤT</p>
              <p className="text-xl font-black">{item.completion_date || 'Đã báo cáo'}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-amber-500 text-white p-7 rounded-[2.5rem] shadow-premium-amber flex flex-col gap-4"
          >
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center shadow-inner">
                 <Calendar size={40} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-1">CHƯA TRIỂN KHAI</p>
                <p className="text-lg font-black leading-tight">Điểm này chưa được đi/triển khai báo cáo</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main Details Card (Full Info Request) */}
        <div className="bg-white rounded-[3rem] p-10 shadow-soft space-y-8 border border-slate-100/50">
          <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Thông tin đầy đủ</h3>
          <DetailRow icon={<MapPin className="text-indigo-500" />} label="Địa chỉ" value={item.address} />
          <DetailRow icon={<Hash className="text-indigo-500" />} label="Mã QC" value={item.job_code} />
          <DetailRow icon={<Briefcase className="text-indigo-500" />} label="tk Portal" value={item.portal_id || 'N/A'} />
          <DetailRow 
            icon={<CheckCircle size={20} className="text-indigo-500" />} 
            label="Trạng thái POSM" 
            value={(() => {
              const status = item.posm_status || acceptance?.posm_status || item.posm_status_master || 'Chưa báo cáo';
              if (item.status === 'Done') {
                if (status.toLowerCase().includes('không posm')) return 'Không POSM';
                if (status.toLowerCase().includes('có posm')) return 'Có POSM';
                return status; // Fallback
              }
              return 'Chưa báo cáo';
            })()} 
          />
        </div>

        {/* Acceptance Info (Enhanced for Request) */}
        {isDone && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-[3rem] p-10 shadow-soft space-y-8 border border-slate-100/50"
          >
            <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
              <CheckCircle className="text-green-500" size={14} />
              Thông tin nghiệm thu
            </h3>
            
            <div className="space-y-8">
              <DetailRow icon={<MessageCircle className="text-indigo-400" />} label="Ghi chú & PIC" value={`${acceptance?.note || item.acceptance_note || 'Không có ghi chú'} - ${item.reported_by || item.pic || 'N/A'}`} />
              
              <div className="pt-6 border-t border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Hình ảnh báo cáo</p>
                <div className="flex gap-4">
                  {(acceptance?.image1 || item.image1) ? (
                    <a href={acceptance?.image1 || item.image1} target="_blank" rel="noreferrer" className="flex-1 bg-slate-50 hover:bg-indigo-50 text-indigo-600 font-black py-5 rounded-2xl text-center text-xs uppercase tracking-widest active:scale-95 transition-all border border-slate-100 flex items-center justify-center gap-2">
                      <LinkIcon size={14} /> Ảnh 1
                    </a>
                  ) : (
                    <div className="flex-1 py-5 bg-slate-200/20 text-slate-300 font-black rounded-2xl text-center text-[10px] uppercase border border-dashed border-slate-200">Không có Ảnh 1</div>
                  )}
                  
                  {(acceptance?.image2 || item.image2) ? (
                    <a href={acceptance?.image2 || item.image2} target="_blank" rel="noreferrer" className="flex-1 bg-slate-50 hover:bg-indigo-50 text-indigo-600 font-black py-5 rounded-2xl text-center text-xs uppercase tracking-widest active:scale-95 transition-all border border-slate-100 flex items-center justify-center gap-2">
                      <LinkIcon size={14} /> Ảnh 2
                    </a>
                  ) : (
                    <div className="flex-1 py-5 bg-slate-200/20 text-slate-300 font-black rounded-2xl text-center text-[10px] uppercase border border-dashed border-slate-200">Không có Ảnh 2</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* If not done show banner */}
        {!isDone && (
            <div className="bg-slate-100/50 border border-dashed border-slate-200 rounded-[2.5rem] p-10 text-center">
                <TriangleAlert className="mx-auto text-slate-300 mb-4" size={32} />
                <p className="text-slate-400 text-xs font-bold leading-relaxed uppercase tracking-wider">
                    Dữ liệu nghiệm thu chưa có.<br/>Vui lòng hoàn thành báo cáo trước.
                </p>
            </div>
        )}

        {/* Map Preview */}
        <div className="w-full h-56 bg-slate-200 rounded-[2.5rem] overflow-hidden shadow-inner relative border-4 border-white">
             <iframe
                title="Google Maps"
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://www.google.com/maps?q=${encodeURIComponent(item.address)}&output=svembed`}
                allowFullScreen
             />
        </div>

        <div className="grid grid-cols-2 gap-4 pb-12">
          <button 
            onClick={handleDirections}
            className="flex flex-col items-center justify-center gap-3 bg-white text-slate-800 font-black py-8 rounded-[2.5rem] shadow-soft border border-slate-100 active:scale-95 transition-transform"
          >
            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
               <Navigation size={24} />
            </div>
            <span className="text-[10px] uppercase tracking-widest">Dẫn đường</span>
          </button>
          
          {!isDone ? (
             <button 
                onClick={() => setIsReportModalOpen(true)}
                className="flex flex-col items-center justify-center gap-3 bg-indigo-600 text-white font-black py-8 rounded-[2.5rem] shadow-premium-indigo active:scale-95 transition-transform"
             >
                <div className="p-3 bg-white/20 rounded-2xl">
                    <FileEdit size={24} />
                </div>
                <span className="text-[10px] uppercase tracking-widest">Báo cáo</span>
             </button>
          ) : (
            <button 
                onClick={() => setReverting(true)}
                className="flex flex-col items-center justify-center gap-3 bg-white text-slate-400 font-black py-8 rounded-[2.5rem] shadow-soft border border-slate-100 active:scale-95 transition-transform opacity-60"
            >
                <div className="p-3 bg-slate-50 rounded-2xl">
                    <Calendar size={24} />
                </div>
                <span className="text-[10px] uppercase tracking-widest">Làm lại</span>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isReportModalOpen && (
          <ReportModal 
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            item={item}
            user={user}
            onSuccess={handleReportSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const DetailRow = ({ icon, label, value }) => (
  <div className="flex items-start gap-5">
    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
      {icon}
    </div>
    <div className="min-w-0 pt-1">
      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] mb-1">{label}</p>
      <p className="text-base font-black text-slate-700 leading-snug break-words tracking-tight">{value}</p>
    </div>
  </div>
);

export default LocationDetail;
