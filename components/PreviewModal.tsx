'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileSpreadsheet, Table as TableIcon } from 'lucide-react';

interface PreviewModalProps {
  previewData: { id: string, name: string, data: any[] } | null;
  onClose: () => void;
  onDownload?: () => void;
}

export function PreviewModal({ previewData, onClose, onDownload }: PreviewModalProps) {
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
            className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20"
          >
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <TableIcon size={24} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">Visualização de Dados</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <FileSpreadsheet size={12} className="text-slate-400" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px] sm:max-w-md">
                      {previewData.name}
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-300"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30">
              <div className="flex-1 overflow-auto p-6 sm:p-8">
                <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                        <tr>
                          {previewData.data[0]?.map((cell: any, i: number) => (
                            <th key={i} className="px-6 py-4 font-black text-slate-600 uppercase tracking-widest text-[10px] whitespace-nowrap">
                              {cell || `Coluna ${i+1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.data.slice(1).map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                            {row.map((cell: any, j: number) => (
                              <td key={j} className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap group-hover:text-slate-900">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="mt-6 flex items-center justify-center gap-3">
                  <div className="h-px w-8 bg-slate-200" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Amostra das primeiras 10 linhas
                  </p>
                  <div className="h-px w-8 bg-slate-200" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 sm:p-8 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sm:text-left">
                Verifique os dados antes de realizar o download definitivo
              </p>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button 
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all duration-300"
                >
                  Fechar
                </button>
                {onDownload && (
                  <button 
                    onClick={onDownload}
                    className="flex-1 sm:flex-none px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all duration-300"
                  >
                    <Download size={14} />
                    Baixar CSV
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
