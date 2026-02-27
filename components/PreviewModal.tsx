'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileSpreadsheet, Table as TableIcon, Hash, Columns3 } from 'lucide-react';

interface PreviewModalProps {
  previewData: { id: string, name: string, data: any[], totalRows: number } | null;
  onClose: () => void;
}

export function PreviewModal({ previewData, onClose }: PreviewModalProps) {
  if (!previewData) return null;

  const headers = previewData.data[0] || [];
  const rows = previewData.data.slice(1);
  const totalRows = previewData.totalRows || rows.length;
  const showingRows = rows.length;

  return (
    <AnimatePresence>
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-6xl bg-white rounded-2xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20"
          >
            {/* Header */}
            <div className="p-4 sm:p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <TableIcon size={20} className="sm:hidden" />
                  <TableIcon size={24} className="hidden sm:block" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-xl font-black text-slate-900 uppercase tracking-tight">Visualização de Dados</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <FileSpreadsheet size={12} className="text-slate-400 shrink-0" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                      {previewData.name}
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl sm:rounded-2xl transition-all duration-300 shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Stats bar */}
            <div className="px-4 sm:px-6 md:px-8 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-4 sm:gap-6 shrink-0">
              <div className="flex items-center gap-2">
                <Columns3 size={14} className="text-emerald-500" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {headers.length} colunas
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Hash size={14} className="text-blue-500" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {totalRows} linhas
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Padrão BR: ponto-e-vírgula (;)
                </span>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex-1 overflow-auto">
                <div className="min-w-full">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-800">
                      <tr>
                        <th className="px-3 sm:px-4 py-3 font-black text-slate-300 uppercase tracking-widest text-[10px] whitespace-nowrap border-r border-slate-700 w-10 text-center">
                          #
                        </th>
                        {headers.map((cell: any, i: number) => (
                          <th key={i} className="px-3 sm:px-5 py-3 font-black text-white uppercase tracking-widest text-[10px] whitespace-nowrap border-r border-slate-700 last:border-r-0">
                            {cell || `Col ${i+1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-emerald-50/50 transition-colors group">
                          <td className="px-3 sm:px-4 py-3 text-[10px] font-bold text-slate-300 text-center border-r border-slate-100 bg-slate-50/80">
                            {i + 1}
                          </td>
                          {row.map((cell: any, j: number) => (
                            <td key={j} className="px-3 sm:px-5 py-3 text-slate-600 font-medium whitespace-nowrap group-hover:text-slate-900 border-r border-slate-50 last:border-r-0">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-6 md:p-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-center shrink-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sm:text-left">
                {showingRows < totalRows 
                  ? `Exibindo ${showingRows} de ${totalRows} linhas` 
                  : `${totalRows} linhas no total`
                }
              </p>
              <button 
                onClick={onClose}
                className="w-full sm:w-auto px-8 py-3 bg-slate-100 text-slate-600 rounded-xl sm:rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all duration-300"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
