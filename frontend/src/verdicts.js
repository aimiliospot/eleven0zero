// keys double as Badge variants (components/ui/badge.jsx)
export const VERDICTS = {
  affected: { label: "Affected" },
  likely: { label: "Likely" },
  not_affected: { label: "Not affected" },
  error: { label: "Error" },
};
export const verdictOf = (key) => (key in VERDICTS ? key : "error");
