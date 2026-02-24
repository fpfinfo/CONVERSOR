'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import { 
  FileUp, FileText, Download, Loader2, CheckCircle2, AlertCircle, FileSpreadsheet, Trash2, ChevronRight, ShieldCheck, Menu, X, XCircle, Info, Table, DownloadCloud 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { convertPdfToCsv } from '@/lib/gemini';
import { cn } from '@/lib/utils';

interface FileStatus {
  id: string;
  file: File;
  status: 'idle' | 'processing' | 'completed' | 'error';
  result?: string;
  error?: string;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

const SIDEBAR_ITEMS = [
  { icon: FileSpreadsheet, label: 'Conversor SEFIN', active: true },
];

export default function ConversorSefin() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [previewFile, setPreviewFile] = useState<FileStatus | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [sessionStats, setSessionStats] = useState({ success: 0, error: 0 });

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'idle' as const,
    }));
    setFiles(prev => [...prev, ...newFiles]);
    if (newFiles.length > 0) {
      addToast('info', `${newFiles.length} arquivo(s) adicionado(s) à fila.`);
    }
  }, [addToast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 10 * 1024 * 1024,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
    },
    onDropRejected: (rejections) => {
      rejections.forEach(rej => {
        if (rej.errors[0]?.code === 'file-too-large') {
          addToast('error', `O arquivo ${rej.file.name} excede o limite de 10MB.`);
        } else {
          addToast('error', `Formato não suportado: ${rej.file.name}`);
        }
      });
    }
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const processFile = async (fileStatus: FileStatus) => {
    const { file, id } = fileStatus;
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing', error: undefined } : f));

    try {
      let csvResult = '';

      if (file.name.endsWith('.xlsm') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        csvResult = Papa.unparse(jsonData, { quotes: true, delimiter: "," });
      } else if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        csvResult = Papa.unparse(parsed.data, { quotes: true, delimiter: "," });
      } else if (file.name.endsWith('.pdf')) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(file);
        });
        csvResult = await convertPdfToCsv(base64, file.type);
      }

      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'completed', result: csvResult } : f));
      setSessionStats(prev => ({ ...prev, success: prev.success + 1 }));
      addToast('success', `${file.name} convertido com sucesso!`);
      return true;
    } catch (error: unknown) {
      console.error(`Error processing ${file.name}:`, error);
      const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: errorMsg } : f));
      setSessionStats(prev => ({ ...prev, error: prev.error + 1 }));
      addToast('error', `Falha ao converter ${file.name}.`);
      return false;
    }
  };

  const processAll = async () => {
    const pendingFiles = files.filter(f => f.status === 'idle' || f.status === 'error');
    if (pendingFiles.length === 0) return;

    setIsProcessingAll(true);
    setBatchProgress({ current: 0, total: pendingFiles.length });

    for (const [index, file] of pendingFiles.entries()) {
      await processFile(file);
      setBatchProgress({ current: index + 1, total: pendingFiles.length });
    }

    setIsProcessingAll(false);
    setBatchProgress({ current: 0, total: 0 });
    addToast('info', 'Processamento em lote concluído.');
  };

  const downloadFile = (fileStatus: FileStatus) => {
    if (!fileStatus.result) return;
    
    // Normalizing file name to avoid any browser special character quirks
    const rawName = fileStatus.file.name.replace(/\.[^/.]+$/, '').trim();
    const safeName = rawName.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_');
    const fileName = `${safeName}_convertido.csv`;

    const bom = '\uFEFF';
    const content = bom + fileStatus.result;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    
    // For Microsoft Edge / IE legacy compatibility if existing in environment
    if ((window.navigator as any).msSaveOrOpenBlob) {
      (window.navigator as any).msSaveOrOpenBlob(blob, fileName);
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.style.display = 'none';
    link.href = url;
    link.download = fileName;
    
    document.body.appendChild(link);
    link.click();
    
    // Crucial fix: Leave the object URL alive for 60 seconds.
    // Jetski/Edge interceptors sometimes need the blob URL alive longer to resolve the download.
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 60000);
  };

  const downloadAll = () => {
    const completed = files.filter(f => f.status === 'completed');
    completed.forEach((file, idx) => {
      setTimeout(() => {
        downloadFile(file);
      }, idx * 500); // staggering downloads slightly
    });
    addToast('success', `${completed.length} arquivo(s) baixado(s).`);
  };

  const toggleErrorExpanded = (id: string) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const progressPercent = batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0;
  const completedCount = files.filter(f => f.status === 'completed').length;

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-30",
        isSidebarOpen ? "w-72" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-100">
            <FileSpreadsheet size={24} />
          </div>
          {isSidebarOpen && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="text-lg font-black tracking-widest text-slate-900 uppercase">ÁGIL TJPA</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ferramentas de Gestão</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item, idx) => (
            <button
              key={idx}
              className={cn(
                "w-full flex items-center gap-4 p-3 rounded-2xl transition-all duration-200 group relative",
                item.active 
                  ? "bg-emerald-50 text-emerald-700" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon size={22} className={cn(
                "shrink-0 transition-transform duration-200 group-hover:scale-110",
                item.active ? "text-emerald-600" : "text-slate-400"
              )} />
              {isSidebarOpen && (
                <span className="text-sm font-bold tracking-tight">{item.label}</span>
              )}
              {item.active && (
                <motion.div 
                  layoutId="active-pill"
                  className="absolute left-0 w-1 h-6 bg-emerald-600 rounded-r-full"
                />
              )}
            </button>
          ))}
        </nav>

        {isSidebarOpen && (
          <div className="p-4 mx-4 mb-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-2">
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Estatísticas (Sessão)</p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Convertidos</span>
              <span className="text-sm font-black text-emerald-600">{sessionStats.success}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Erros</span>
              <span className="text-sm font-black text-red-500">{sessionStats.error}</span>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-slate-100 flex items-center justify-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">v1.1.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">

        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span>Utilitários</span>
              <ChevronRight size={14} />
              <span className="text-emerald-600">Conversor SEFIN</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-slate-700">Servidor Público</span>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Acesso Autorizado</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden relative">
              <Image 
                src="https://picsum.photos/seed/user/100" 
                alt="User" 
                fill
                sizes="40px"
                className="object-cover"
                referrerPolicy="no-referrer" 
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full space-y-10">
          {/* Hero Section */}
          <section className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck size={12} />
              Ambiente Seguro
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Conversor Inteligente</h2>
            <p className="text-slate-500 max-w-2xl text-lg leading-relaxed">
              Padronização automática de arquivos para os sistemas de gestão financeira do TJPA. 
              Converta planilhas e documentos PDF em segundos com tecnologia de IA.
            </p>
          </section>

          {/* Upload Area */}
          <div 
            {...getRootProps()} 
            className={cn(
              "relative group cursor-pointer rounded-[3rem] border-2 border-dashed transition-all duration-500 p-16 flex flex-col items-center justify-center gap-6 bg-white shadow-xl shadow-slate-200/50",
              isDragActive ? "border-emerald-500 bg-emerald-50/50 scale-[0.99]" : "border-slate-200 hover:border-emerald-400 hover:bg-slate-50/50"
            )}
          >
            <input {...getInputProps()} />
            <div className={cn(
              "w-24 h-24 rounded-3xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-2xl",
              isDragActive ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
            )}>
              <FileUp size={48} />
            </div>
            <div className="text-center space-y-2">
              <p className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                {isDragActive ? "Solte para Processar" : "Arraste seus Arquivos"}
              </p>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">
                XLSX • XLS • XLSM • CSV • PDF (OCR via IA)
              </p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Máximo 10MB por arquivo</p>
            </div>
            <div className="absolute bottom-6 flex gap-4 opacity-30 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-emerald-500" /> Excel
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-blue-500" /> CSV
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-red-500" /> PDF
              </div>
            </div>
          </div>

          {/* Progress Bar (Visible during batch processing) */}
          <AnimatePresence>
            {isProcessingAll && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"
              >
                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  <span>Processando Lote...</span>
                  <span>{batchProgress.current} de {batchProgress.total}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-emerald-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ ease: "easeInOut" }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* File List */}
          <AnimatePresence mode="popLayout">
            {files.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Fila de Processamento</h3>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[10px] font-bold">{files.length}</span>
                  </div>
                  
                  <div className="flex gap-3">
                    {completedCount > 1 && (
                      <button 
                        onClick={downloadAll}
                        className="px-6 py-3 bg-white text-emerald-700 border border-emerald-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-50 transition-all flex items-center gap-2 shadow-sm"
                      >
                        <DownloadCloud size={16} />
                        Baixar Todos ({completedCount})
                      </button>
                    )}
                    <button 
                      onClick={processAll}
                      disabled={isProcessingAll || files.every(f => f.status !== 'idle' && f.status !== 'error')}
                      className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 shadow-xl shadow-slate-200 flex items-center gap-3"
                    >
                      {isProcessingAll ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />}
                      Processar Todos
                    </button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {files.map((fileStatus) => (
                    <motion.div
                      key={fileStatus.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-white flex flex-col rounded-[2rem] border border-slate-100 shadow-sm transition-shadow hover:shadow-md overflow-hidden"
                    >
                      <div className="p-6 flex items-center gap-6 group">
                        <div className={cn(
                          "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                          fileStatus.file.name.endsWith('.pdf') ? "bg-red-50 text-red-500" : 
                          fileStatus.file.name.endsWith('.xlsm') ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500"
                        )}>
                          {fileStatus.file.name.endsWith('.pdf') ? <FileText size={32} /> : <FileSpreadsheet size={32} />}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-lg font-black text-slate-800 truncate uppercase tracking-tight">{fileStatus.file.name}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {(fileStatus.file.size / 1024).toFixed(1)} KB
                            </span>
                            <div className="w-1 h-1 bg-slate-200 rounded-full" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {fileStatus.file.name.split('.').pop()}
                            </span>
                            {fileStatus.result && (
                              <>
                                <div className="w-1 h-1 bg-slate-200 rounded-full" />
                                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                                  {fileStatus.result.split('\n').length - 1} Linhas
                               </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {fileStatus.status === 'idle' && (
                            <button 
                              onClick={() => processFile(fileStatus)}
                              className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-emerald-600 hover:text-white rounded-2xl transition-all duration-300"
                              title="Converter"
                            >
                              <ChevronRight size={24} />
                            </button>
                          )}
                          
                          {fileStatus.status === 'processing' && (
                            <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                              <Loader2 className="animate-spin" size={16} />
                              Processando
                            </div>
                          )}

                          {fileStatus.status === 'completed' && (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setPreviewFile(fileStatus)}
                                className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
                                title="Visualizar CSV"
                              >
                                <Table size={18} />
                              </button>
                              <div className="w-10 h-10 flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-full">
                                <CheckCircle2 size={24} />
                              </div>
                              <button 
                                onClick={() => downloadFile(fileStatus)}
                                className="flex items-center gap-3 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                              >
                                <Download size={16} />
                                Baixar
                              </button>
                            </div>
                          )}

                          {fileStatus.status === 'error' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => toggleErrorExpanded(fileStatus.id)}
                                className="flex flex-col items-center justify-center px-4 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl transition-colors"
                              >
                                <div className="flex gap-1 items-center">
                                  <AlertCircle size={16} />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Erro</span>
                                </div>
                                <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest mt-0.5">Ver Detalhes</span>
                              </button>
                              <button 
                                onClick={() => processFile(fileStatus)}
                                className="px-4 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors"
                              >
                                Retry
                              </button>
                            </div>
                          )}

                          <button 
                            onClick={() => removeFile(fileStatus.id)}
                            className="w-12 h-12 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-300 ml-2"
                            title="Remover"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Error Section */}
                      <AnimatePresence>
                        {fileStatus.status === 'error' && expandedErrors.has(fileStatus.id) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-6 pb-6 pt-2 bg-red-50/30"
                          >
                            <div className="p-4 bg-white rounded-xl border border-red-100 flex gap-3">
                              <Info className="text-red-400 shrink-0 mt-0.5" size={16} />
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Detalhe do Erro</p>
                                <p className="text-sm text-slate-600 font-mono break-all">{fileStatus.error}</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {files.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24 space-y-6"
            >
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-white text-slate-200 shadow-sm border border-slate-100">
                <FileSpreadsheet size={48} />
              </div>
              <div className="space-y-2">
                <p className="text-slate-400 font-black uppercase tracking-[0.2em]">Nenhum arquivo na fila</p>
                <p className="text-xs text-slate-300 uppercase tracking-widest font-bold">Aguardando upload para processamento</p>
              </div>
            </motion.div>
          )}
        </main>

        <footer className="py-6 px-6 border-t border-slate-200 bg-white/60 backdrop-blur-sm">
          <p className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            © Tribunal de Justiça do Estado do Pará — Laboratório de Inovação da SEFIN
          </p>
        </footer>
      </div>

      {/* CSV Preview Modal */}
      <AnimatePresence>
        {previewFile && previewFile.result && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewFile(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col relative z-10 overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <Table className="text-emerald-600" size={20} />
                  <div>
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Preview: {previewFile.file.name}</h2>
                    <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Amostra: Primeiras 50 linhas</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewFile(null)} 
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-0 overflow-auto flex-1">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      {previewFile.result.split('\n')[0].split(',').map((header, i) => (
                        <th key={i} className="px-4 py-3 font-black text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                          {header.replace(/"/g, '')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewFile.result.split('\n').filter(line => line.trim() !== '').slice(1, 51).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        {row.split(',').map((cell, j) => (
                          <td key={j} className="px-4 py-3 text-slate-600 text-xs font-medium">
                            {cell.replace(/"/g, '') || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => {
                    downloadFile(previewFile);
                    setPreviewFile(null);
                  }}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Download size={16} />
                  Baixar CSV
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl shadow-slate-200/50 border",
                toast.type === 'success' ? "bg-white border-emerald-100" :
                toast.type === 'error' ? "bg-white border-red-100" : "bg-white border-blue-100"
              )}
            >
              {toast.type === 'success' ? <CheckCircle2 className="text-emerald-500" size={20} /> :
               toast.type === 'error' ? <XCircle className="text-red-500" size={20} /> : 
               <Info className="text-blue-500" size={20} />}
              <p className="text-sm font-bold text-slate-700">{toast.message}</p>
              <button 
                onClick={() => dismissToast(toast.id)}
                className="ml-2 text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
