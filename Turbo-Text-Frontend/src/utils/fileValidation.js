export const allowedExtensions = ["txt", "doc", "docx", "pdf"];

export const isValidFile = (file) => {
  const ext = file.name.split(".").pop().toLowerCase();
  return allowedExtensions.includes(ext);
};
