import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { X, Maximize, Minimize, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Upload, FileText } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════
   PDF READER — liseuse de session
   Affiche le PDF attaché à la session (pdfData base64 ou pdfUrl).
   Utilise pdfjs-dist pour un rendu canvas cohérent sur tous navigateurs.
══════════════════════════════════════════════════════════════════ */

let pdfjsLib = null;
async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import('pdfjs-dist');
  mod.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${mod.version}/build/pdf.worker.min.js`;
  pdfjsLib = mod;
  return mod;
}

export default function SessionPlayer({ data: dataProp, update }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: dataStore, update: storeUpdate } = useStore();
  const data = dataProp || dataStore;
  const doUpdate = update || storeUpdate;
  const session = data.sessions?.find(s => s.id === id);

  const containerRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* ── Load PDF from session data (base64) or pdfUrl ─────────── */
  useEffect(() => {
    const hasPdfData = !!session?.pdfData;
    const hasPdfUrl = !!session?.pdfUrl;
    if (!hasPdfData && !hasPdfUrl) { setPdfDoc(null); return; }

    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        let doc;

        if (hasPdfData) {
          // base64 data URL → binary
          const raw = atob(session.pdfData.split(',')[1]);
          const bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
          doc = await pdfjs.getDocument({ data: bytes }).promise;
        } else {
          // Load from URL (public folder)
          doc = await pdfjs.getDocument(session.pdfUrl).promise;
        }

        if (!cancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setPage(1);
        }
      } catch (e) {
        if (!cancelled) setError('Impossible de charger le PDF.');
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session?.pdfData, session?.pdfUrl]);

  /* ── Render current page to canvas ──────────────────────────── */
  useEffect(() => {
    if (!pdfDoc || !canvasContainerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const pg = await pdfDoc.getPage(page);
        const viewport = pg.getViewport({ scale });

        // Reuse or create canvas
        let canvas = canvasContainerRef.current.querySelector('canvas');
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvasContainerRef.current.appendChild(canvas);
        }
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        await pg.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        if (!cancelled) console.error('Render error', e);
      }
    })();

    return () => { cancelled = true; };
  }, [pdfDoc, page, scale]);

  /* ── Keyboard shortcuts ─────────────────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setPage(p => Math.min(p + 1, totalPages));
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setPage(p => Math.max(p - 1, 1));
      }
      if (e.key === '+' || e.key === '=') setScale(s => Math.min(s + 0.25, 4));
      if (e.key === '-') setScale(s => Math.max(s - 0.25, 0.5));
      if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen();
        else navigate(-1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [totalPages, navigate]);

  /* ── Fullscreen tracking ────────────────────────────────────── */
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen();
  };

  /* ── Upload PDF to session ──────────────────────────────────── */
  const handleUpload = useCallback((file) => {
    if (!file || !file.type.includes('pdf')) return;
    if (file.size > 15 * 1024 * 1024) {
      setError('Le fichier est trop volumineux (max 15 Mo).');
      return;
    }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      doUpdate(prev => ({
        ...prev,
        sessions: prev.sessions.map(s =>
          s.id === id ? { ...s, pdfData: e.target.result } : s
        ),
      }));
      setLoading(false);
    };
    reader.onerror = () => { setError('Erreur de lecture.'); setLoading(false); };
    reader.readAsDataURL(file);
  }, [id, doUpdate]);

  /* ── Session not found ──────────────────────────────────────── */
  if (!session) {
    return (
      <div className="min-h-screen bg-happi-teal flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-lg mb-4">Session introuvable</p>
          <button onClick={() => navigate('/sessions')} className="underline opacity-70 hover:opacity-100">
            Retour aux sessions
          </button>
        </div>
      </div>
    );
  }

  /* ── No PDF → upload prompt ─────────────────────────────────── */
  if (!session.pdfData && !session.pdfUrl) {
    return (
      <div className="min-h-screen bg-happi-teal flex items-center justify-center text-white">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 rounded-3xl bg-happi-teal-light flex items-center justify-center mx-auto mb-6">
            <FileText size={36} className="text-happi-teal-muted" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{session.nom}</h2>
          <p className="text-happi-teal-muted text-sm mb-8">
            Aucun document PDF n'est rattaché à cette session.<br />
            Importez un fichier pour commencer la lecture.
          </p>
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-happi-orange text-white font-semibold hover:bg-happi-orange-dark transition-colors shadow-orange"
          >
            <Upload size={18} /> Importer un PDF
          </button>
          <div className="mt-4">
            <button onClick={() => navigate(-1)} className="text-sm text-happi-teal-muted hover:text-white underline">
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── PDF Viewer ─────────────────────────────────────────────── */
  return (
    <div ref={containerRef} className="h-screen flex flex-col bg-happi-teal text-white select-none">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-happi-teal-light border-b border-white/5 flex-shrink-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-happi-teal-mid text-happi-teal-muted hover:text-white transition-colors"
          title="Fermer"
        >
          <X size={18} />
        </button>

        <h1 className="text-sm font-medium text-white/80 truncate flex-1 ml-1">
          {session.nom}
        </h1>

        {/* Page navigation */}
        <div className="flex items-center gap-1 bg-happi-teal/50 rounded-lg px-1">
          <button
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            disabled={page <= 1}
            className="p-1.5 rounded hover:bg-happi-teal-mid disabled:opacity-20 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs text-happi-teal-muted tabular-nums min-w-[4rem] text-center">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages}
            className="p-1.5 rounded hover:bg-happi-teal-mid disabled:opacity-20 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-happi-teal/50 rounded-lg px-1">
          <button
            onClick={() => setScale(s => Math.max(s - 0.25, 0.5))}
            className="p-1.5 rounded hover:bg-happi-teal-mid transition-colors"
            title="Zoom arrière"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-happi-teal-muted tabular-nums min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(s => Math.min(s + 0.25, 4))}
            className="p-1.5 rounded hover:bg-happi-teal-mid transition-colors"
            title="Zoom avant"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="p-2 rounded-lg hover:bg-happi-teal-mid text-happi-teal-muted hover:text-white transition-colors"
          title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>

        {/* Replace PDF */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-lg hover:bg-happi-teal-mid text-happi-teal-muted hover:text-white transition-colors"
          title="Changer le PDF"
        >
          <Upload size={18} />
        </button>
      </div>

      {/* ── Canvas area ── */}
      <div className="flex-1 overflow-auto flex justify-center bg-happi-teal">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-happi-teal-muted border-t-happi-orange rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full text-red-400 text-sm">
            {error}
          </div>
        )}
        <div
          ref={canvasContainerRef}
          className="py-6"
          style={{ display: loading || error ? 'none' : 'block' }}
        />
      </div>
    </div>
  );
}
