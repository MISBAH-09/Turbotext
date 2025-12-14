export const allowedExtensions = ["txt", "doc", "docx"];

export const isValidFile = (file) => {
  const ext = file.name.split(".").pop().toLowerCase();
  return allowedExtensions.includes(ext);
};
