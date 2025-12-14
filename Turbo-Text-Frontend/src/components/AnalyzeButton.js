import React from "react";

const AnalyzeButton = ({ disabled, loading, onClick }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        position: 'relative',
        padding: "18px 60px",
        background: disabled 
            ? "#1f1f1f" 
            : "linear-gradient(135deg, #e35c3a 0%, #f17145 100%)",
        color: disabled ? "#555" : "#ffffff",
        border: "none",
        borderRadius: "12px",
        cursor: (disabled || loading) ? "not-allowed" : "pointer",
        fontSize: "1.05rem",
        fontWeight: "700",
        letterSpacing: "1px",
        textTransform: "uppercase",
        boxShadow: disabled ? "none" : "0 4px 25px rgba(227, 92, 58, 0.32)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        minWidth: "260px",
        overflow: "hidden"
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
            e.target.style.transform = "translateY(-3px) scale(1.02)";
            e.target.style.boxShadow = "0 8px 35px rgba(227, 92, 58, 0.48)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
            e.target.style.transform = "translateY(0) scale(1)";
            e.target.style.boxShadow = "0 4px 25px rgba(227, 92, 58, 0.32)";
        }
      }}
    >
      {loading ? (
        <>
          <div className="spinner"></div>
          <span>Processing...</span>
        </>
      ) : (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          {disabled ? "Add Files to Start" : "Initialize Analysis"}
        </>
      )}
    </button>
  );
};

export default AnalyzeButton;
