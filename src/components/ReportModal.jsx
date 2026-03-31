import React, { useState, useRef } from 'react';
import { X, Camera, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, MessageSquare, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- CONFIGURATION ---
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx-HzDy5E7mhZPylYRXRaEddMBMpt_74MoAStUp2qKbRYx-Fua-XVcATnp317yjAvJ8Tg/exec";

const ReportModal = ({ isOpen, onClose, item, user, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [storeStatus, setStoreStatus] = useState('Sitecheck');
  const [posmStatus, setPosmStatus] = useState('Có POSM');
  const [reasonNoPosm, setReasonNoPosm] = useState('Chính sách cửa hàng');
  const [paymentKnowledge, setPaymentKnowledge] = useState('Nhân viên biết thanh toán');
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 2) {
      alert("Tối đa 2 ảnh nghiệm thu");
      return;
    }

    const newImages = await Promise.all(files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            file,
            preview: URL.createObjectURL(file),
            base64: reader.result,
            name: `posm_${item.job_code}_${Date.now()}.jpg`,
            type: file.type
          });
        };
        reader.readAsDataURL(file);
      });
    }));

    setImages([...images, ...newImages]);
  };

  const removeImage = (index) => {
    const updated = [...images];
    updated.splice(index, 1);
    setImages(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        employeeName: user?.ho_ten || user?.user_name || "Lao dong tu do",
        staffName: user?.ho_ten || user?.user_name || "Lao dong tu do",
        brand: item.brand || "Unknown Brand",
        address: item.address || "N/A",
        mallName: item.mall_name || "N/A",
        locationType: item.location_type || "N/A",
        district: item.district || "N/A",
        city: item.city || "N/A",
        posmStatus: posmStatus || "Có POSM",
        frame: item.frame || "N/A",
        jobCode: item.job_code || "",

        image1: images?.[0]?.base64 || "",
        image1Name: images?.[0]?.name || "image1.jpg",
        image1Type: images?.[0]?.type || "image/jpeg",

        image2: images?.[1]?.base64 || "",
        image2Name: images?.[1]?.name || "image2.jpg",
        image2Type: images?.[1]?.type || "image/jpeg",

        storeStatus: storeStatus || "Sitecheck",
        noPosmReason: posmStatus === 'KHÔNG POSM' ? (reasonNoPosm || "Chưa rõ lý do") : "N/A",
        paymentStatus: paymentKnowledge || "N/A",
        note: note || `Báo cáo cho mã ${item.job_code}`
      };

      console.log("SENDING PAYLOAD TO GAS:", payload);

      const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log("GAS RESPONSE:", result);

      if (result.status === 'success' || result.status === 'done' || result.success) {
        setSuccess(true);
        if (onSuccess) onSuccess({ ...item, status: 'Done', posm_status: posmStatus });
        setTimeout(() => onClose(), 2000);
      } else {
        setError(result.message || "Script báo thiếu thông tin hoặc sai cấu trúc.");
      }
    } catch (err) {
      console.error("Submit error details:", err);
      setError("Lỗi kết nối hoặc Script chưa được Cấu hình đúng (Anyone).");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 overflow-hidden">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-xl bg-white/95 rounded-t-[3rem] sm:rounded-[3rem] p-8 space-y-8 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] relative border-t border-white"
      >
        {/* Handle for Mobile View */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 rounded-full sm:hidden" />

        <button
          onClick={onClose}
          className="absolute top-6 right-8 p-3 bg-slate-100/50 hover:bg-slate-200 rounded-full text-slate-500 transition-all active:scale-90"
        >
          <X size={20} />
        </button>

        {success ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="py-16 flex flex-col items-center text-center space-y-6"
          >
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-200 ring-8 ring-green-50">
              <CheckCircle size={56} />
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-slate-800 tracking-tight">Thành Công!</h3>
              <p className="text-slate-500 font-bold px-8">Báo cáo của bạn đã được ghi vào hệ thống và Drive.</p>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8 pb-4">
            <div className="space-y-1">
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">REPORT <span className="text-primary underline decoration-indigo-200 underline-offset-4">SHEETS</span></h3>
              <div className="flex items-center gap-2 text-slate-400 bg-slate-50 w-fit px-3 py-1 rounded-full border border-slate-100">
                <Info size={14} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">{item.job_code} • {item.brand}</span>
              </div>
            </div>

            <div className="space-y-6 max-h-[55vh] overflow-y-auto pr-3 custom-scrollbar">

              {/* SECTION: TÌNH TRẠNG POSM */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tình trạng POSM</label>
                <div className="grid grid-cols-2 gap-4">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPosmStatus('Có POSM')}
                    className={`relative p-5 rounded-[2rem] text-sm font-black transition-all ${posmStatus === 'Có POSM'
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-xl shadow-indigo-200 ring-4 ring-indigo-50'
                      : 'bg-slate-50 text-slate-400 grayscale border border-slate-100'
                      }`}
                  >
                    Có POSM
                    {posmStatus === 'Có POSM' && <CheckCircle size={14} className="absolute top-3 right-3 text-white/50" />}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPosmStatus('KHÔNG POSM')}
                    className={`relative p-5 rounded-[2rem] text-sm font-black transition-all ${posmStatus === 'KHÔNG POSM'
                      ? 'bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-xl shadow-rose-200 ring-4 ring-rose-50'
                      : 'bg-slate-50 text-slate-400 grayscale border border-slate-100'
                      }`}
                  >
                    KHÔNG POSM
                    {posmStatus === 'KHÔNG POSM' && <AlertCircle size={14} className="absolute top-3 right-3 text-white/50" />}
                  </motion.button>
                </div>

                <AnimatePresence>
                  {posmStatus === 'KHÔNG POSM' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-5 bg-rose-50/50 rounded-3xl border border-rose-100 space-y-3"
                    >
                      <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
                        <AlertCircle size={12} /> Lí do cụ thể
                      </label>
                      <select
                        value={reasonNoPosm}
                        onChange={(e) => setReasonNoPosm(e.target.value)}
                        className="w-full p-4 bg-white/80 backdrop-blur-sm rounded-2xl text-sm font-bold text-rose-800 border-none shadow-sm focus:ring-2 focus:ring-rose-200 outline-none"
                      >
                        <option value="Chính sách cửa hàng">Chính sách cửa hàng</option>
                        <option value="Cửa hàng tháo">Cửa hàng tháo</option>
                        <option value="POSM hư hỏng">POSM hư hỏng</option>
                      </select>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* SECTION: THÔNG TIN CHI TIẾT */}
              <div className="grid grid-cols-1 gap-6 bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cửa hàng & Thanh toán</label>
                    <div className="grid grid-cols-1 gap-3">
                      <select
                        value={storeStatus}
                        onChange={(e) => setStoreStatus(e.target.value)}
                        className="w-full p-4 bg-white rounded-2xl text-sm font-bold text-slate-800 border border-slate-100 shadow-sm outline-none"
                      >
                        <option value="Sitecheck">🏪 Sitecheck (Bình thường)</option>
                        <option value="Cửa hàng onboard">✅ Cửa hàng onboard</option>
                        <option value="Không hợp tác">🤝 Không hợp tác</option>
                        <option value="Đóng cửa">🚫 Cửa hàng đóng cửa</option>
                      </select>
                      <select
                        value={paymentKnowledge}
                        onChange={(e) => setPaymentKnowledge(e.target.value)}
                        className="w-full p-4 bg-white rounded-2xl text-sm font-bold text-slate-800 border border-slate-100 shadow-sm outline-none"
                      >
                        <option value="Nhân viên biết thanh toán">💳 NV biết thanh toán</option>
                        <option value="Nhân viên không biết/nắm thanh toán">❓ NV không nắm rõ</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Hình ảnh thực tế</label>
                  <div className="flex gap-4">
                    {images.map((img, idx) => (
                      <motion.div
                        initial={{ scale: 0.8, rotate: -5 }}
                        animate={{ scale: 1, rotate: 0 }}
                        key={idx}
                        className="relative w-24 h-24 rounded-3xl overflow-hidden shadow-lg border-2 border-white ring-1 ring-slate-100"
                      >
                        <img src={img.preview} alt="preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center text-white transition-opacity backdrop-blur-[2px]"
                        >
                          <X size={20} />
                        </button>
                      </motion.div>
                    ))}
                    {images.length < 2 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className="w-24 h-24 rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 flex flex-col items-center justify-center gap-1.5 text-indigo-400 hover:bg-indigo-50 hover:border-indigo-400 transition-all active:scale-95"
                      >
                        <ImageIcon size={24} />
                        <span className="text-[9px] font-black uppercase tracking-tighter">Thêm ảnh</span>
                      </button>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" multiple />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                    <MessageSquare size={12} /> Ghi chú nghiệp vụ
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows="3"
                    className="w-full p-5 bg-white rounded-3xl text-sm font-bold text-slate-800 border border-slate-100 shadow-sm outline-none resize-none placeholder:text-slate-200"
                    placeholder="Những quan sát thêm tại điểm bán..."
                  />
                </div>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-rose-50 p-4 rounded-2xl flex items-center gap-3 text-rose-600 text-[11px] font-black uppercase tracking-tight border border-rose-100"
              >
                <AlertCircle size={18} /> {error}
              </motion.div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`group relative w-full py-6 rounded-[2rem] font-black text-xl uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-4 overflow-hidden ${loading ? 'bg-slate-400 text-white cursor-wait' : 'bg-gradient-to-r from-indigo-600 to-indigo-800 text-white hover:shadow-indigo-200'
                  }`}
              >
                {loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    <span>Gửi Báo Cáo</span>
                    <ImageIcon size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ReportModal;
