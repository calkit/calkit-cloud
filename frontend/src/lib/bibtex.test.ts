import { describe, expect, it } from "vitest"

import { cleanLatex } from "./bibtex"

describe("cleanLatex", () => {
  it("removes protective braces", () => {
    expect(cleanLatex("The {DNS} of {Turbulence}")).toBe(
      "The DNS of Turbulence",
    )
  })

  it("converts accent macros in brace form", () => {
    expect(cleanLatex('Schr{\\"o}dinger')).toBe("Schrödinger")
    expect(cleanLatex("Poincar{\\'e}")).toBe("Poincaré")
  })

  it("converts accent macros in bare form", () => {
    expect(cleanLatex('Schr\\"odinger')).toBe("Schrödinger")
  })

  it("keeps content of formatting wrappers", () => {
    expect(cleanLatex("A \\textbf{bold} idea")).toBe("A bold idea")
    expect(cleanLatex("An \\emph{emphasis}")).toBe("An emphasis")
  })

  it("unescapes punctuation", () => {
    expect(cleanLatex("Cats \\& Dogs")).toBe("Cats & Dogs")
    expect(cleanLatex("50\\% off")).toBe("50% off")
  })

  it("converts dashes", () => {
    expect(cleanLatex("pp. 10--20")).toBe("pp. 10–20")
    expect(cleanLatex("a---b")).toBe("a—b")
  })

  it("collapses whitespace and trims", () => {
    expect(cleanLatex("  too   many   spaces ")).toBe("too many spaces")
  })

  it("leaves plain text untouched", () => {
    expect(cleanLatex("Reynolds number")).toBe("Reynolds number")
  })
})
