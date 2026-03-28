import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { MapPin, Navigation, Calendar, Hash, UserCircle, Briefcase, CheckCircle, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const LocationDetail = () => {
  const { jobCode, brand } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [acceptance, setAcceptance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    const loadItem = async () => {
      const found = await db.posmData.where({ job_code: jobCode, brand: decodeURIComponent(brand) }).first();
      setItem(found);
      
      if (found) {
        const acc = await db.acceptanceData.where({ job_code: jobCode }).first();
        setAcceptance(acc);
      }
      setLoading(false);
    };
    loadItem();
  }, [jobCode, brand]);

  const handleComplete = async () => {
    // Optimistic UI update
    const updated = { ...item, status: 'Done', completion_date: new Date().toLocaleDateString('vi-VN') };
    await db.posmData.put(updated);
    
    // Add to sync queue
    await db.syncQueue.add({
      type: 'COMPLETE_POSM',
      payload: { jobCode: item.job_code, brand: item.brand, status: 'Done' },
      timestamp: Date.now()
    });

    setItem(updated);
    setConfirming(false);
    
    // In a real app, you'd trigger the background sync here if online
  };

  const handleIncomplete = async () => {
    // Optimistic UI update for reverting
    const updated = { ...item, status: 'On-going', completion_date: '' };
    await db.posmData.put(updated);
    
    // Add to sync queue to revert
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

  if (loading) return <div className="p-10 text-center animate-pulse">Đang tải...</div>;
  if (!item) return <div className="p-10 text-center">Không tìm thấy thông tin</div>;

  const isDone = item.status === 'Done';

  return (
    <div className="flex flex-col min-h-full bg-slate-50 animate-fade-in">
      {/* Navigation Header */}
      <div className="bg-white p-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full active:bg-slate-100">
          <ChevronLeft size={24} className="text-slate-800" />
        </button>
        <h2 className="text-lg font-black text-slate-900 truncate uppercase tracking-tight">{item.brand}</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Banner */}
        {isDone ? (
          <div className="bg-green-500 text-white p-5 rounded-3xl shadow-premium flex items-center gap-4">
            <CheckCircle size={32} />
            <div>
              <p className="text-xs font-black uppercase tracking-widest opacity-80">Hoàn thành ngày</p>
              <p className="text-xl font-black">{item.completion_date}</p>
            </div>
          </div>
        ) : (
          <div className="bg-orange-500 text-white p-5 rounded-3xl shadow-premium flex items-center gap-4">
            <Calendar size={32} />
            <div>
              <p className="text-xs font-black uppercase tracking-widest opacity-80">Ngày triển khai</p>
              <p className="text-xl font-black">{item.date_assigned || 'W1'}</p>
            </div>
          </div>
        )}

        {/* Details Card */}
        <div className="bg-white rounded-[2rem] p-8 shadow-soft space-y-8 border border-slate-50">
          <DetailRow icon={<Hash className="text-blue-500" />} label="Mã công việc" value={item.job_code} />
          <DetailRow icon={<MapPin className="text-red-500" />} label="Địa chỉ" value={item.address} />
          <DetailRow icon={<Briefcase className="text-slate-500" />} label="Portal Account" value={item.portal_id || 'N/A'} />
          <DetailRow icon={<UserCircle className="text-teal-500" />} label="PIC phụ trách" value={item.pic} />
        </div>

        {/* Acceptance Info */}
        {isDone && acceptance && (
          <div className="bg-white rounded-[2rem] p-8 shadow-soft space-y-6 border border-slate-50">
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <CheckCircle className="text-done" size={20} />
              Thông tin nghiệm thu
            </h3>
            <div className="space-y-6 pt-2">
              <DetailRow icon={<CheckCircle className="text-green-500" />} label="Tình trạng POSM" value={acceptance.posm_status || 'Không rõ'} />
              <DetailRow icon={<Hash className="text-orange-500" />} label="Ghi chú" value={acceptance.note || 'Không có ghi chú'} />
              
              <div className="pt-2 border-t border-slate-100 flex gap-4">
                {acceptance.image1 && (
                  <a href={acceptance.image1} target="_blank" rel="noreferrer" className="flex-1 bg-indigo-50 text-indigo-600 font-black py-4 rounded-2xl text-center text-[10px] uppercase tracking-widest active:scale-95 transition-transform border border-indigo-100 shadow-sm">
                    Mở Ảnh 1
                  </a>
                )}
                {acceptance.image2 && (
                  <a href={acceptance.image2} target="_blank" rel="noreferrer" className="flex-1 bg-indigo-50 text-indigo-600 font-black py-4 rounded-2xl text-center text-[10px] uppercase tracking-widest active:scale-95 transition-transform border border-indigo-100 shadow-sm">
                    Mở Ảnh 2
                  </a>
                )}
                {!acceptance.image1 && !acceptance.image2 && (
                  <p className="text-slate-400 text-xs italic font-medium w-full text-center">Không có ảnh nghiệm thu</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Real Map Embed */}
        <div className="w-full h-48 bg-slate-200 rounded-3xl overflow-hidden shadow-inner relative border border-slate-100">
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

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={handleDirections}
            className="flex flex-col items-center justify-center gap-2 bg-white text-slate-800 font-black py-6 rounded-[2rem] shadow-soft border border-slate-100 active:scale-95 transition-transform"
          >
            <Navigation className="text-primary" />
            <span className="text-[10px] uppercase tracking-widest">Dẫn đường</span>
          </button>
          
          <button className="flex flex-col items-center justify-center gap-2 bg-white text-slate-800 font-black py-6 rounded-[2rem] shadow-soft border border-slate-100 active:scale-95 transition-transform">
            <Hash className="text-slate-400" />
            <span className="text-[10px] uppercase tracking-widest">Ghi chú</span>
          </button>
        </div>

        {!isDone ? (
          <button 
            onClick={() => setConfirming(true)}
            className="w-full bg-done text-white font-black py-6 rounded-[2rem] shadow-premium text-xl uppercase tracking-widest active:scale-98 transition-all"
          >
            Xác nhận hoàn thành
          </button>
        ) : (
          <button 
            onClick={() => setReverting(true)}
            className="w-full bg-slate-100 text-slate-500 font-black py-5 rounded-[2rem] shadow-inner text-sm uppercase tracking-widest active:scale-98 transition-all border border-slate-200 flex items-center justify-center gap-2"
          >
            Đánh dấu CHƯA HOÀN THÀNH
          </button>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 space-y-6 shadow-premium"
          >
            <div className="text-center space-y-2">
              <div className="w-20 h-20 bg-green-50 rounded-full mx-auto flex items-center justify-center text-done mb-4">
                <CheckCircle size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 leading-tight">Hoàn thành công việc?</h3>
              <p className="text-slate-500 font-medium">Bạn xác nhận đã kiểm tra điểm POSM tại <span className="text-slate-900 font-bold">{item.brand}</span>?</p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handleComplete}
                className="w-full bg-done text-white font-black py-5 rounded-2xl shadow-premium uppercase tracking-widest"
              >
                Đúng, đã hoàn thành
              </button>
              <button 
                onClick={() => setConfirming(false)}
                className="w-full bg-slate-50 text-slate-400 font-bold py-5 rounded-2xl border border-slate-100 uppercase tracking-widest"
              >
                Hủy bỏ
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Revert Confirmation Modal */}
      {reverting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 space-y-6 shadow-premium"
          >
            <div className="text-center space-y-2">
              <div className="w-20 h-20 bg-orange-50 rounded-full mx-auto flex items-center justify-center text-accent mb-4">
                <Calendar size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 leading-tight">Hủy Hoàn Thành?</h3>
              <p className="text-slate-500 font-medium">Đưa trạng thái của <span className="text-slate-900 font-bold">{item.brand}</span> về lại <span className="text-accent font-bold">Chưa xong</span>?</p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handleIncomplete}
                className="w-full bg-accent text-white font-black py-5 rounded-2xl shadow-premium uppercase tracking-widest"
              >
                Xác nhận
              </button>
              <button 
                onClick={() => setReverting(false)}
                className="w-full bg-slate-50 text-slate-400 font-bold py-5 rounded-2xl border border-slate-100 uppercase tracking-widest"
              >
                Hủy bỏ
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const DetailRow = ({ icon, label, value }) => (
  <div className="flex items-start gap-4">
    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm font-bold text-slate-700 leading-snug break-words">{value}</p>
    </div>
  </div>
);

export default LocationDetail;
