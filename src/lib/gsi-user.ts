export const getStoredGsiUsername = () => {
  if (typeof window === "undefined") return "";
  return (localStorage.getItem("gsi.username") || "").trim();
};
