"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export default function FileConverter() {
  const [activeCategory, setActiveCategory] = useState<"images" | "documents" | "audio" | "video">("images");
  const [activeConversion, setActiveConversion] = useState<string>("img-to-pdf");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState("");
  const [pdfPageRange, setPdfPageRange] = useState("");
  const [pdfTotalPages, setPdfTotalPages] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = "btn-sweep-style";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        @property --sweep-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes btn-sweep {
          to { --sweep-angle: 360deg; }
        }
        .btn-sweep-wrapper {
          position: relative;
          border-radius: 0.75rem;
          padding: 3px;
          background: #111;
        }
        .btn-sweep-wrapper::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 0.75rem;
          padding: 3px;
          background: conic-gradient(from var(--sweep-angle), transparent 0deg, transparent 270deg, #C9A84C 310deg, #e8c96a 340deg, #C9A84C 360deg);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: btn-sweep 1.4s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const CATEGORIES = {
    images: {
      label: "Images",
      accept: "image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.heic,.pdf",
      outputs: [
        { id: "img-to-pdf", label: "→ PDF" },
        { id: "pdf-to-img", label: "→ PNG (from PDF)" },
        { id: "jpg-png",    label: "→ PNG" },
        { id: "png-jpg",    label: "→ JPG" },
        { id: "png-webp",   label: "→ WebP" },
        { id: "gif-convert",label: "→ MP4 (GIF)" },
      ]
    },
    documents: {
      label: "Documents",
      accept: ".pdf,.doc,.docx,.txt,.md,.html,.htm,.csv,.xlsx,.xls",
      outputs: [
        { id: "doc-pdf",  label: "→ PDF" },
        { id: "pdf-doc",  label: "→ Word" },
        { id: "txt-pdf",  label: "→ PDF (Text)" },
        { id: "csv-xlsx", label: "→ Excel" },
        { id: "xlsx-csv", label: "→ CSV" },
      ]
    },
    audio: {
      label: "Audio",
      accept: "audio/*,.mp3,.wav,.aac,.m4a,.ogg,.flac,.aiff,.aif,.wma,.opus",
      outputs: [
        { id: "any-mp3",      label: "→ MP3" },
        { id: "mp3-wav",      label: "→ WAV" },
        { id: "compress-mp3", label: "→ Compressed" },
        { id: "extract-audio",label: "→ MP3 (from Video)" },
      ]
    },
    video: {
      label: "Video",
      accept: "video/*,.mp4,.mov,.avi,.wmv,.mkv,.gif",
      outputs: [
        { id: "mov-mp4",       label: "→ MP4" },
        { id: "mp4-mov",       label: "→ MOV" },
        { id: "mp4-gif",       label: "→ GIF" },
        { id: "video-mp3",     label: "→ MP3" },
        { id: "compress-video",label: "→ Compressed" },
      ]
    },
  };

  const currentCategory = CATEGORIES[activeCategory];
  const currentOutput = currentCategory.outputs.find(o => o.id === activeConversion) || currentCategory.outputs[0];
  // Build a currentConversion-compatible object for the rest of the code
  const currentConversion = { id: currentOutput.id, label: currentOutput.label, accept: currentCategory.accept };

  const handleFile = useCallback(async (newFiles: FileList | null) => {
    if (!newFiles) return;
    const accept = currentConversion.accept;
    const validFiles = Array.from(newFiles).filter(f => {
      if (accept === "image/*") return f.type.startsWith("image/");
      if (accept === "audio/*") return f.type.startsWith("audio/");
      if (accept === "video/*") return f.type.startsWith("video/");
      const extensions = accept.split(",");
      return extensions.some(ext => f.name.toLowerCase().endsWith(ext.replace(".", "")));
    });
    if (validFiles.length === 0) {
      setError(`Please upload a valid ${currentCategory.label.toLowerCase()} file`);
      return;
    }
    setFiles(prev => [...prev, ...validFiles]);
    setError("");
    setPdfTotalPages(null);
    setPdfPageRange("");
    if (activeConversion === "pdf-to-img" && validFiles.length > 0) {
      const ab = await validFiles[0].arrayBuffer();
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await pdfjs.getDocument({ data: ab }).promise;
      setPdfTotalPages(doc.numPages);
    }
  }, [currentConversion, activeConversion]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files);
  }, [handleFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files);
    e.target.value = "";
  }, [handleFile]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveFile = useCallback((index: number, direction: "up" | "down") => {
    setFiles(prev => {
      const newFiles = [...prev];
      if (direction === "up" && index > 0) {
        [newFiles[index], newFiles[index - 1]] = [newFiles[index - 1], newFiles[index]];
      } else if (direction === "down" && index < newFiles.length - 1) {
        [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
      }
      return newFiles;
    });
  }, []);

  const convertFiles = useCallback(async () => {
    if (files.length === 0) return;
    setConverting(true);
    setError("");
    
    try {
      // ========== IMAGES ==========
      
      // Images to PDF
      if (activeConversion === "img-to-pdf") {
        const jsPDF = (await import("jspdf")).default;
        const pdf = new jsPDF();
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const img = await createImageBitmap(file);
          
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          
          const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
          const imgWidth = pdf.internal.pageSize.getWidth();
          const imgHeight = (img.height * imgWidth) / img.width;
          
          if (i > 0) pdf.addPage();
          pdf.addImage(dataUrl, "JPEG", 0, 0, imgWidth, imgHeight);
        }
        
        pdf.save("photos-album.pdf");
      }
      
      // PDF to Images
      else if (activeConversion === "pdf-to-img") {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        
        for (const file of files) {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          const total = pdf.numPages;

          // Parse page range: e.g. "1,3,5-8" or empty = all
          let pagesToConvert: number[];
          if (pdfPageRange.trim()) {
            const selected = new Set<number>();
            for (const part of pdfPageRange.split(",")) {
              const trimmed = part.trim();
              const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
              if (rangeMatch) {
                const from = Math.max(1, parseInt(rangeMatch[1]));
                const to = Math.min(total, parseInt(rangeMatch[2]));
                for (let p = from; p <= to; p++) selected.add(p);
              } else {
                const n = parseInt(trimmed);
                if (!isNaN(n) && n >= 1 && n <= total) selected.add(n);
              }
            }
            pagesToConvert = [...selected].sort((a, b) => a - b);
            if (pagesToConvert.length === 0) throw new Error(`No valid pages in range "${pdfPageRange}" (PDF has ${total} pages)`);
          } else {
            pagesToConvert = Array.from({ length: total }, (_, i) => i + 1);
          }

          for (const pageNum of pagesToConvert) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2 });
            
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d")!;
            
            await page.render({ canvasContext: ctx, viewport, canvas: canvas as unknown as HTMLCanvasElement }).promise;
            
            const blob = await new Promise<Blob>((resolve) => {
              canvas.toBlob((b) => resolve(b!), "image/png");
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${file.name.replace(/\.pdf$/i, "")}_page${pageNum}.png`;
            a.click();
            URL.revokeObjectURL(url);
          }
        }
      }
      
      // Image format conversions
      else if (["jpg-png", "png-jpg", "webp-png", "webp-jpg", "png-webp", "jpg-webp", "gif-convert"].includes(activeConversion)) {
        const outputFormat: Record<string, string> = {
          "jpg-png": "image/png",
          "webp-png": "image/png",
          "png-jpg": "image/jpeg",
          "webp-jpg": "image/jpeg",
          "png-webp": "image/webp",
          "jpg-webp": "image/webp",
          "gif-convert": "image/png",
        };
        const ext: Record<string, string> = {
          "jpg-png": "png",
          "webp-png": "png",
          "png-jpg": "jpg",
          "webp-jpg": "jpg",
          "png-webp": "webp",
          "jpg-webp": "webp",
          "gif-convert": "png",
        };
        
        for (const file of files) {
          const img = await createImageBitmap(file);
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), outputFormat[activeConversion], 0.95);
          });
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name.replace(/\.[^/.]+$/, `.${ext[activeConversion]}`);
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      
      // ========== DOCUMENTS ==========
      
      // Text/Markdown to PDF
      else if (activeConversion === "txt-pdf" || activeConversion === "md-pdf") {
        const jsPDF = (await import("jspdf")).default;
        const pdf = new jsPDF();
        
        for (const file of files) {
          const text = await file.text();
          let content = text;
          
          if (activeConversion === "md-pdf") {
            const { marked } = await import("marked");
            content = await marked(text);
            // Strip HTML tags for simple text output
            content = content.replace(/<[^>]*>/g, " ");
          }
          
          const lines = pdf.splitTextToSize(content, 180);
          let y = 20;
          
          for (let i = 0; i < lines.length; i++) {
            if (y > 280) {
              pdf.addPage();
              y = 20;
            }
            pdf.text(lines[i], 15, y);
            y += 7;
          }
          
          pdf.save(`${file.name.replace(/\.[^/.]+$/, "")}.pdf`);
        }
      }
      
      // CSV to Excel
      else if (activeConversion === "csv-xlsx") {
        const XLSX = await import("xlsx");
        
        for (const file of files) {
          const text = await file.text();
          const rows = text.split("\n").map(row => row.split(","));
          
          const ws = XLSX.utils.aoa_to_sheet(rows);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
          
          const blob = XLSX.write(wb, { bookType: "xlsx", type: "array" });
          const url = URL.createObjectURL(new Blob([blob], { type: "application/octet-stream" }));
          
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name.replace(/\.csv$/i, ".xlsx");
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      
      // Excel to CSV
      else if (activeConversion === "xlsx-csv") {
        const XLSX = await import("xlsx");
        
        for (const file of files) {
          const arrayBuffer = await file.arrayBuffer();
          const data = new Uint8Array(arrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csv = XLSX.utils.sheet_to_csv(firstSheet);
          
          const blob = new Blob([csv], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name.replace(/\.xlsx?$/i, ".csv");
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      
      // ========== SERVER-SIDE CONVERSIONS ==========
      
      // Word to PDF, HTML to PDF, and all Audio/Video conversions
      else {
        const formData = new FormData();
        files.forEach(file => formData.append("files", file));
        formData.append("conversion", activeConversion);
        
        const res = await fetch("/api/convert-file", {
          method: "POST",
          body: formData,
        });
        
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          // If ffmpeg is required, show helpful message
          if (res.status === 501 && data.command) {
            throw new Error(`${data.message}\n\nTo convert locally, run:\n${data.command}\n\n${data.note}`);
          }
          throw new Error(data.error || "Conversion failed");
        }
        
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        
        // Determine extension based on conversion type
        let ext = "zip";
        if (activeConversion.includes("pdf")) ext = "pdf";
        else if (activeConversion.includes("mp3")) ext = "mp3";
        else if (activeConversion.includes("wav")) ext = "wav";
        else if (activeConversion.includes("mp4")) ext = "mp4";
        else if (activeConversion.includes("gif")) ext = "gif";
        else if (activeConversion.includes("doc")) ext = "docx";
        
        a.download = `converted.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setConverting(false);
    }
  }, [files, activeConversion, currentConversion, pdfPageRange]);

  const clearAll = useCallback(() => {
    setFiles([]);
    setError("");
  }, []);

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 select-none max-sm:pt-6 max-sm:px-3">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-1">File Converter</h1>
      <p className="text-gray-500 text-xs mb-4">Drop any file and pick an output format.</p>

      {/* Main Category Tabs */}
      <div
        className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide w-full max-w-xl"
        style={{
          backgroundColor: "rgba(20,20,24,0.48)",
          backdropFilter: "blur(14px) saturate(160%)",
          WebkitBackdropFilter: "blur(14px) saturate(160%)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 9999,
          padding: "4px 6px",
        }}
      >
        {(Object.keys(CATEGORIES) as Array<keyof typeof CATEGORIES>).map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setActiveConversion(CATEGORIES[cat].outputs[0].id);
              setFiles([]);
              setError("");
            }}
            className="flex-1 px-4 py-1.5 rounded-full text-xs font-medium outline-none whitespace-nowrap"
            style={{
              backgroundColor: "transparent",
              color: activeCategory === cat ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.85)",
              border: "1px solid " + (activeCategory === cat ? "rgba(201,168,76,0.6)" : "transparent"),
              transition: "color 160ms ease-out, border-color 160ms ease-out",
            }}
          >
            {CATEGORIES[cat].label}
          </button>
        ))}
      </div>

      {/* Output Format Buttons */}
      <div
        className="flex gap-1.5 mb-6 overflow-x-auto scrollbar-hide w-full max-w-xl"
        style={{
          backgroundColor: "rgba(20,20,24,0.48)",
          backdropFilter: "blur(14px) saturate(160%)",
          WebkitBackdropFilter: "blur(14px) saturate(160%)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 9999,
          padding: "4px 6px",
        }}
      >
        {currentCategory.outputs.map((out) => (
          <button
            key={out.id}
            onClick={() => {
              setActiveConversion(out.id);
              setError("");
              setPdfPageRange("");
              setPdfTotalPages(null);
            }}
            className="flex-1 px-4 py-1.5 rounded-full text-xs font-medium outline-none whitespace-nowrap"
            style={{
              backgroundColor: "transparent",
              color: activeConversion === out.id ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.85)",
              border: "1px solid " + (activeConversion === out.id ? "rgba(201,168,76,0.6)" : "transparent"),
              transition: "color 160ms ease-out, border-color 160ms ease-out",
            }}
          >
            {out.label}
          </button>
        ))}
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-xl max-sm:h-32 h-40 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
          dragging
            ? "border-[#C9A84C] bg-[#C9A84C]/10 scale-[1.02]"
            : "border-[#C9A84C]/40 bg-black hover:border-[#C9A84C]"
        }`}
      >
        <svg className={`w-8 h-8 transition-colors ${dragging ? "text-[#C9A84C]" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-gray-400 text-sm text-center px-4">
          {dragging ? "Drop Files Here!" : `Drop ${currentConversion.label.split(" → ")[0]} files or click to select`}
        </p>
        <input ref={inputRef} type="file" accept={currentConversion.accept.startsWith('audio/') ? `${currentConversion.accept},.mp3,.wav,.aac,.m4a,.ogg,.flac,.aiff,.aif,.wma,.opus,.mp4` : currentConversion.accept} multiple className="hidden" onChange={onFileChange} />
      </div>

      {/* Error */}
      {error && <p className="mt-4 text-red-400 text-sm text-center max-w-md">{error}</p>}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 w-full max-w-xl">
          <div className="flex justify-between items-center mb-3">
            <p className="text-gray-400 text-sm">{files.length} file(s) selected</p>
            <button onClick={clearAll} className="text-red-400 text-xs hover:text-red-300 transition-colors">Clear All</button>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {files.map((file, index) => (
              <div key={index} className="flex items-center gap-3 bg-gray-900 rounded-xl p-3">
                <span className="text-gray-500 text-xs w-6">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{file.name}</p>
                  <p className="text-gray-500 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => moveFile(index, "up")} disabled={index === 0} className="p-1 rounded hover:bg-gray-800 disabled:opacity-30 transition-colors">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button onClick={() => moveFile(index, "down")} disabled={index === files.length - 1} className="p-1 rounded hover:bg-gray-800 disabled:opacity-30 transition-colors">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <button onClick={() => removeFile(index)} className="p-1 rounded hover:bg-red-900/30 transition-colors">
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* PDF Page Range Selector */}
          {activeConversion === "pdf-to-img" && (
            <div className="mt-4 bg-gray-900 rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-gray-400 text-sm">Pages to convert</label>
                {pdfTotalPages && (
                  <span className="text-gray-500 text-xs">{pdfTotalPages} pages total</span>
                )}
              </div>
              <input
                type="text"
                value={pdfPageRange}
                onChange={(e) => setPdfPageRange(e.target.value)}
                placeholder={pdfTotalPages ? `e.g. 1-3, 5, 7 (blank = all ${pdfTotalPages})` : "e.g. 1-3, 5, 7 (blank = all)"}
                className="w-full bg-black border border-[rgba(255,255,255,0.07)] focus:border-[#C9A84C] rounded-full px-4 py-2 text-white text-sm outline-none transition-colors placeholder-gray-600"
              />
              <p className="text-gray-600 text-xs">Ranges like <span className="text-gray-400">1-5</span>, individual pages like <span className="text-gray-400">2, 4, 7</span>, or combined</p>
            </div>
          )}

          {/* Convert Button */}
          <div className={`w-full mt-6 ${converting ? "btn-sweep-wrapper" : "rounded-xl p-[3px] bg-[#C9A84C]"}`}>
            <button
              onClick={convertFiles}
              disabled={converting || files.length === 0}
              className="w-full px-6 py-4 rounded-[10px] bg-black hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all duration-200 flex items-center justify-center gap-3 outline-none"
            >
              {converting ? (
                <span className="text-[#C9A84C]">Converting...</span>
              ) : (
                <>
                  <svg className="w-5 h-5 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Convert to {currentConversion.label.split(" → ")[1] || "Output"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
