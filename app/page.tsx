'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
import JSZip from 'jszip';
import { 
  FileUp, 
  FileText, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Trash2,
  ChevronRight,
  LayoutDashboard,
  Users,
  Briefcase,
  Gavel,
  ShieldCheck,
  Settings,
  Menu,
  X,
  Image as ImageIcon,
  Eye,
  Eraser,
  Bell,
  Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { convertFileToCsv } from '@/lib/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileStatus {
  id: string;
  file?: File; // Optional because persisted files won't have the original File object
  name: string;
  size: number;
  type: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  result?: string;
  error?: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const SIDEBAR_ITEMS = [
  { icon: FileSpreadsheet, label: 'Conversor SEFIN', active: true },
];

export default function ConversorSefin() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [animateIcon, setAnimateIcon] = useState(false);
  const [previewData, setPreviewData] = useState<{ name: string, data: any[] } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

  // Load persistence
  React.useEffect(() => {
    const saved = localStorage.getItem('conversor_sefin_files');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only keep completed or error files as they have the results/errors
        setFiles(parsed.filter((f: any) => f.status === 'completed' || f.status === 'error'));
      } catch (e) {
        console.error("Failed to load saved files", e);
      }
    }
  }, []);

  // Save persistence
  React.useEffect(() => {
    const toSave = files
      .filter(f => f.status === 'completed' || f.status === 'error')
      .map(({ file, ...rest }) => rest);
    localStorage.setItem('conversor_sefin_files', JSON.stringify(toSave));
  }, [files]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    const newFiles = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'idle' as const,
    }));

    const rejectedFiles = fileRejections.map(rejection => ({
      id: Math.random().toString(36).substring(7),
      name: rejection.file.name,
      size: rejection.file.size,
      type: rejection.file.type,
      status: 'error' as const,
      error: rejection.errors[0].code === 'file-too-large' 
        ? 'Arquivo excede o limite de 100MB' 
        : 'Formato não suportado'
    }));

    if (fileRejections.length > 0) {
      addToast(`${fileRejections.length} arquivo(s) rejeitado(s)`, 'error');
    }

    setFiles(prev => [...prev, ...newFiles, ...rejectedFiles]);
    
    if (acceptedFiles.length > 0) {
      setAnimateIcon(true);
      setTimeout(() => setAnimateIcon(false), 500);
      addToast(`${acceptedFiles.length} arquivo(s) adicionado(s)`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
    accept: {
      'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif']
    }
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearQueue = (onlyCompleted = false) => {
    if (onlyCompleted) {
      setFiles(prev => prev.filter(f => f.status !== 'completed'));
      addToast("Arquivos concluídos removidos");
    } else {
      setFiles([]);
      addToast("Fila limpa");
    }
  };

  const processFile = async (fileStatus: FileStatus) => {
    const { file, id, name, type } = fileStatus;
    if (!file && fileStatus.status === 'idle') return; // Should not happen for idle files

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing' } : f));

    try {
      let csvResult = '';

      if (name.endsWith('.xlsm') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
        if (!file) throw new Error("Arquivo não encontrado na memória");
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        csvResult = Papa.unparse(jsonData, {
          quotes: true,
          delimiter: ",",
        });
      } else if (name.endsWith('.csv')) {
        if (!file) throw new Error("Arquivo não encontrado na memória");
        const text = await file.text();
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        
        csvResult = Papa.unparse(parsed.data, {
          quotes: true,
          delimiter: ",",
        });
      } else if (type.startsWith('image/') || name.endsWith('.pdf')) {
        if (!file) throw new Error("Arquivo não encontrado na memória");
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(file);
        });
        
        csvResult = await convertFileToCsv(base64, type);
      }

      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'completed', 
        result: csvResult 
      } : f));
      addToast(`Sucesso: ${name}`, 'success');
    } catch (error: any) {
      console.error(`Error processing ${name}:`, error);
      setFiles(prev => prev.map(f => f.id === id ? { 
        ...f, 
        status: 'error', 
        error: error.message || 'Erro desconhecido' 
      } : f));
      addToast(`Erro: ${name}`, 'error');
    }
  };

  const processAll = async () => {
    setIsProcessingAll(true);
    const idleFiles = files.filter(f => f.status === 'idle');
    for (const file of idleFiles) {
      await processFile(file);
    }
    setIsProcessingAll(false);
  };

  const downloadFile = (fileStatus: FileStatus) => {
    if (!fileStatus.result) return;
    
    const blob = new Blob([fileStatus.result], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileStatus.name.split('.')[0]}_convertido.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllZip = async () => {
    const completedFiles = files.filter(f => f.status === 'completed' && f.result);
    if (completedFiles.length === 0) return;

    const zip = new JSZip();
    completedFiles.forEach(f => {
      zip.file(`${f.name.split('.')[0]}_convertido.csv`, f.result!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CONVERSOR_SEFIN_LOTE_${new Date().getTime()}.zip`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("ZIP gerado com sucesso", 'success');
  };

  const openPreview = (fileStatus: FileStatus) => {
    if (!fileStatus.result) return;
    const parsed = Papa.parse(fileStatus.result, { header: false });
    setPreviewData({
      name: fileStatus.name,
      data: parsed.data.slice(0, 11) as any[] // Header + 10 rows
    });
  };

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
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gestão Financeira</p>
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

        <div className="p-4 border-t border-slate-100 flex items-center justify-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">v1.0.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
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
              Converta planilhas, documentos PDF e imagens em segundos com tecnologia de IA.
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
          <motion.div 
            animate={animateIcon ? { y: [0, -10, 0], scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={cn(
              "w-24 h-24 rounded-3xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-2xl",
              isDragActive ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
            )}
          >
            <FileUp size={48} />
          </motion.div>
            <div className="text-center space-y-2">
              <p className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                {isDragActive ? "Solte para Processar" : "Arraste seus Arquivos"}
              </p>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">
                XLSX • XLS • XLSM • CSV • PDF • IMAGENS (MÁX. 100MB)
              </p>
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
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest">
                <div className="w-2 h-2 rounded-full bg-amber-500" /> Imagem
              </div>
            </div>
          </div>

          {/* File List */}
          <AnimatePresence mode="popLayout">
            {files.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Fila de Processamento</h3>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[10px] font-bold">{files.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {files.some(f => f.status === 'completed') && (
                      <>
                        <button 
                          onClick={() => clearQueue(true)}
                          className="px-4 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          Limpar Concluídos
                        </button>
                        <button 
                          onClick={downloadAllZip}
                          className="px-6 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2"
                        >
                          <Archive size={14} />
                          Baixar Tudo (ZIP)
                        </button>
                      </>
                    )}
                    <button 
                      onClick={processAll}
                      disabled={isProcessingAll || files.every(f => f.status !== 'idle')}
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
                      className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-6 group hover:shadow-md transition-shadow"
                    >
                      <div className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                        fileStatus.name.endsWith('.pdf') ? "bg-red-50 text-red-500" : 
                        fileStatus.type.startsWith('image/') ? "bg-amber-50 text-amber-500" :
                        (fileStatus.name.endsWith('.xlsm') || fileStatus.name.endsWith('.xlsx') || fileStatus.name.endsWith('.xls')) ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500"
                      )}>
                        {fileStatus.name.endsWith('.pdf') ? <FileText size={32} /> : 
                         fileStatus.type.startsWith('image/') ? <ImageIcon size={32} /> :
                         <FileSpreadsheet size={32} />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-black text-slate-800 truncate uppercase tracking-tight">{fileStatus.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {(fileStatus.size / 1024).toFixed(1)} KB
                          </span>
                          <div className="w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {fileStatus.name.split('.').pop()}
                          </span>
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
                            <div className="w-10 h-10 flex items-center justify-center bg-emerald-100 text-emerald-600 rounded-full">
                              <CheckCircle2 size={24} />
                            </div>
                            <button 
                              onClick={() => openPreview(fileStatus)}
                              className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all"
                              title="Visualizar"
                            >
                              <Eye size={20} />
                            </button>
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
                          <div className="flex items-center gap-3 px-4 py-2 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest" title={fileStatus.error}>
                            <AlertCircle size={16} />
                            Erro
                          </div>
                        )}

                        <button 
                          onClick={() => removeFile(fileStatus.id)}
                          className="w-12 h-12 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all duration-300"
                          title="Remover"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
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
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewData(null)}
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
                  onClick={() => setPreviewData(null)}
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
                  onClick={() => setPreviewData(null)}
                  className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-600 transition-all"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <div className="fixed bottom-8 right-8 z-[60] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "pointer-events-auto px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[300px] border",
                toast.type === 'success' ? "bg-emerald-600 text-white border-emerald-500" :
                toast.type === 'error' ? "bg-red-600 text-white border-red-500" :
                "bg-slate-900 text-white border-slate-800"
              )}
            >
              <div className="shrink-0">
                {toast.type === 'success' ? <CheckCircle2 size={20} /> :
                 toast.type === 'error' ? <AlertCircle size={20} /> :
                 <Bell size={20} />}
              </div>
              <p className="text-sm font-bold tracking-tight">{toast.message}</p>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="ml-auto p-1 hover:bg-white/20 rounded-lg transition-colors"
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
