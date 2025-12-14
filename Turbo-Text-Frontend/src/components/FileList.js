import React from "react";

const FileList = ({ files, onSelectFile, onRemoveFile, onClearAll }) => {

  if (files.length === 0) {
    return (
      <div style={{ 
        marginTop: "20px", 
        border: "2px dashed #222", 
        borderRadius: "16px", 
        padding: "40px", 
        textAlign: "center",
        color: "#444",
        background: "rgba(255,255,255,0.01)",
        animation: "fadeIn 0.5s ease"
      }}>
        <div style={{ marginBottom: "15px", opacity: 0.4 }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
        </div>
        <p style={{ fontSize: "0.95rem" }}>No files in queue. Start by adding documents.</p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "30px" }}>
      <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginBottom: "20px",
          animation: "fadeIn 0.5s ease" 
      }}>
        <h3 style={{ color: "#a3a3a3", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: "700" }}>
          Processing Queue ({files.length})
        </h3>
        <button 
            onClick={onClearAll}
            style={{
                background: "transparent", border: "none", color: "#666", fontSize: "0.85rem", cursor: "pointer", padding: "8px 12px", borderRadius: "6px", transition: "all 0.2s"
            }}
            onMouseEnter={(e) => { e.target.style.color = "#ef4444"; e.target.style.background = "rgba(239,68,68,0.1)"; }}
            onMouseLeave={(e) => { e.target.style.color = "#666"; e.target.style.background = "transparent"; }}
        >
            Clear All
        </button>
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        {files.map((file, index) => (
          <div 
            key={index} 
            style={{
              display: "flex", alignItems: "center", padding: "16px 24px",
              borderRadius: "12px", background: "#121212", border: "1px solid #2a2a2a",
              transition: "all 0.2s ease", cursor: "pointer", position: "relative", overflow: "hidden",
              /* Staggered Animation Logic using the slideUp keyframe */
              opacity: 0,
              animation: `slideUp 0.5s ease forwards ${index * 0.1}s`
            }}
            onClick={() => onSelectFile(file)}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#be123c"; e.currentTarget.style.transform = "translateX(5px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.transform = "translateX(0)"; }}
          >
            {/* File Icon */}
            <div style={{ 
              marginRight: "20px", color: "#be123c", background: "rgba(190, 18, 60, 0.1)",
              width: "44px", height: "44px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" 
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>

            {/* File Info */}
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: "600", fontSize: "1rem", marginBottom: "4px" }}>{file.name}</div>
              <div style={{ color: "#666", fontSize: "0.8rem", fontFamily: "monospace" }}>{(file.size / 1024).toFixed(2)} KB</div>
            </div>

            {/* Remove Action */}
            <button 
              onClick={(e) => { e.stopPropagation(); onRemoveFile(index); }}
              style={{ background: "transparent", border: "none", color: "#555", padding: "8px", borderRadius: "8px", cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.target.style.background = "rgba(239, 68, 68, 0.2)"; e.target.style.color = "#ef4444"; }}
              onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.color = "#555"; }}
              title="Remove File"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileList;