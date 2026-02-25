'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface PreviewModalProps {
  previewData: { name: string, data: any[] } | null;
  onClose: () => void;
}

export function PreviewModal({ previewData, onClose }: PreviewModalProps) {
  return (
    <AnimatePresence>
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Pré-visualização</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{previewData.name}</p>
              </div>
              <button 
                onClick={onClose}
                className="w-12 h-12 flex items-center justify-center bg-white text-slate-400 hover:text-red-500 rounded-2xl shadow-sm transition-all"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-8">
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {previewData.data[0]?.map((cell: any, i: number) => (
                        <th key={i} className="px-4 py-3 font-black text-slate-600 uppercase tracking-widest text-[10px]">
                          {cell || `Col ${i+1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {previewData.data.slice(1).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        {row.map((cell: any, j: number) => (
                          <td key={j} className="px-4 py-3 text-slate-600 font-medium">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4 text-center">
                Exibindo as primeiras 10 linhas do arquivo convertido
              </p>
            </div>

            <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"
              >
                Fechar Visualização
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
