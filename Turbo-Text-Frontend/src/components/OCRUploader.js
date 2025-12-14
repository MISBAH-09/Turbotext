import React, { useState } from "react";
import Tesseract from "tesseract.js";

const OCRUploader = ({ onOCRFileReady }) => {
  const [loading, setLoading] = useState(false);

  const handleImageUpload = async (e) => {
    const image = e.target.files[0];
    if (!image) return;

    setLoading(true);

    try {
        const { data: { text } } = await Tesseract.recognize(image, "eng", {
        });

        const ocrFile = new File(
        [text],
        `${image.name}-ocr.txt`,
        { type: "text/plain" }
        );

        onOCRFileReady(ocrFile);
    } catch (err) {
        console.error(err);
        alert("Failed to extract text from image.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div>
      <label className="file-input-label" style={{ 
          borderColor: loading ? '#be123c' : '#333', 
          color: loading ? '#be123c' : 'inherit' 
      }}>
         {loading ? "Processing Image..." : "Select Image"}
         <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageUpload} 
            disabled={loading}
         />
      </label>
    </div>
  );
};

export default OCRUploader;