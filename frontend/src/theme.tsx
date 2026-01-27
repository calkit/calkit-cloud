import { extendTheme } from "@chakra-ui/react"

const disabledStyles = {
  _disabled: {
    backgroundColor: "ui.main",
  },
}

const theme = extendTheme({
  config: {
    initialColorMode: "dark",
    useSystemColorMode: true,
  },
  colors: {
    ui: {
      main: "#009688",
      secondary: "#EDF2F7",
      success: "#48BB78",
      danger: "#E53E3E",
      light: "#FAFAFA",
      dark: "#0a0e13",
      darkSlate: "#10141a",
      dim: "#A0AEC0",
    },
  },
  styles: {
    global: (props: any) => ({
      body: {
        // fontSize: "14px", // Slightly smaller default font size
        bg: props.colorMode === "dark" ? "ui.dark" : "white",
      },
    }),
  },
  components: {
    Button: {
      variants: {
        primary: {
          backgroundColor: "ui.main",
          color: "ui.light",
          _hover: {
            backgroundColor: "#00766C",
          },
          _disabled: {
            ...disabledStyles,
            _hover: {
              ...disabledStyles,
            },
          },
        },
        danger: {
          backgroundColor: "ui.danger",
          color: "ui.light",
          _hover: {
            backgroundColor: "#E32727",
          },
        },
      },
    },
    Link: {
      variants: {
        blue: ({ colorScheme = "blue" }) => ({
          color: `${colorScheme}.500`,
          _hover: {
            color: `${colorScheme}.400`,
          },
        }),
      },
    },
    Tabs: {
      variants: {
        enclosed: {
          tab: {
            _selected: {
              color: "ui.main",
            },
          },
        },
      },
    },
    Modal: {
      baseStyle: (props: any) => ({
        dialog: {
          bg: props.colorMode === "dark" ? "#161b22" : "white",
        },
        overlay: {
          bg: "blackAlpha.600",
        },
      }),
    },
    Card: {
      baseStyle: (props: any) => ({
        container: {
          bg: props.colorMode === "dark" ? "#161b22" : "white",
        },
      }),
    },
    Menu: {
      baseStyle: (props: any) => ({
        list: {
          bg: props.colorMode === "dark" ? "#161b22" : "white",
          borderColor: props.colorMode === "dark" ? "gray.700" : "gray.200",
        },
        item: {
          bg: props.colorMode === "dark" ? "#161b22" : "white",
          _hover: {
            bg: props.colorMode === "dark" ? "#0d1117" : "gray.100",
          },
        },
      }),
    },
    Popover: {
      baseStyle: (props: any) => ({
        content: {
          bg: props.colorMode === "dark" ? "#161b22" : "white",
          borderColor: props.colorMode === "dark" ? "gray.700" : "gray.200",
        },
      }),
    },
  },
})

export default theme
