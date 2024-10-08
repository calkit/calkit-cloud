import { Box, useColorModeValue } from "@chakra-ui/react"

interface PageMenuProps {
  children: React.ReactNode
}

const PageMenu = ({ children }: PageMenuProps) => {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  return (
    <Box
      minW="200px"
      maxW="300px"
      overflowY="auto"
      p={2}
      mr={6}
      mt={0}
      borderRadius="lg"
      bg={secBgColor}
      borderWidth={0}
      position="sticky"
      top={55}
    >
      {children}
    </Box>
  )
}

export default PageMenu
