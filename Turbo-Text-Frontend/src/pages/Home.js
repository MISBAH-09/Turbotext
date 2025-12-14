import React, { useState } from 'react';
import DragDropUploader from '../components/DragDropUploader';
import FileUploader from '../components/FileUploader';
import OCRUploader from '../components/OCRUploader';
import FileList from '../components/FileList';
import AnalyzeButton from '../components/AnalyzeButton';
import DocumentViewer from './DocumentViewer';
import Logo from '../components/Logo';
import Typewriter from 'typewriter-effect'; // Import Typewriter
import AnalysisResults from '../components/AnalysisResults';
import { analyzeFiles } from '../services/analyzeService';
import IssueEditor from '../components/IssueEditor';

const Home = () => {
  const [files, setFiles] = useState([]);
  const [viewerFile, setViewerFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [contentByName, setContentByName] = useState({});
  const [editorTarget, setEditorTarget] = useState(null);

  const handleFilesSelected = (newFiles) => {
    const uniqueFiles = newFiles.filter(nf => !files.some(f => f.name === nf.name));
    setFiles((prev) => [...prev, ...uniqueFiles]);
  };

  const handleSelectFile = (file) => setViewerFile(file);
  const handleRemoveFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index));
  
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

  const handleOpenEditor = (fileResult) => {
    const existing = contentByName[fileResult.id];
    if (existing) {
      setEditorTarget({ ...fileResult, content: existing });
      return;
    }
    if (fileResult.content) {
      setContentByName((prev) => ({ ...prev, [fileResult.id]: fileResult.content }));
      setEditorTarget({ ...fileResult, content: fileResult.content });
      return;
    }
    const match = files.find((f) => f.name === fileResult.id && f.type === "text/plain");
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

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <Logo className={`logo ${isAnalyzing ? 'processing' : ''}`} />
        </div>
        <div className="tagline" style={{ display: 'flex', justifyContent: 'center', gap: '0.5ch' }}>
          <span>Write</span>
          <Typewriter
            options={{
              strings: [
                "Correctly",
                "Clearly",
                "Effortlessly",
                "in Parallel"
              ],
              autoStart: true,
              loop: true,
              delay: 50,
              deleteSpeed: 30,
            }}
          />
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="upload-grid">
        <div className="hero-section" style={{ animation: 'slideUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}>
           <DragDropUploader onFilesAdded={handleFilesSelected} />
        </div>

        <div className="tools-section" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ animationDelay: '0.1s' }}>
             <div className="card-header">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Standard Upload
             </div>
             <FileUploader onFilesSelected={handleFilesSelected} />
          </div>

          <div className="card" style={{ animationDelay: '0.2s' }}>
             <div className="card-header">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                OCR Extraction
             </div>
             <OCRUploader onOCRFileReady={(ocrFile) => setFiles((prev) => [...prev, ocrFile])} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px', animation: 'fadeIn 1s ease 0.5s backwards' }}>
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

      {analysisError && (
        <div
          style={{
            marginTop: "20px",
            padding: "14px 16px",
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#fecdd3",
            borderRadius: "12px",
            fontWeight: 600,
          }}
        >
          {analysisError}
        </div>
      )}

      {analysisResult && (
        <AnalysisResults
          result={analysisResult}
          onReset={() => setAnalysisResult(null)}
          onOpenEditor={handleOpenEditor}
        />
      )}

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
