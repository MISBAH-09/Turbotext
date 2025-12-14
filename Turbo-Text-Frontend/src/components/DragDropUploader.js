import React, { useState, useRef } from "react";
import { isValidFile } from "../utils/fileValidation";

const DragDropUploader = ({ onFilesAdded }) => {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const processFiles = (files) => {
    const valid = [];
    let invalidFound = false;

    files.forEach((file) => {
      if (isValidFile(file)) {
        valid.push(file);
      } else {
        invalidFound = true;
      }
    });

    if (invalidFound) {
      setError("Invalid file type! Only .txt, .doc, .docx are allowed.");
      setTimeout(() => setError(""), 3000);
    }

    if (valid.length > 0) onFilesAdded(valid);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
      e.dataTransfer.clearData();
    }
  };

  const handleBrowseFiles = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      style={{
        border: dragging ? "2px dashed #be123c" : "2px dashed #333",
        background: dragging ? "rgba(190, 18, 60, 0.08)" : "#121212",
        borderRadius: "16px",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        height: "100%",
        minHeight: "320px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Decorative Background Icon */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: dragging ? 0.1 : 0.03,
        pointerEvents: 'none',
        transition: 'opacity 0.3s'
      }}>
         <svg width="200" height="200" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>
      </div>

      {/* Main Icon */}
      <div style={{ 
          marginBottom: "24px", 
          color: dragging ? '#be123c' : '#fff',
          transform: dragging ? 'scale(1.1)' : 'scale(1)',
          transition: 'all 0.3s'
      }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      </div>

      <h3 style={{ 
          color: "#fff", 
          marginBottom: "12px", 
          fontSize: "1.5rem", 
          fontWeight: "700",
          letterSpacing: "-0.5px"
      }}>
        {dragging ? "Drop Files Here" : "Upload Documents"}
      </h3>
      
      <p style={{ color: "#a3a3a3", fontSize: "1rem", maxWidth: "280px", textAlign: 'center', lineHeight: '1.5' }}>
        Drag & drop your files, or <span style={{ color: '#be123c', fontWeight: '600' }}>browse</span> from your computer.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".txt,.doc,.docx"
         onChange={handleBrowseFiles}
        style={{ display: "none" }}
      />
      {error && (
        <p
          style={{
            color: "#ff4d4f",
            fontSize: "14px",
            marginTop: "10px",
            textAlign: "center",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default DragDropUploader;