import React, { useState } from "react";
import FileUploader from "../components/FileUploader";
import OCRUploader from "../components/OCRUploader";
import FileList from "../components/FileList";
import AnalyzeButton from "../components/AnalyzeButton";
import DocumentViewer from "./DocumentViewer";
import DragDropUploader from "../components/DragDropUploader";
import Typewriter from "typewriter-effect";
import AnalysisResults from "../components/AnalysisResults";
import { analyzeFiles, fetchFileContent } from "../services/analyzeService";
import IssueEditor from "../components/IssueEditor";

const quickHighlights = [
  { title: "Documents", subtitle: "DOCX, TXT", icon: "📄" }, // PDF Removed
  { title: "OCR", subtitle: "JPG, PNG", icon: "🔍" },
  { title: "Parallel", subtitle: "Multiple files", icon: "⚡" },
];

const featureCards = [
  {
    title: "Smart OCR",
    body: "Extract text from images with high accuracy using advanced optical character recognition.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        <path d="M8 12h5" />
        <path d="M8 16h3" />
      </svg>
    ),
  },
  {
    title: "Grammar Check",
    body: "Catch grammatical errors, punctuation issues, and sentence structure problems instantly.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 4h18" />
        <path d="M5 8h14" />
        <path d="M7 12h10" />
        <path d="M9 16h6" />
      </svg>
    ),
  },
  {
    title: "Parallel Processing",
    body: "Analyze multiple files simultaneously for maximum efficiency and speed.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4h6v6H4z" />
        <path d="M14 4h6v6h-6z" />
        <path d="M4 14h6v6H4z" />
        <path d="M14 14h6v6h-6z" />
      </svg>
    ),
  },
  {
    title: "Secure & Private",
    body: "Your documents are processed securely and never stored on our servers.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 11V8a6 6 0 0 1 12 0v3" />
        <rect x="4" y="11" width="16" height="10" rx="2" />
      </svg>
    ),
  },
  {
    title: "Detailed Reports",
    body: "Get comprehensive analysis with actionable suggestions for improvement.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M5 3h14v18H5z" />
        <path d="M9 7h6" />
        <path d="M9 12h6" />
        <path d="M9 17h3" />
      </svg>
    ),
  },
  {
    title: "Instant Results",
    body: "Get analysis results in seconds with our optimized processing engine.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v4" />
        <path d="M12 18v4" />
        <path d="M4.93 4.93 7.76 7.76" />
        <path d="M16.24 16.24l2.83 2.83" />
        <path d="M2 12h4" />
        <path d="M18 12h4" />
        <path d="M4.93 19.07 7.76 16.24" />
        <path d="M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
];

const Home = () => {
  const [files, setFiles] = useState([]);
  const [viewerFile, setViewerFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [contentByName, setContentByName] = useState({});
  const [editorTarget, setEditorTarget] = useState(null);

  const handleFilesSelected = (newFiles) => {
    const uniqueFiles = newFiles.filter(
      (nf) => !files.some((f) => f.name === nf.name)
    );
    setFiles((prev) => [...prev, ...uniqueFiles]);
  };

  const handleSelectFile = (file) => setViewerFile(file);
  const handleRemoveFile = (index) =>
    setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleClearAll = () => {
    if (files.length > 0 && window.confirm("Clear all files from the queue?")) {
      setFiles([]);
      setAnalysisResult(null);
      setAnalysisError("");
      setEditorTarget(null);
    }
  };

  const handleAnalyze = async () => {
    if (files.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisError("");
    setAnalysisResult(null);
    try {
      const result = await analyzeFiles(files);
      setAnalysisResult(result);
    } catch (err) {
      setAnalysisError(err.message || "Failed to analyze files.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOpenEditor = async (fileResult) => {
    const existing = contentByName[fileResult.id];
    if (existing) {
      setEditorTarget({ ...fileResult, content: existing });
      return;
    }
    if (fileResult.content) {
      setContentByName((prev) => ({
        ...prev,
        [fileResult.id]: fileResult.content,
      }));
      setEditorTarget({ ...fileResult, content: fileResult.content });
      return;
    }
    if (fileResult.content_id) {
      try {
        const payload = await fetchFileContent(fileResult.content_id);
        const text = payload.content || "";
        setContentByName((prev) => ({ ...prev, [fileResult.id]: text }));
        setEditorTarget({ ...fileResult, content: text });
        return;
      } catch (err) {
        console.error(err);
        setAnalysisError(err.message || "Failed to load file content.");
      }
    }
    const match = files.find(
      (f) => f.name === fileResult.id && f.type === "text/plain"
    );
    if (match) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        setContentByName((prev) => ({ ...prev, [fileResult.id]: text }));
        setEditorTarget({ ...fileResult, content: text });
      };
      reader.readAsText(match);
    } else {
      setEditorTarget(fileResult);
    }
  };

  const scrollToSection = (id) => {
    const section = document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="page-shell">
      <header className="top-nav">
        <div className="brand">
          <span className="brand-name">TurboTxt</span>
        </div>
        <div className="nav-actions">
          <button
            className="nav-btn"
            onClick={() => scrollToSection("features")}
          >
            Features
          </button>
          <button
            className="nav-btn primary"
            onClick={() => scrollToSection("analyze")}
          >
            Analyze
          </button>
        </div>
      </header>

      <main className="content-shell">
        <section className="hero" id="hero">
          <p className="hero-kicker">Upload DOCX files or images.</p> {/* PDF Removed */}
          <h1 className="hero-title">
            Instant{" "}
            <span className="typewriter-word">
              <Typewriter
                options={{
                  strings: ["OCR", "Spell Check", "Grammar Check"],
                  autoStart: true,
                  loop: true,
                  delay: 60,
                  deleteSpeed: 45,
                  cursor: "|",
                }}
              />
            </span>
            <br />
            for your documents
          </h1>
          <p className="hero-subtext">
            Upload DOCX files or images. Get instant spell checking, {/* PDF Removed */}
            grammar analysis, and OCR extraction.
          </p>
          <div className="hero-actions">
            <button
              className="primary-btn"
              onClick={() => scrollToSection("analyze")}
            >
              Start Analyzing
              <span aria-hidden="true" className="chevron-icon">
                →
              </span>
            </button>
          </div>
          <div className="pill-row">
            {quickHighlights.map((item) => (
              <div className="pill-card" key={item.title}>
                <div className="pill-icon" aria-hidden="true">
                  {item.icon}
                </div>
                <div>
                  <div className="pill-title">{item.title}</div>
                  <div className="pill-sub">{item.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="upload-section" id="analyze">
          <div className="section-heading">
            <h2>
              Upload & <span>Analyze</span>
            </h2>
            <p>
              Drop your files below and let TurboTxt analyze them in parallel.
            </p>
          </div>

          <div className="upload-card-grid">
            <div className="upload-card">
              <div className="upload-icon doc" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                  <path d="M14 3v6h6" />
                </svg>
              </div>
              <h3>Documents</h3>
              <p className="upload-desc">DOCX, TXT</p> {/* PDF Removed */}
              <DragDropUploader onFilesAdded={handleFilesSelected} />
            </div>

            <div className="upload-card">
              <div className="upload-icon img" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="M21 15l-4-4a1 1 0 0 0-1.6.2L11 18" />
                </svg>
              </div>
              <h3>Images</h3>
              <p className="upload-desc">JPG, PNG for OCR</p>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '320px', width: '100%' }}>
                 <OCRUploader
                  onOCRFileReady={(ocrFile) =>
                    setFiles((prev) => [...prev, ocrFile])
                  }
                />
              </div>
            </div>
          </div>

          <div className="analyze-action">
            <AnalyzeButton
              disabled={files.length === 0}
              loading={isAnalyzing}
              onClick={handleAnalyze}
            />
          </div>

          <FileList
            files={files}
            onSelectFile={handleSelectFile}
            onRemoveFile={handleRemoveFile}
            onClearAll={handleClearAll}
          />

          {analysisError && <div className="inline-error">{analysisError}</div>}

          {analysisResult && (
            <AnalysisResults
              result={analysisResult}
              onReset={() => setAnalysisResult(null)}
              onOpenEditor={handleOpenEditor}
            />
          )}
        </section>

        <section className="features-section" id="features">
          <h2>
            Powerful <span>Features</span>
          </h2>
          <p className="section-subtext">
            Everything you need to perfect your text, all in one place.
          </p>
          <div className="feature-grid">
            {featureCards.map((card, index) => (
              <div 
                className="feature-card" 
                key={card.title}
                style={{ 
                  opacity: 0, 
                  animation: `slideUp 0.6s ease-out forwards ${index * 0.1}s`
                }}
              >
                <div className="feature-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer" style={{ display: 'block', paddingTop: '60px', paddingBottom: '40px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '40px', 
          maxWidth: '1100px', 
          margin: '0 auto', 
          paddingBottom: '40px',
          borderBottom: '1px solid #222'
        }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <span className="brand-name" style={{ fontSize: '1.4rem' }}>TurboTxt</span>
            <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: '1.6' }}>
              The fastest way to analyze, correct, and digitize your documents securely in the cloud.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ color: '#fff', fontSize: '0.95rem' }}>Product</h4>
            <a href="#features" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem' }}>Features</a>
            <a href="#analyze" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem' }}>OCR Analysis</a>
            <a href="#" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem' }}>Pricing</a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ color: '#fff', fontSize: '0.95rem' }}>Legal</h4>
            <a href="#" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem' }}>Privacy Policy</a>
            <a href="#" style={{ color: '#888', textDecoration: 'none', fontSize: '0.9rem' }}>Terms of Service</a>
          </div>
        </div>

        <div style={{ 
          textAlign: 'center', 
          paddingTop: '30px', 
          color: '#444', 
          fontSize: '0.85rem' 
        }}>
          © 2025 TurboTxt Inc. All rights reserved.
        </div>
      </footer>

      {viewerFile && (
        <DocumentViewer file={viewerFile} onClose={() => setViewerFile(null)} />
      )}

      {editorTarget && (
        <IssueEditor
          fileId={editorTarget.id}
          issues={editorTarget.issues}
          content={editorTarget.content || contentByName[editorTarget.id]}
          onClose={() => setEditorTarget(null)}
        />
      )}
    </div>
  );
};

export default Home;