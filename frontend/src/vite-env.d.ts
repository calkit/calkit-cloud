/// <reference types="vite/client" />

declare module "pptx-preview" {
  export interface PptxPreviewer {
    preview(data: ArrayBuffer): void
  }
  export function init(
    element: HTMLElement,
    options?: { width?: number; height?: number },
  ): PptxPreviewer
}
