'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';
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
  Archive,
  FileStack
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { convertFileToCsv } from '@/lib/gemini';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { PreviewModal } from '@/components/PreviewModal';
import { ToastContainer, type Toast } from '@/components/ToastContainer';
import { Sidebar } from '@/components/layout/Sidebar';

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

export default function ConversorCsv() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);
  const [animateIcon, setAnimateIcon] = useState(false);
  const [previewData, setPreviewData] = useState<{ id: string, name: string, data: any[], totalRows: number } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('conversor_csv_files');
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
  useEffect(() => {
    const toSave = files
      .filter(f => f.status === 'completed' || f.status === 'error')
      .map(({ file, ...rest }) => rest);
    localStorage.setItem('conversor_csv_files', JSON.stringify(toSave));
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

  // Helper para limpar artefatos markdown
  const cleanCsvResult = (raw: string) =>
    raw.replace(/^```(?:csv|txt)?\n?/gm, '').replace(/```$/gm, '').trim();

  // Normaliza qualquer CSV para o padrão brasileiro: ; como delimitador, , como decimal, aspas duplas
  const normalizeToBrazilianCsv = (rawCsv: string): string => {
    const cleaned = cleanCsvResult(rawCsv);
    
    // Detecta o delimitador mais provável
    const firstLine = cleaned.split('\n')[0] || '';
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    
    let detectedDelimiter = ';';
    if (tabCount > semicolonCount && tabCount > commaCount) detectedDelimiter = '\t';
    else if (commaCount > semicolonCount) detectedDelimiter = ',';
    
    const parsed = Papa.parse(cleaned, {
      header: false,
      skipEmptyLines: true,
      delimiter: detectedDelimiter,
    });

    // Converte decimais: troca ponto por vírgula em valores numéricos
    const formattedData = (parsed.data as string[][]).map(row =>
      row.map(cell => {
        if (typeof cell !== 'string') return cell;
        const trimmed = cell.trim();
        // Detecta padrão numérico com ponto decimal (ex: 1234.56 ou 1,234.56)
        if (/^-?[\d,]*\.\d+$/.test(trimmed)) {
          // Remove separador de milhar (vírgula) e troca ponto decimal por vírgula
          return trimmed.replace(/,/g, '').replace('.', ',');
        }
        return cell;
      })
    );

    return Papa.unparse(formattedData, {
      quotes: true,
      delimiter: ';',
    });
  };

  const processFile = async (fileStatus: FileStatus) => {
    const { file, id, name, type } = fileStatus;
    if (!file && fileStatus.status === 'idle') return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing' } : f));

    try {
      let csvResult = '';

      if (name.endsWith('.xlsm') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
        if (!file) throw new Error("Arquivo não encontrado na memória");
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Formata números para o padrão brasileiro (vírgula como separador decimal)
        const formattedData = jsonData.map(row => 
          row.map(cell => typeof cell === 'number' ? cell.toString().replace('.', ',') : cell)
        );
        
        csvResult = Papa.unparse(formattedData, {
          quotes: true,
          quoteChar: '"',
          delimiter: ";",
        });
      } else if (name.endsWith('.csv')) {
        if (!file) throw new Error("Arquivo não encontrado na memória");
        const text = (await file.text()).replace(/^\uFEFF/, '');
        const parsed = Papa.parse(text, { skipEmptyLines: true });
        
        // Formata números para o padrão brasileiro (vírgula como separador decimal)
        const formattedData = (parsed.data as any[][]).map(row => 
          row.map(cell => {
            // Tenta converter para número para ver se precisa de troca de ponto por vírgula
            const num = Number(cell);
            if (!isNaN(num) && typeof cell === 'string' && cell.includes('.')) {
              return cell.replace('.', ',');
            }
            return cell;
          })
        );
        
        csvResult = Papa.unparse(formattedData, {
          quotes: true,
          quoteChar: '"',
          delimiter: ";",
        });
      } else if ((type || '').startsWith('image/') || name.endsWith('.pdf')) {
        if (!file) throw new Error("Arquivo não encontrado na memória");
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(file);
        });
        
        let finalType = type;
        if (!finalType) {
          if (name.endsWith('.pdf')) finalType = 'application/pdf';
          else if (name.endsWith('.png')) finalType = 'image/png';
          else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) finalType = 'image/jpeg';
          else if (name.endsWith('.webp')) finalType = 'image/webp';
          else if (name.endsWith('.heic')) finalType = 'image/heic';
          else if (name.endsWith('.heif')) finalType = 'image/heif';
        }
        const rawResult = await convertFileToCsv(base64, finalType);
        csvResult = normalizeToBrazilianCsv(rawResult);
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


  const downloadFile = async (fileStatus: FileStatus, format: 'csv' | 'txt' = 'csv') => {
    if (!fileStatus.result) return;
    
    const extension = format === 'csv' ? 'csv' : 'txt';
    const fileName = `${fileStatus.name.replace(/\.[^/.]+$/, '')}_convertido.${extension}`;
    const content = cleanCsvResult(fileStatus.result);
    
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, fileName, format }),
      });

      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 200);
    } catch (error) {
      console.error('Download error:', error);
      addToast('Erro ao baixar arquivo', 'error');
    }
  };

  const downloadAllZip = async (format: 'csv' | 'txt' = 'csv') => {
    const completedFiles = files.filter(f => f.status === 'completed' && f.result);
    if (completedFiles.length === 0) return;

    const zip = new JSZip();
    const extension = format === 'csv' ? 'csv' : 'txt';
    
    completedFiles.forEach(f => {
      const BOM = "\uFEFF";
      const clean = cleanCsvResult(f.result || '');
      zip.file(`${f.name.replace(/\.[^/.]+$/, '')}_convertido.${extension}`, BOM + clean);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipFileName = `CONVERSOR_CSV_LOTE_${Date.now()}.zip`;
    const url = window.URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipFileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 200);
    addToast(`ZIP (${format.toUpperCase()}) gerado com sucesso`, 'success');
  };

  const openPreview = (fileStatus: FileStatus) => {
    if (!fileStatus.result) return;
    const cleaned = cleanCsvResult(fileStatus.result);
    const parsed = Papa.parse(cleaned, { 
      header: false,
      delimiter: ";",
      skipEmptyLines: true,
    });
    setPreviewData({
      id: fileStatus.id,
      name: fileStatus.name,
      data: parsed.data.slice(0, 21) as any[], // Header + 20 rows
      totalRows: (parsed.data as any[]).length - 1, // Exclude header
    });
  };

  const combineAndDownload = async (format: 'csv' | 'txt' = 'csv') => {
    const completedFiles = files.filter(f => f.status === 'completed' && f.result);
    if (completedFiles.length < 2) {
      addToast("Adicione pelo menos 2 arquivos concluídos para mesclar", 'info');
      return;
    }

    let combinedData: any[] = [];
    
    completedFiles.forEach((f, index) => {
      const parsed = Papa.parse(f.result!, { 
        header: false, 
        skipEmptyLines: true,
        delimiter: ";"
      });
      if (index === 0) {
        combinedData = parsed.data;
      } else {
        combinedData = [...combinedData, ...parsed.data.slice(1)];
      }
    });

    const resultString = Papa.unparse(combinedData, {
      quotes: true,
      delimiter: ";",
    });

    const extension = format === 'csv' ? 'csv' : 'txt';
    const fileName = `CONVERSOR_CSV_MESCLADO_${Date.now()}.${extension}`;

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: resultString, fileName, format }),
      });

      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 200);
      addToast(`Arquivos mesclados (${format.toUpperCase()}) com sucesso`, 'success');
    } catch (error) {
      console.error('Merge download error:', error);
      addToast('Erro ao baixar arquivo mesclado', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto w-full">
        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors shrink-0"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block shrink-0" />
            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest min-w-0">
              <span className="hidden sm:inline">Utilitários</span>
              <ChevronRight size={14} className="hidden sm:inline shrink-0" />
              <span className="text-emerald-600 truncate">Conversor .CSV</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-slate-700">Servidor Público</span>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Acesso Autorizado</span>
            </div>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden relative shrink-0">
              <Image 
                src="https://picsum.photos/seed/user/100" 
                alt="Avatar do servidor" 
                fill
                sizes="40px"
                className="object-cover"
                referrerPolicy="no-referrer" 
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-10 max-w-6xl mx-auto w-full space-y-6 sm:space-y-10">
          {/* Hero Section */}
          <section className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck size={12} />
              Ambiente Seguro
            </div>
            <h2 className="text-xl sm:text-2xl md:text-4xl font-black text-slate-900 tracking-tight uppercase">Conversor Inteligente</h2>
            <p className="text-slate-500 max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed">
              Padronização automática de arquivos para atender as exigencias do CNJ com relação a disponibilização de Dados Abertos no Portal da Transparência do TJPA. 
              Converta planilhas, documentos e PDF em segundos.
            </p>
          </section>

          {/* Upload Area */}
          <div 
            {...getRootProps()} 
            className={cn(
              "relative group cursor-pointer rounded-2xl sm:rounded-[2rem] md:rounded-[3rem] border-2 border-dashed transition-all duration-500 p-6 sm:p-8 md:p-16 flex flex-col items-center justify-center gap-4 sm:gap-6 bg-white shadow-xl shadow-slate-200/50",
              isDragActive ? "border-emerald-500 bg-emerald-50/50 scale-[0.99]" : "border-slate-200 hover:border-emerald-400 hover:bg-slate-50/50"
            )}
          >
            <input {...getInputProps()} />
          <motion.div 
            animate={animateIcon ? { y: [0, -10, 0], scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={cn(
              "w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-2xl",
              isDragActive ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"
            )}
          >
            <FileUp size={32} className="sm:hidden" />
            <FileUp size={48} className="hidden sm:block" />
          </motion.div>
            <div className="text-center space-y-2">
              <p className="text-xl sm:text-2xl font-black text-slate-800 uppercase tracking-tight">
                {isDragActive ? "Solte para Processar" : "Arraste seus Arquivos"}
              </p>
              <p className="text-[10px] sm:text-sm text-slate-400 font-bold uppercase tracking-widest">
                XLSX • XLS • XLSM • CSV • PDF • IMAGENS (MÁX. 100MB)
              </p>
            </div>
            <div className="absolute bottom-6 hidden sm:flex gap-4 opacity-30 group-hover:opacity-100 transition-opacity">
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

          <AnimatePresence mode="popLayout">
            {files.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Fila de Processamento</h3>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[10px] font-bold">{files.length}</span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 px-2 sm:px-0">
                    {files.some(f => f.status === 'completed') && (
                      <>
                        <button 
                          onClick={() => clearQueue(true)}
                          className="px-3 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center"
                        >
                          Limpar
                        </button>
                        <div className="flex items-center bg-emerald-50 p-1 rounded-xl border border-emerald-100">
                          <button 
                            onClick={() => downloadAllZip('csv')}
                            className="flex-1 sm:flex-initial px-3 py-1.5 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            title="Baixar ZIP com CSVs"
                          >
                            <Archive size={12} />
                            (CSV)
                          </button>
                          <button 
                            onClick={() => downloadAllZip('txt')}
                            className="flex-1 sm:flex-initial px-3 py-1.5 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            title="Baixar ZIP com TXTs"
                          >
                            <FileText size={12} />
                            (TXT)
                          </button>
                        </div>

                        {files.filter(f => f.status === 'completed').length >= 2 && (
                          <div className="flex items-center gap-1 bg-blue-50 p-1 rounded-xl border border-blue-100">
                            <button 
                              onClick={() => combineAndDownload('csv')}
                              className="flex-1 sm:flex-initial px-3 py-1.5 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                              title="Mesclar em CSV único"
                            >
                              <FileStack size={12} />
                              Mesclar (CSV)
                            </button>
                            <button 
                              onClick={() => combineAndDownload('txt')}
                              className="flex-1 sm:flex-initial px-3 py-1.5 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                              title="Mesclar em TXT único"
                            >
                              <FileText size={12} />
                              Mesclar (TXT)
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    <button 
                      onClick={processAll}
                      disabled={isProcessingAll || files.every(f => f.status !== 'idle')}
                      className="w-full sm:w-auto px-4 sm:px-8 py-3 bg-slate-900 text-white rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 shadow-xl shadow-slate-200 flex items-center justify-center gap-2 sm:gap-3"
                    >
                      {isProcessingAll ? <Loader2 className="animate-spin" size={14} /> : <FileSpreadsheet size={14} />}
                      {isProcessingAll ? "Processando..." : "Processar Tudo"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:gap-4">
                  {files.map((fileStatus) => (
                    <motion.div
                      key={fileStatus.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-white rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 group hover:shadow-md transition-shadow"
                    >
                      <div className={cn(
                        "w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                        fileStatus.name.endsWith('.pdf') ? "bg-red-50 text-red-500" : 
                        (fileStatus.type || '').startsWith('image/') ? "bg-amber-50 text-amber-500" :
                        (fileStatus.name.endsWith('.xlsm') || fileStatus.name.endsWith('.xlsx') || fileStatus.name.endsWith('.xls')) ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500"
                      )}>
                        {fileStatus.name.endsWith('.pdf') ? <FileText size={24} className="sm:hidden" /> : 
                         (fileStatus.type || '').startsWith('image/') ? <ImageIcon size={24} className="sm:hidden" /> :
                         <FileSpreadsheet size={24} className="sm:hidden" />}
                        {fileStatus.name.endsWith('.pdf') ? <FileText size={32} className="hidden sm:block" /> : 
                         (fileStatus.type || '').startsWith('image/') ? <ImageIcon size={32} className="hidden sm:block" /> :
                         <FileSpreadsheet size={32} className="hidden sm:block" />}
                      </div>
                      
                      <div className="flex-1 min-w-0 w-full sm:w-auto">
                        <p className="text-sm sm:text-lg font-black text-slate-800 truncate uppercase tracking-tight">{fileStatus.name}</p>
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

                      <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end sm:justify-start flex-wrap sm:flex-nowrap">
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
                            
                            <div className="flex items-center bg-emerald-600 rounded-xl sm:rounded-2xl shadow-lg shadow-emerald-100 overflow-hidden">
                              <button 
                                onClick={() => downloadFile(fileStatus, 'csv')}
                                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all border-r border-emerald-500/30"
                                title="Baixar CSV"
                              >
                                <Download size={14} />
                                CSV
                              </button>
                              <button 
                                onClick={() => downloadFile(fileStatus, 'txt')}
                                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all"
                                title="Baixar TXT"
                              >
                                <FileText size={14} />
                                TXT
                              </button>
                            </div>
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
                          className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl sm:rounded-2xl transition-all duration-300"
                          title="Remover"
                        >
                          <Trash2 size={18} className="sm:hidden" />
                          <Trash2 size={20} className="hidden sm:block" />
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
              className="text-center py-12 sm:py-24 space-y-4 sm:space-y-6"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-[2rem] bg-white text-slate-200 shadow-sm border border-slate-100">
                <FileSpreadsheet size={32} className="sm:hidden" />
                <FileSpreadsheet size={48} className="hidden sm:block" />
              </div>
              <div className="space-y-2">
                <p className="text-slate-400 font-black uppercase tracking-[0.2em]">Nenhum arquivo na fila</p>
                <p className="text-xs text-slate-300 uppercase tracking-widest font-bold">Aguardando upload para processamento</p>
              </div>
            </motion.div>
          )}
        </main>

        {/* Footer */}
        <footer className="p-4 sm:p-8 text-center border-t border-slate-100 bg-white/50">
          <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
            @ Tribunal de Justiça do Estado do Pará - Laboratório de Inovação da SEFIN.
          </p>
        </footer>
      </div>

      {/* Preview Modal */}
      <PreviewModal 
        previewData={previewData} 
        onClose={() => setPreviewData(null)} 
      />

      {/* Toast Notifications */}
      <ToastContainer 
        toasts={toasts} 
        onClose={(id) => setToasts(prev => prev.filter(t => t.id !== id))} 
      />
    </div>
  );
}
