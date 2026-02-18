const DEFAULT_SELLERS_URL = "https://adwmg.com/sellers.json";
const CUSTOM_URL_KEY = "custom_sellers_url";

function getBrandName(url) {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const secondLast = parts[parts.length - 2];
      if (parts.length > 2 && (secondLast === "co" || secondLast === "com") && last.length === 2) {
        return parts[parts.length - 3];
      }
      return secondLast;
    }
    return parts[0] || "adwmg";
  } catch {
    return "adwmg";
  }
}

function cleanDomain(input) {
  if (!input) return "";
  let d = input.toLowerCase().trim();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.replace(/\.+/g, "."); 
  d = d.split(/[/?#\s,;=:]/)[0];
  return d;
}