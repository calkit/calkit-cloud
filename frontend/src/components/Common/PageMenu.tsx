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
      h="fit-content"
      maxH={"100%"}
      overflowX="auto"
      overflowY="auto"
      px={3}
      py={2}
      mr={6}
      mt={0}
      borderRadius="lg"
      bg={secBgColor}
      borderWidth={0}
      boxSizing="border-box"
    >
      {children}
    </Box>
  )
}

export default PageMenu
