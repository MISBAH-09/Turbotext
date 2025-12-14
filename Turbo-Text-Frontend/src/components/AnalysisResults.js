import React, { useEffect, useState } from "react";

const formatPct = (value) => `${value.toFixed(2)}%`;

const AnalysisResults = ({ result, onReset, onOpenEditor }) => {
  const files = result?.files || [];
  const [open, setOpen] = useState(new Set());

  useEffect(() => {
    setOpen(new Set(files.map((f) => f.id)));
  }, [files]);

  if (!files.length) return null;

  const filesWithStats = files.map((file) => {
    const stats = file.stats || {};
    const wordCount = stats.word_count || 0;
    const spellingIssues =
      stats.spelling_issues ??
      (file.issues ? file.issues.filter((i) => i.type === "spelling").length : 0);
    const grammarIssues =
      stats.grammar_issues ??
      (file.issues ? file.issues.filter((i) => i.type === "grammar").length : 0);
    const totalIssues = spellingIssues + grammarIssues;
    const spellingPct = wordCount ? (spellingIssues / wordCount) * 100 : 0;
    const grammarPct = wordCount ? (grammarIssues / wordCount) * 100 : 0;
    const overallAccuracy = wordCount ? Math.max(0, 100 - (totalIssues / wordCount) * 100) : 100;
    return {
      ...file,
      stats: {
        ...stats,
        wordCount,
        spellingIssues,
        grammarIssues,
        spellingPct,
        grammarPct,
        overallAccuracy,
      },
    };
  });

  const downloadAllReports = () => {
    const header =
      "filename,word_count,spelling_issues,grammar_issues,spelling_pct,grammar_pct,overall_accuracy\n";
    const rows = filesWithStats
      .map((f) =>
        [
          f.id,
          f.stats.wordCount,
          f.stats.spellingIssues,
          f.stats.grammarIssues,
          f.stats.spellingPct.toFixed(2),
          f.stats.grammarPct.toFixed(2),
          f.stats.overallAccuracy.toFixed(2),
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "turbo-text-report.csv";
    link.click();
  };

  const downloadSingleReport = (file) => {
    const { stats } = file;
    const lines = [
      `File: ${file.id}`,
      `Word count: ${stats.wordCount}`,
      `Spelling issues: ${stats.spellingIssues} (${formatPct(stats.spellingPct)})`,
      `Grammar issues: ${stats.grammarIssues} (${formatPct(stats.grammarPct)})`,
      `Overall accuracy: ${formatPct(stats.overallAccuracy)}`,
      "",
      "Issues:",
    ];
    const issues = file.issues || [];
    if (issues.length === 0) {
      lines.push("  None");
    } else {
      issues.forEach((issue, idx) => {
        const suggestions = issue.suggestions?.length ? ` Suggestions: ${issue.suggestions.join(", ")}` : "";
        lines.push(`  ${idx + 1}. [${issue.type}] ${issue.message} (${issue.original})${suggestions}`);
      });
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${file.id.replace(/[^a-z0-9-_\\.]/gi, "_")}_report.txt`;
    link.click();
  };

  const toggle = (id) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div
      style={{
        marginTop: "30px",
        padding: "28px",
        background: "#0d0d0d",
        border: "1px solid #222",
        borderRadius: "14px",
        boxShadow: "0 15px 40px rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "18px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#9f1239",
              fontWeight: 700,
              letterSpacing: "1px",
              fontSize: "0.75rem",
              textTransform: "uppercase",
            }}
          >
            Analysis Complete
          </div>
          <div style={{ color: "#e5e5e5", fontSize: "1rem" }}>
            {filesWithStats.length} file{filesWithStats.length === 1 ? "" : "s"} processed
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            onClick={downloadAllReports}
            style={buttonStyle}
            onMouseEnter={(e) => hoverButton(e, true)}
            onMouseLeave={(e) => hoverButton(e, false)}
          >
            Download all reports
          </button>
          {onReset && (
            <button
              onClick={onReset}
              style={buttonStyle}
              onMouseEnter={(e) => hoverButton(e, true)}
              onMouseLeave={(e) => hoverButton(e, false)}
            >
              Clear Results
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gap: "14px" }}>
        {filesWithStats.map((file, idx) => {
          const spellingCount = file.stats?.spellingIssues || 0;
          const grammarCount = file.stats?.grammarIssues || 0;
          const hasIssues = spellingCount + grammarCount > 0;
          const isOpen = open.has(file.id);

          return (
            <div
              key={`${file.id}-${idx}`}
              style={{
                border: "1px solid #1f1f1f",
                borderRadius: "12px",
                padding: "18px 20px",
                background: "#111",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
                  onClick={() => toggle(file.id)}
                >
                  <Arrow open={isOpen} />
                  <div style={{ color: "#fff", fontWeight: 600 }}>{file.id}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <Badge color="#be123c" label="Spelling" count={spellingCount} />
                  <Badge color="#7c3aed" label="Grammar" count={grammarCount} />
                  <Metric value={file.stats.spellingPct} label="Spelling %" color="#be123c" />
                  <Metric value={file.stats.grammarPct} label="Grammar %" color="#7c3aed" />
                  <Metric value={file.stats.overallAccuracy} label="Accuracy" color="#22c55e" />
                  <StatusPill ok={!hasIssues} />
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => downloadSingleReport(file)}
                      style={{ ...miniButtonStyle, borderColor: "#2a2a2a" }}
                      onMouseEnter={(e) => hoverMiniButton(e, true)}
                      onMouseLeave={(e) => hoverMiniButton(e, false)}
                    >
                      Download report
                    </button>
                    {onOpenEditor && (
                      <button
                        onClick={() => onOpenEditor(file)}
                        style={{ ...miniButtonStyle, borderColor: "#2a2a2a" }}
                        onMouseEnter={(e) => hoverMiniButton(e, true)}
                        onMouseLeave={(e) => hoverMiniButton(e, false)}
                      >
                        Open in editor
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {isOpen && (
                file.error ? (
                  <div style={{ color: "#fca5a5", fontSize: "0.95rem" }}>{file.error}</div>
                ) : hasIssues ? (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {file.issues
                      ?.filter((issue) => issue.type === "spelling")
                      .map((issue, i) => (
                        <IssueRow
                          key={`spell-${i}`}
                          color="#be123c"
                          label="Spelling"
                          text={issue.original}
                          message={issue.message}
                          suggestions={issue.suggestions}
                        />
                      ))}
                    {file.issues
                      ?.filter((issue) => issue.type === "grammar")
                      .map((issue, i) => (
                        <IssueRow
                          key={`gram-${i}`}
                          color="#7c3aed"
                          label="Grammar"
                          text={issue.message}
                          suggestions={issue.suggestions}
                        />
                      ))}
                  </div>
                ) : (
                  <div style={{ color: "#7c7c7c", fontSize: "0.95rem" }}>No issues detected.</div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const buttonStyle = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "1px solid #2a2a2a",
  background: "#161616",
  color: "#e5e5e5",
  cursor: "pointer",
  fontWeight: 600,
  transition: "all 0.2s ease",
};

const miniButtonStyle = {
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #2a2a2a",
  background: "#161616",
  color: "#e5e5e5",
  cursor: "pointer",
  fontWeight: 600,
  transition: "all 0.2s ease",
};

const hoverButton = (e, active) => {
  e.currentTarget.style.borderColor = active ? "#be123c" : "#2a2a2a";
  e.currentTarget.style.color = active ? "#fff" : "#e5e5e5";
};

const hoverMiniButton = (e, active) => {
  e.currentTarget.style.borderColor = active ? "#444" : "#2a2a2a";
  e.currentTarget.style.color = active ? "#fff" : "#e5e5e5";
};

const Badge = ({ color, label, count }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 10px",
      borderRadius: "999px",
      background: `${color}22`,
      color: color,
      fontWeight: 700,
      fontSize: "0.85rem",
      border: `1px solid ${color}55`,
    }}
  >
    <span>{label}</span>
    <span
      style={{
        background: color,
        color: "#fff",
        borderRadius: "10px",
        padding: "2px 8px",
        fontSize: "0.8rem",
      }}
    >
      {count}
    </span>
  </div>
);

const Metric = ({ value, label, color }) => (
  <div
    style={{
      display: "inline-flex",
      flexDirection: "column",
      padding: "6px 10px",
      borderRadius: "10px",
      background: "#151515",
      border: "1px solid #242424",
      minWidth: "90px",
    }}
  >
    <span style={{ color: "#8d8d8d", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
      {label}
    </span>
    <span style={{ color, fontWeight: 700 }}>{formatPct(value)}</span>
  </div>
);

const StatusPill = ({ ok }) => (
  <div
    style={{
      padding: "6px 10px",
      borderRadius: "999px",
      background: ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
      color: ok ? "#22c55e" : "#ef4444",
      fontWeight: 700,
      fontSize: "0.82rem",
      border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
    }}
  >
    {ok ? "Clean" : "Issues Found"}
  </div>
);

const IssueRow = ({ color, label, text, message, suggestions }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 12px",
      borderRadius: "10px",
      background: "#161616",
      border: "1px solid #202020",
    }}
  >
    <div
      style={{
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 0 4px ${color}22`,
      }}
    />
    <div style={{ flex: 1 }}>
      <div style={{ color: "#d4d4d4", fontWeight: 600, marginBottom: "2px" }}>
        {label}: {text}
      </div>
      {message && (
        <div style={{ color: "#8d8d8d", fontSize: "0.9rem", marginBottom: "2px" }}>{message}</div>
      )}
      {suggestions && suggestions.length > 0 && (
        <div style={{ color: "#8d8d8d", fontSize: "0.9rem" }}>
          Suggestions: <span style={{ color: "#e5e5e5" }}>{suggestions.join(", ")}</span>
        </div>
      )}
    </div>
  </div>
);

const Arrow = ({ open }) => (
  <div
    style={{
      width: "12px",
      height: "12px",
      borderLeft: "2px solid #888",
      borderBottom: "2px solid #888",
      transform: open ? "rotate(45deg)" : "rotate(-45deg)",
      transition: "transform 0.2s ease",
      marginRight: "4px",
    }}
  />
);

export default AnalysisResults;
