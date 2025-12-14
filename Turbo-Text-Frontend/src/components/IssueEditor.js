import React, { useEffect, useMemo, useRef, useState } from "react";

const IssueEditor = ({ fileId, issues, content, onClose }) => {
  const [draft, setDraft] = useState(content || "");
  const [issueState, setIssueState] = useState([]);
  const draftRef = useRef("");

  useEffect(() => {
    setDraft(content || "");
    const mapped = (issues || []).map((issue, idx) => ({
      ...issue,
      localId: `${fileId || "file"}-${idx}`,
      status: "pending",
    }));
    setIssueState(mapped);
  }, [fileId, content, issues]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const hasContent = !!draft;
  const pendingIssues = issueState.filter((i) => i.status !== "applied");
  const appliedCount = issueState.length - pendingIssues.length;

  const activeIssues = useMemo(() => {
    return pendingIssues
      .filter((i) => typeof i.position?.start === "number" && typeof i.position?.end === "number")
      .sort((a, b) => a.position.start - b.position.start);
  }, [pendingIssues]);

  const applyReplacementPure = (text, currentIssues, issueId, replacement) => {
    const idx = currentIssues.findIndex((i) => i.localId === issueId && i.status !== "applied");
    if (idx === -1 || !replacement?.length) {
      return { text, issues: currentIssues };
    }
    const target = currentIssues[idx];
    const start = Math.max(0, Math.min(target.position.start, text.length));
    const end = Math.max(start, Math.min(target.position.end, text.length));
    const before = text.slice(0, start);
    const after = text.slice(end);
    const nextText = `${before}${replacement}${after}`;
    const delta = replacement.length - (end - start);

    const nextIssues = currentIssues.map((issue, i) => {
      if (i === idx) {
        return {
          ...issue,
          status: "applied",
          replacement,
          position: { ...issue.position, end: start + replacement.length },
        };
      }
      if (issue.status === "applied") return issue;
      if (issue.position?.start >= end) {
        return {
          ...issue,
          position: {
            ...issue.position,
            start: issue.position.start + delta,
            end: issue.position.end + delta,
          },
        };
      }
      return issue;
    });

    return { text: nextText, issues: nextIssues };
  };

  const applySuggestion = (issueId, replacement) => {
    setIssueState((current) => {
      const { text, issues: nextIssues } = applyReplacementPure(
        draftRef.current,
        current,
        issueId,
        replacement
      );
      if (text !== draftRef.current) {
        setDraft(text);
      }
      return nextIssues;
    });
  };

  const applyAll = () => {
    let nextText = draft;
    let nextIssues = issueState;
    const sequence = issueState
      .filter((i) => i.status !== "applied" && i.suggestions && i.suggestions.length > 0)
      .sort((a, b) => a.position.start - b.position.start);

    for (const issue of sequence) {
      const replacement = issue.suggestions[0];
      const applied = applyReplacementPure(nextText, nextIssues, issue.localId, replacement);
      nextText = applied.text;
      nextIssues = applied.issues;
    }
    setDraft(nextText);
    setIssueState(nextIssues);
  };

  const resetDraft = () => {
    setDraft(content || "");
    const resetIssues = (issues || []).map((issue, idx) => ({
      ...issue,
      localId: `${fileId || "file"}-${idx}`,
      status: "pending",
    }));
    setIssueState(resetIssues);
  };

  const downloadCorrected = () => {
    const payload = draft || content || "";
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    const safeName = (fileId || "corrected").replace(/[^a-z0-9-_.]/gi, "_");
    link.href = URL.createObjectURL(blob);
    link.download = `${safeName.replace(/\\.\\w+$/, "")}_corrected.txt`;
    link.click();
  };

  const segments = useMemo(() => {
    if (!hasContent) {
      return [{ text: "No preview available for this file.", type: "none" }];
    }
    if (!activeIssues.length) {
      return [{ text: draft, type: "plain" }];
    }

    const parts = [];
    let cursor = 0;
    for (const issue of activeIssues) {
      const start = Math.max(cursor, Math.min(issue.position.start, draft.length));
      const end = Math.max(start, Math.min(issue.position.end, draft.length));
      if (start > cursor) {
        parts.push({ text: draft.slice(cursor, start), type: "plain" });
      }
      parts.push({ text: draft.slice(start, end), type: issue.type, issue });
      cursor = end;
    }
    if (cursor < draft.length) {
      parts.push({ text: draft.slice(cursor), type: "plain" });
    }
    return parts;
  }, [draft, activeIssues, hasContent]);

  if (!fileId) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <div>
            <div style={{ color: "#9f1239", fontSize: "0.75rem", letterSpacing: "1px" }}>Inline Corrections</div>
            <div style={{ fontWeight: 700 }}>{fileId}</div>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button style={styles.secondary} onClick={resetDraft}>Reset</button>
            <button style={styles.secondary} onClick={applyAll} disabled={!pendingIssues.length}>
              Apply all
            </button>
            <button style={styles.secondary} onClick={downloadCorrected} disabled={!hasContent}>
              Download corrected (.txt)
            </button>
            <button style={styles.close} onClick={onClose}>Close</button>
          </div>
        </div>

        <div style={styles.subHeader}>
          <Legend color="#be123c" label="Spelling" />
          <Legend color="#7c3aed" label="Grammar" />
          <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
            {pendingIssues.length} suggestion{pendingIssues.length === 1 ? "" : "s"} pending
            {appliedCount > 0 ? `, ${appliedCount} applied` : ""}
          </div>
        </div>

        <div style={styles.body}>
          <div style={styles.editor}>
            {segments.map((seg, idx) => {
              if (seg.type === "plain" || seg.type === "none") {
                return <span key={idx}>{seg.text}</span>;
              }
              const bg = seg.type === "spelling" ? "rgba(190,18,60,0.18)" : "rgba(124,58,237,0.18)";
              const border = seg.type === "spelling" ? "#be123c" : "#7c3aed";
              const title = seg.issue
                ? `${seg.issue.message || "Issue"}${seg.issue.suggestions?.length ? " | " + seg.issue.suggestions.join(", ") : ""}`
                : "";
              return (
                <span
                  key={idx}
                  title={title}
                  style={{
                    background: bg,
                    borderBottom: `2px dashed ${border}`,
                    cursor: "help",
                    padding: "0 1px",
                  }}
                  onClick={() => seg.issue?.suggestions?.length && applySuggestion(seg.issue.localId, seg.issue.suggestions[0])}
                >
                  {seg.text}
                </span>
              );
            })}
          </div>

          <div style={styles.sidebar}>
            <div style={{ color: "#f5f5f5", fontWeight: 700, marginBottom: "12px" }}>Suggestions</div>
            {pendingIssues.length === 0 && (
              <div style={{ color: "#9ca3af" }}>All caught up. Nothing to fix.</div>
            )}
            <div style={{ display: "grid", gap: "10px" }}>
              {pendingIssues.map((issue, idx) => (
                <div key={issue.localId || idx} style={styles.suggestion}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Badge label={issue.type === "spelling" ? "Spelling" : "Grammar"} type={issue.type} />
                    <button
                      style={styles.microButton}
                      disabled={!issue.suggestions || issue.suggestions.length === 0}
                      onClick={() => applySuggestion(issue.localId, issue.suggestions?.[0])}
                    >
                      Apply
                    </button>
                  </div>
                  <div style={{ color: "#e5e5e5", fontWeight: 600, marginTop: "4px" }}>
                    {issue.original || issue.message}
                  </div>
                  {issue.message && <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>{issue.message}</div>}
                  {issue.suggestions && issue.suggestions.length > 0 && (
                    <div style={{ color: "#9ca3af", fontSize: "0.9rem", marginTop: "4px" }}>
                      Suggestions:{" "}
                      <span style={{ color: "#f5f5f5" }}>
                        {issue.suggestions.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {!hasContent && (
          <div style={styles.notice}>
            Preview not available for this file type. Original formatting remains unchanged.
          </div>
        )}
      </div>
    </div>
  );
};

const Legend = ({ color, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    <div style={{ width: "14px", height: "14px", borderRadius: "3px", background: color, opacity: 0.6 }} />
    <span style={{ color: "#ccc", fontSize: "0.9rem" }}>{label}</span>
  </div>
);

const Badge = ({ label, type }) => {
  const color = type === "spelling" ? "#be123c" : "#7c3aed";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 8px",
        borderRadius: "10px",
        background: `${color}22`,
        color,
        fontWeight: 700,
        fontSize: "0.8rem",
        border: `1px solid ${color}55`,
      }}
    >
      {label}
    </div>
  );
};

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    backdropFilter: "blur(6px)",
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  panel: {
    width: "min(1200px, 96vw)",
    height: "85vh",
    background: "#0d0d0d",
    border: "1px solid #1f1f1f",
    borderRadius: "14px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid #1f1f1f",
    gap: "12px",
    flexWrap: "wrap",
  },
  subHeader: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px 20px",
    borderBottom: "1px solid #1f1f1f",
  },
  body: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "14px",
    padding: "14px 16px",
    minHeight: 0,
  },
  editor: {
    background: "#0f0f0f",
    color: "#e5e5e5",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    lineHeight: 1.6,
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    borderRadius: "12px",
    border: "1px solid #1f1f1f",
    padding: "16px 18px",
  },
  sidebar: {
    background: "#101010",
    border: "1px solid #1f1f1f",
    borderRadius: "12px",
    padding: "14px 16px",
    overflow: "auto",
  },
  suggestion: {
    border: "1px solid #1f1f1f",
    borderRadius: "10px",
    padding: "10px 12px",
    background: "#141414",
  },
  notice: {
    padding: "12px 16px",
    color: "#fcd34d",
    fontSize: "0.95rem",
    borderTop: "1px solid #1f1f1f",
  },
  close: {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1px solid #2a2a2a",
    background: "#161616",
    color: "#f5f5f5",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondary: {
    padding: "8px 14px",
    borderRadius: "8px",
    border: "1px solid #2a2a2a",
    background: "#0f0f0f",
    color: "#f5f5f5",
    cursor: "pointer",
    fontWeight: 600,
  },
  microButton: {
    padding: "6px 10px",
    borderRadius: "8px",
    border: "1px solid #2a2a2a",
    background: "#161616",
    color: "#f5f5f5",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.85rem",
  },
};

export default IssueEditor;
