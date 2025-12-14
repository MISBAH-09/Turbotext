import React, { useEffect, useRef } from "react";
import { renderAsync } from "docx-preview";

const DocumentViewer = ({ file, onClose }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!file) return;

    const fileType = file.name.split(".").pop().toLowerCase();

    if (fileType === "docx") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (containerRef.current) {
            containerRef.current.innerHTML = "";
            await renderAsync(e.target.result, containerRef.current);
        }
      };
      reader.readAsArrayBuffer(file);
    }

    if (fileType === "txt") {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (containerRef.current) {
            containerRef.current.innerHTML = `<pre style="white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 15px; color: #222; line-height: 1.6;">${e.target.result}</pre>`;
        }
      };
      reader.readAsText(file);
    }
  }, [file]);

  return (
    <div style={styles.overlay}>
      {/* Header Bar */}
      <div style={styles.header}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '15px' }}>
             <div style={{ background: '#be123c', padding: '6px', borderRadius: '6px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
             </div>
             <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: '500' }}>{file.name}</h2>
        </div>
        <button 
            style={styles.closeBtn} 
            onClick={onClose}
            onMouseEnter={(e) => { e.target.style.background = "#be123c"; e.target.style.color = "white"; }}
            onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.color = "#be123c"; }}
        >
            Close Viewer
        </button>
      </div>

      {/* Document Container */}
      <div style={styles.docWrapper}>
        <div ref={containerRef} style={styles.document}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#888' }}>
                <div className="spinner" style={{ borderColor: '#ddd', borderTopColor: '#555' }}></div>
                Loading content...
            </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;

const styles = {
  overlay: {
    position: "fixed",
    top: 0, left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(5, 5, 5, 0.95)",
    backdropFilter: "blur(8px)",
    overflowY: "auto",
    zIndex: 9999,
  },
  header: {
    height: "80px",
    background: "#121212",
    borderBottom: "1px solid #2a2a2a",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 40px",
    position: "sticky",
    top: 0,
    zIndex: 10000,
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)"
  },
  closeBtn: {
    padding: "10px 24px",
    borderRadius: "8px",
    border: "1px solid #be123c",
    backgroundColor: "transparent",
    color: "#be123c",
    cursor: "pointer",
    fontWeight: "600",
    transition: "all 0.2s ease",
    fontSize: "0.9rem"
  },
  docWrapper: {
    display: "flex",
    justifyContent: "center",
    padding: "60px 20px",
    minHeight: "calc(100vh - 80px)",
  },
  document: {
    width: "100%",
    maxWidth: "900px",
    minHeight: "1100px",
    background: "#ffffff",
    padding: "80px",
    boxShadow: "0 0 60px rgba(0,0,0,0.8)",
    color: "#000",
    borderRadius: "2px"
  }
};