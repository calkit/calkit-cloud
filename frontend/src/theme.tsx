import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

// Fresh theme built on Chakra v3 defaults with a teal-forward palette.
const brandConfig = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#e0f7f4" },
          100: { value: "#b2ebe2" },
          200: { value: "#7cd9cc" },
          300: { value: "#4fc8b8" },
          400: { value: "#2cb5a4" },
          500: { value: "#009688" },
          600: { value: "#00766c" },
          700: { value: "#00564f" },
          800: { value: "#003631" },
          900: { value: "#001713" },
        },
        danger: {
          500: { value: "#e53e3e" },
          600: { value: "#c53030" },
        },
      },
    },
    semanticTokens: {
      colors: {
        ui: {
          main: { value: "{colors.brand.500}" },
          secondary: { value: "#EDF2F7" },
          success: { value: "#48BB78" },
          danger: { value: "{colors.danger.500}" },
          light: { value: "#FAFAFA" },
          dark: { value: "#1A202C" },
          darkSlate: { value: "#252D3D" },
          dim: { value: "#A0AEC0" },
        },
      },
    },
  },
})

const system = createSystem(defaultConfig, brandConfig)

export default system
