import React, { useState, useEffect } from 'react';
import { fetchPosmGuide } from '../services/posmGuideService';
import { Loader2, Info, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';

const getDirectCdnUrl = (url, width = 400) => {
  if (!url) return '';
  
  // If it's already a direct Google CDN link, just adjust size
  if (url.includes('lh3.googleusercontent.com/d/')) {
    const baseUrl = url.split('=')[0];
    return `${baseUrl}=w${width}`;
  }

  // Try to extract Google Drive file ID
  // Format 1: /d/[ID]/
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${dMatch[1]}=w${width}`;
  }

  // Format 2: ?id=[ID] or &id=[ID]
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}=w${width}`;
  }

  // Fallback for non-Google Drive URLs
  return url;
};

const PosmGuideCard = ({ brand, locationType, onPreviewImage }) => {
  const [guideData, setGuideData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const loadGuide = async () => {
      setLoading(true);
      const result = await fetchPosmGuide(brand, locationType);
      if (isMounted) {
        if (result && result.success) {
          if (result.data && result.data.length > 0) {
            const firstItem = result.data[0];
            
            let rawThumb = typeof firstItem.primary_image_url === 'object' && firstItem.primary_image_url !== null 
              ? (firstItem.primary_image_url.thumbnail_url || firstItem.primary_image_url.view_url)
              : firstItem.primary_image_url;

            const refs = (firstItem.ref_images || []).map(ref => {
              let rThumb = ref;
              if (typeof ref === 'object' && ref !== null) {
                rThumb = ref.thumbnail_url || ref.view_url;
              }
              return { 
                thumb: getDirectCdnUrl(rThumb, 400), 
                full: getDirectCdnUrl(rThumb, 1200) 
              };
            });

            setGuideData({
              brand: firstItem.brand || result.brand,
              location_type: firstItem.location_type,
              primary_image_thumb: getDirectCdnUrl(rawThumb, 400),
              primary_image_full: getDirectCdnUrl(rawThumb, 1200),
              ref_images: refs,
              checklists: firstItem.checklists || []
            });
          } 
          else if (result.primary_image_url) {
             setGuideData({
               brand: result.brand,
               location_type: result.location_type,
               primary_image_thumb: getDirectCdnUrl(result.primary_image_url, 400),
               primary_image_full: getDirectCdnUrl(result.primary_image_url, 1200),
               ref_images: (result.ref_images || []).map(url => ({ 
                 thumb: getDirectCdnUrl(url, 400), 
                 full: getDirectCdnUrl(url, 1200) 
               })),
               checklists: result.checklists || []
             });
          } else {
             setGuideData(null);
          }
        } else {
          setGuideData(null);
        }
        setLoading(false);
      }
    };

    if (brand) {
      loadGuide();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [brand, locationType]);

  if (loading) {
    return (
      <div className="bg-indigo-50/50 p-4 rounded-3xl border border-indigo-100/50 flex items-center justify-center gap-3 animate-pulse">
        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Đang tải ảnh mẫu POSM...</span>
      </div>
    );
  }

  if (!guideData) {
    return null; // Don't render anything if no data
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4 relative overflow-hidden"
    >
      {/* Decorative background element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60"></div>
      
      {/* Header */}
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
            <ImageIcon size={12} />
            Ảnh mẫu POSM
          </h4>
          <h3 className="text-sm font-black text-slate-800 uppercase">{guideData.brand}</h3>
          {guideData.location_type && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold uppercase">
              {guideData.location_type}
            </span>
          )}
        </div>
      </div>

      {/* Main Image */}
      {guideData.primary_image_thumb && (
        <div 
          className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-sm border border-slate-100 cursor-pointer group"
          onClick={() => onPreviewImage(guideData.primary_image_full)}
        >
          <img 
            src={guideData.primary_image_thumb} 
            alt={`Mẫu POSM ${guideData.brand}`} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-[8px] font-bold uppercase flex items-center gap-1">
             <ImageIcon size={10} /> Phóng to
          </div>
        </div>
      )}

      {/* Ref Images */}
      {guideData.ref_images && guideData.ref_images.length > 0 && (
        <div className="flex gap-2">
          {guideData.ref_images.map((imgObj, idx) => (
            <div 
              key={idx} 
              className="relative w-1/2 aspect-video rounded-xl overflow-hidden shadow-sm border border-slate-100 cursor-pointer group"
              onClick={() => onPreviewImage(imgObj.full)}
            >
              <img 
                src={imgObj.thumb} 
                alt={`Tham khảo ${idx+1}`} 
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
            </div>
          ))}
        </div>
      )}

      {/* Checklists */}
      {guideData.checklists && guideData.checklists.length > 0 && (
        <div className="bg-slate-50 rounded-2xl p-4 mt-1">
          <ul className="space-y-2.5">
            {guideData.checklists.map((check, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-teal-500 shrink-0 mt-0.5" />
                <span className="text-[11px] font-bold text-slate-700 leading-snug">{check}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer Note */}
      <div className="flex items-start gap-1.5 mt-1 opacity-70">
        <Info size={12} className="text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-[9px] font-bold text-slate-500 italic leading-relaxed">
          Ảnh mẫu mang tính tham khảo để triển khai gần đúng nhất theo chuẩn brand. Vui lòng chụp ảnh thực tế đúng góc độ.
        </p>
      </div>
    </motion.div>
  );
};

export default PosmGuideCard;
