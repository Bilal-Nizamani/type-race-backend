function cleanString(inputString) {
  // Replace multiple spaces with a single space
  let cleanedString = inputString.replace(/\s+/g, " ");
  // Remove leading and trailing spaces
  cleanedString = cleanedString.trim();
  return cleanedString;
}

export { cleanString };
