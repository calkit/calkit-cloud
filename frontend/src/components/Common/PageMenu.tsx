import { Box, useColorModeValue } from "@chakra-ui/react"

interface PageMenuProps {
  children: React.ReactNode
}

const PageMenu = ({ children }: PageMenuProps) => {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  return (
    <Box>
      <Box
        minW="200px"
        maxW="300px"
        maxH={"100%"}
        overflowY="auto"
        overflowX="auto"
        p={2}
        mr={6}
        mt={0}
        borderRadius="lg"
        bg={secBgColor}
        borderWidth={0}
      >
        {children}
      </Box>
    </Box>
  )
}

export default PageMenu
