import { useState } from "react";
import React from "react";
import { isValidFile } from "../utils/fileValidation";


const FileUploader = ({ onFilesSelected }) => {
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const selectedFiles = Array.from(e.target.files);
    const validFiles = [];
    let invalidFound = false;

    selectedFiles.forEach((file) => {
      if (isValidFile(file)) {
        validFiles.push(file);
      } else {
        invalidFound = true;
      }
    });

    if (invalidFound) {
      setError("Invalid file type! Only .txt, .doc, .docx, .pdf are allowed.");
      setTimeout(() => setError(""), 3000);
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  return (
    <div>
      <label className="file-input-label">
         Browse Files
         <input 
            type="file" 
            multiple 
            accept=".txt,.doc,.docx,.pdf"
            onChange={handleFileChange}
         />
      </label>

      {error && (
        <p style={{ color: "#ff4d4f", marginTop: "8px", fontSize: "14px" }}>
          {error}
        </p>
      )}
    </div>
  );
};

export default FileUploader;
