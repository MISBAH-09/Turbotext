const API_BASE_URL =
  (process.env.REACT_APP_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export const analyzeFiles = async (files) => {
  if (!files || files.length === 0) {
    throw new Error("No files provided for analysis.");
  }

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${API_BASE_URL}/analyze-files?include_content=false`, {
    method: "POST",
    body: formData,
  });

  const isJson = response.headers
    .get("content-type")
    ?.toLowerCase()
    .includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const detail = typeof payload === "string" ? payload : payload?.detail;
    throw new Error(detail || "Analysis request failed.");
  }

  if (!payload || !payload.files) {
    throw new Error("Unexpected response from analysis service.");
  }

  return payload;
};

export const fetchFileContent = async (contentId) => {
  if (!contentId) {
    throw new Error("Missing content id.");
  }

  const response = await fetch(`${API_BASE_URL}/file-content/${encodeURIComponent(contentId)}`);
  const isJson = response.headers
    .get("content-type")
    ?.toLowerCase()
    .includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const detail = typeof payload === "string" ? payload : payload?.detail;
    throw new Error(detail || "Unable to fetch file content.");
  }

  if (!payload || typeof payload.content !== "string") {
    throw new Error("Unexpected response when loading file content.");
  }

  return payload;
};
