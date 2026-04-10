import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, MessageSquare, Info, MapPin, Tag, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../services/db';
import { getCurrentWeekLabel } from '../utils/weekUtils';

// --- CONFIGURATION ---
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx-HzDy5E7mhZPylYRXRaEddMBMpt_74MoAStUp2qKbRYx-Fua-XVcATnp317yjAvJ8Tg/exec";

const ReportModal = ({ isOpen, onClose, item, user, onSuccess }) => {
  const isAdHoc = !!(item?.isAdHoc);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Scroll to top when opening (extra safety)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => { document.body.style.overflow = 'auto'; };
  }, [isOpen]);

  // Ad-hoc fields
  const [adHocBrand, setAdHocBrand] = useState('');
  const [adHocAddress, setAdHocAddress] = useState('');

  // Form State
  const [storeStatus, setStoreStatus] = useState('Site check');
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

    const compressImage = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Downscale image to save bandwidth - aggressive compression for speed
            const MAX_DIMENSION = 900;
            if (width > height && width > MAX_DIMENSION) {
              height *= MAX_DIMENSION / width;
              width = MAX_DIMENSION;
            } else if (height > MAX_DIMENSION) {
              width *= MAX_DIMENSION / height;
              height = MAX_DIMENSION;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Compress to 60% quality JPEG (smaller = faster upload)
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);

            resolve({
              file,
              preview: compressedBase64,
              base64: compressedBase64,
              name: `posm_${item?.job_code || 'JOB'}_${Date.now()}.jpg`,
              type: 'image/jpeg'
            });
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    };

    const newImages = await Promise.all(files.map(file => compressImage(file)));

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
      const hasImages = images.length > 0;
      const hasNote = note && note.trim().length > 0;

      if (isAdHoc) {
        if (!adHocBrand.trim()) throw new Error("Vui lòng nhập Tên Nhãn Hàng");
        if (!adHocAddress.trim()) throw new Error("Vui lòng nhập Địa Chỉ chi tiết");
      }

      if (!hasImages && !hasNote) {
        throw new Error("Bạn vui lòng kiểm tra lại thông tin");
      }
      if (!hasImages) {
        throw new Error("Thiếu hình ảnh nghiệm thu");
      }
      if (!hasNote) {
        throw new Error("Thiếu ghi chú");
      }

      const mappedPosmStatus = posmStatus === 'Có POSM' 
        ? 'Có POSM, NV thanh toán được' 
        : 'KHÔNG POSM, NV thanh toán được';

      // Generate ad-hoc job code from brand + timestamp
      const adHocJobCode = isAdHoc
        ? `NEW_${adHocBrand.trim().replace(/\s+/g,'_').toUpperCase().slice(0,20)}_${Date.now()}`
        : (item.job_code || '');

      // Save ad-hoc point to local Dexie IMMEDIATELY (before GAS) to ensure it's always recorded
      if (isAdHoc) {
        try {
          const weekLabel = getCurrentWeekLabel();
          await db.adhocPoints.add({
            job_code: adHocJobCode,
            brand: adHocBrand.trim(),
            address: adHocAddress.trim(),
            pic_id: user?.user_id || '',
            pic: user?.ho_ten || user?.user_name || '',
            posm_status: posmStatus,
            status: 'Done',
            is_adhoc: true,
            week: weekLabel,
            submitted_at: new Date().toISOString(),
          });
          console.log('[AdHoc] Saved to local DB, week:', weekLabel);
        } catch (dbErr) {
          console.warn('[AdHoc] Failed to save to local DB:', dbErr);
        }
      }

      const payload = {
        // Index 0 -> Col B: Tên nhân viên
        employeeName: user?.ho_ten || user?.user_name || "Lao dong tu do",
        
        // Index 1 -> Col C: Brand
        brand: isAdHoc ? adHocBrand.trim() : (item.brand || "Unknown Brand"),
        
        // Index 2 -> Col D: Địa chỉ
        address: isAdHoc ? adHocAddress.trim() : (item.address || "N/A"),
        
        // Index 3 -> Col E: Mã cv
        jobCode: adHocJobCode,
        
        // Ad-hoc flag for GAS script
        isAdHoc: isAdHoc,
        
        // Index 4 -> Col F: Project
        project: "UrGift",
        
        // Index 5 -> Col G: Hình thức thanh toán (Hidden)
        paymentType: "N/A",
        
        // Index 6 -> Col H: Hoạt động UrGift
        // Khi KHÔNG POSM: hiển thị lý do cụ thể. Khi Có POSM: hiển thị loại hoạt động.
        storeStatus: posmStatus === 'KHÔNG POSM' ? (reasonNoPosm || storeStatus || "Site check") : (storeStatus || "Site check"),
        
        // Index 7 -> Col I: Quản lý
        manager: "N/A",
        
        // Index 8 -> Col J: Số điện thoại
        phone: "N/A",
        
        // Index 9 -> Col K: Có POSM không? (Short version for script mapping)
        posmStatus: posmStatus, 
        
        // --- Keys for Column BF (and fallback Mapping) ---
        "Tình trạng POSM": posmStatus,
        "posm_status": posmStatus,
        "POSM_Status": posmStatus,

        // Extra metadata (landing in subsequent columns L, M, ...)
        noPosmReason: posmStatus === 'KHÔNG POSM' ? (reasonNoPosm || "Chưa rõ lý do") : "N/A",
        paymentStatus: paymentKnowledge || "N/A",
        note: note || `Báo cáo cho mã ${item.job_code}`,

        // Images (usually landing in AK, AN, ...)
        image1: images?.[0]?.base64 || "",
        image1Name: images?.[0]?.name || "image1.jpg",
        image1Type: images?.[0]?.type || "image/jpeg",
        image2: images?.[1]?.base64 || "",
        image2Name: images?.[1]?.name || "image2.jpg",
        image2Type: images?.[1]?.type || "image/jpeg",
        
        // Caching info for later retrieval
        mallName: item.mall_name || "N/A",
        locationType: item.location_type || "N/A",
        district: item.district || "N/A",
        city: item.city || "N/A"
      };

      // ── OPTIMISTIC UPDATE ─────────────────────────────────────────────
      // 1. Update local DB immediately (before waiting for GAS)
      //    This makes the dashboard update instantly.
      if (!isAdHoc) {
        try {
          await db.posmData.where('job_code').equals(item.job_code || '').modify({
            status: 'Done',
            posm_status: mappedPosmStatus,
          });
        } catch (dbErr) {
          console.warn('[Optimistic] DB update failed:', dbErr);
        }
      }

      // 2. Show success immediately & notify parent
      setSuccess(true);
      if (onSuccess) onSuccess({ ...item, status: 'Done', posm_status: mappedPosmStatus });
      setTimeout(() => onClose(), 1500);

      // 3. Send to GAS in background (fire & forget) - no need to await
      fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('[GAS Background] Send failed:', err));
      // ─────────────────────────────────────────────────────────────────

    } catch (err) {
      console.error("Submit error details:", err);
      const isValidationError = ["Thiếu hình ảnh nghiệm thu", "Thiếu ghi chú", "Bạn vui lòng kiểm tra lại thông tin"].includes(err.message);
      setError(isValidationError ? err.message : "Lỗi kết nối hoặc Script chưa được Cấu hình đúng (Anyone).");
    } finally {
      setLoading(false);
    }
  };

  const modal = createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/60 backdrop-blur-md p-0 sm:p-4 overflow-hidden">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-full max-w-xl bg-white/95 rounded-t-[3rem] sm:rounded-[3rem] p-8 space-y-8 shadow-[0_-20px_50px_rgba(0,0,0,0.2)] relative border-t border-white"
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
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">REPORT <span className="text-primary underline decoration-indigo-200 underline-offset-4">SHEETS</span></h3>
              {isAdHoc ? (
                <div className="flex items-center gap-2 bg-amber-50 w-fit px-3 py-1.5 rounded-full border border-amber-200">
                  <Sparkles size={13} className="text-amber-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">MỚI • ĐIỂM PHÁT SINH</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-400 bg-slate-50 w-fit px-3 py-1 rounded-full border border-slate-100">
                  <Info size={14} className="text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{item.job_code} • {item.brand}</span>
                </div>
              )}
            </div>

            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-3 custom-scrollbar">

              {/* SECTION: AD-HOC FIELDS */}
              {isAdHoc && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 p-5 bg-amber-50/60 rounded-[2rem] border border-amber-100"
                >
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Thông tin điểm mới</p>
                  <div className="space-y-3">
                    <div className="relative">
                      <Tag size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" />
                      <input
                        type="text"
                        value={adHocBrand}
                        onChange={e => setAdHocBrand(e.target.value)}
                        placeholder="Tên Nhãn Hàng (Brand) *"
                        className="w-full pl-10 pr-4 py-4 bg-white rounded-2xl text-sm font-bold text-slate-800 border border-amber-200 shadow-sm outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-slate-300"
                      />
                    </div>
                    <div className="relative">
                      <MapPin size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" />
                      <input
                        type="text"
                        value={adHocAddress}
                        onChange={e => setAdHocAddress(e.target.value)}
                        placeholder="Địa chỉ chi tiết *"
                        className="w-full pl-10 pr-4 py-4 bg-white rounded-2xl text-sm font-bold text-slate-800 border border-amber-200 shadow-sm outline-none focus:ring-2 focus:ring-amber-200 placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* SECTION: TÌNH TRẠNG POSM */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tình trạng POSM <span className="text-rose-500">*</span></label>
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
                        <AlertCircle size={12} /> Lí do cụ thể <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={reasonNoPosm}
                        onChange={(e) => setReasonNoPosm(e.target.value)}
                        className="w-full p-4 bg-white/80 backdrop-blur-sm rounded-2xl text-sm font-bold text-rose-800 border-none shadow-sm focus:ring-2 focus:ring-rose-200 outline-none"
                      >
                        <option value="Chính sách cửa hàng">Chính sách cửa hàng</option>
                        <option value="Cửa hàng tháo">Cửa hàng tháo</option>
                        <option value="POSM hư hỏng">POSM hư hỏng</option>
                        <option value="Không hợp tác">Không hợp tác</option>
                        <option value="Cửa hàng đóng cửa">Cửa hàng đóng cửa</option>
                      </select>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* SECTION: THÔNG TIN CHI TIẾT */}
              <div className="grid grid-cols-1 gap-6 bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cửa hàng & Thanh toán <span className="text-rose-500">*</span></label>
                    <div className="grid grid-cols-1 gap-3">
                      <select
                        value={storeStatus}
                        onChange={(e) => setStoreStatus(e.target.value)}
                        className="w-full p-4 bg-white rounded-2xl text-sm font-bold text-slate-800 border border-slate-100 shadow-sm outline-none"
                      >
                        <option value="Site check">🏪 Sitecheck (Bình thường)</option>
                        <option value="Cửa hàng onboard">✅ Cửa hàng onboard</option>
                        <option value="Không hợp tác">🤝 Không hợp tác</option>
                        <option value="Đóng cửa">🚫 Cửa hàng đóng cửa</option>
                      </select>
                      
                      {storeStatus !== 'Không hợp tác' && storeStatus !== 'Đóng cửa' && (
                        <select
                          value={paymentKnowledge}
                          onChange={(e) => setPaymentKnowledge(e.target.value)}
                          className="w-full p-4 bg-white rounded-2xl text-sm font-bold text-slate-800 border border-slate-100 shadow-sm outline-none"
                        >
                          <option value="Nhân viên biết thanh toán">💳 NV biết thanh toán</option>
                          <option value="Nhân viên không biết/nắm thanh toán">❓ NV không nắm rõ</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Hình ảnh thực tế <span className="text-rose-500">*</span></label>
                  <div className="flex gap-4">
                    {images.map((img, idx) => (
                      <motion.div
                        initial={{ scale: 0.8, rotate: -5 }}
                        animate={{ scale: 1, rotate: 0 }}
                        key={idx}
                        className="relative w-24 h-24 rounded-3xl overflow-hidden shadow-lg border-2 border-white ring-2 ring-indigo-100"
                      >
                        {/* Tap image → open lightbox preview */}
                        <img
                          src={img.preview}
                          alt="preview"
                          className="w-full h-full object-cover cursor-pointer active:opacity-80 transition-opacity"
                          onClick={() => setPreviewImage(img.preview)}
                        />
                        {/* Corner delete button (does NOT block image tap) */}
                        <button
                          type="button"
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center shadow-md transition-colors active:scale-90 z-10"
                          onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                        >
                          <X size={11} className="text-white" />
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
                    <MessageSquare size={12} /> Ghi chú nghiệp vụ <span className="text-rose-500">*</span>
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
    </div>,
    document.body
  );

  return (
    <>
      {modal}
      {/* Image Lightbox Portal */}
      {previewImage && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={() => setPreviewImage(null)}
        >
          {/* Close button */}
          <button
            className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white border border-white/20 transition-all active:scale-90"
            onClick={() => setPreviewImage(null)}
          >
            <X size={22} />
          </button>

          {/* Full image */}
          <motion.img
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 22, stiffness: 200 }}
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-[85vh] object-contain rounded-3xl shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Label */}
          <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-black text-white/40 uppercase tracking-widest">
            Bấm ngoài để đóng
          </p>
        </motion.div>,
        document.body
      )}
    </>
  );
};

export default ReportModal;
