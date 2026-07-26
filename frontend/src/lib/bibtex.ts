// Helpers for displaying BibTeX field values, which carry LaTeX markup that
// should not be shown raw (protective braces, accent macros, dashes).

// Accent and symbol macros mapped to their Unicode equivalents. Keys are the
// macro body as it appears after a backslash, e.g. `"o` for \"o (o-umlaut).
const LATEX_REPLACEMENTS: Record<string, string> = {
  '"a': "ä",
  '"o': "ö",
  '"u': "ü",
  '"A': "Ä",
  '"O': "Ö",
  '"U': "Ü",
  "'a": "á",
  "'e": "é",
  "'i": "í",
  "'o": "ó",
  "'u": "ú",
  "'n": "ń",
  "'c": "ć",
  "`a": "à",
  "`e": "è",
  "`i": "ì",
  "`o": "ò",
  "`u": "ù",
  "^a": "â",
  "^e": "ê",
  "^i": "î",
  "^o": "ô",
  "^u": "û",
  "~n": "ñ",
  "~a": "ã",
  "~o": "õ",
  "c c": "ç",
  "c C": "Ç",
  ss: "ß",
  o: "ø",
  O: "Ø",
  aa: "å",
  AA: "Å",
  ae: "æ",
  AE: "Æ",
}

// Convert a BibTeX/LaTeX field value into plain text suitable for display.
export const cleanLatex = (input: string): string => {
  let out = input
  // Accent and symbol macros in either brace form: {\"o} or \"o or \ss.
  for (const [macro, replacement] of Object.entries(LATEX_REPLACEMENTS)) {
    const body = macro.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    // Word macros like \ss or \o need a boundary so \other isn't matched;
    // symbol accents like \"o apply to the next letter, which follows directly.
    const boundary = /^[a-zA-Z]/.test(macro) ? "(?![a-zA-Z])" : ""
    out = out.replace(
      new RegExp(`\\{\\\\${body}\\}|\\\\${body}${boundary}`, "g"),
      replacement,
    )
    out = out.replace(new RegExp(`\\\\${body}\\{\\}`, "g"), replacement)
  }
  // Text-formatting wrappers: keep the content, drop the command.
  out = out.replace(
    /\\(?:textbf|textit|textsc|emph|texttt|mathrm|mathit|text)\{([^{}]*)\}/g,
    "$1",
  )
  // Escaped punctuation: \&, \%, \_, \#, \$.
  out = out.replace(/\\([&%_#$])/g, "$1")
  // Dashes and non-breaking spaces.
  out = out.replace(/---/g, "—").replace(/--/g, "–").replace(/~/g, " ")
  // Any remaining protective braces.
  out = out.replace(/[{}]/g, "")
  // Collapse whitespace left behind.
  return out.replace(/\s+/g, " ").trim()
}
