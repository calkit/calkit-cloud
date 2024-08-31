import {
  Flex,
  Box,
  Heading,
  Icon,
  Text,
  Link,
  useColorModeValue,
  Menu,
  MenuButton,
  Button,
  MenuList,
  MenuItem,
  useDisclosure,
} from "@chakra-ui/react"
import { createFileRoute } from "@tanstack/react-router"
import { FiFile } from "react-icons/fi"
import { FaPlus } from "react-icons/fa"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/publications",
)({
  component: Publications,
})

function Publications() {
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")
  const uploadPubModal = useDisclosure()
  const labelPubModal = useDisclosure()

  return (
    <Flex>
      {/* A nav bar at the left with a heading, upload menu and list of pubs */}
      <Box
        minW={"200px"}
        bg={secBgColor}
        borderRadius={"lg"}
        px={3}
        py={2}
        mr={4}
      >
        <Flex align={"center"} mb={1}>
          <Heading size={"md"}>Publications</Heading>
          <Menu>
            <MenuButton>
              <Button height={"25px"} width={"9px"} px={0.5} ml={2}>
                <Icon as={FaPlus} fontSize={"xs"} />
              </Button>
            </MenuButton>
            <MenuList>
              <MenuItem onClick={uploadPubModal.onOpen}>
                Upload new publication
              </MenuItem>
              <MenuItem onClick={labelPubModal.onOpen}>
                Label existing file as publication
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>
        {/* Iterate over all publications to create an anchor link for each */}
        <Link>
          <Text>
            <Icon pt={1} as={FiFile} /> This is the name
          </Text>
        </Link>
      </Box>
      {/* A box to the right that iterates over all figures, adding a view for
      the content, info, and comments */}
      <Box width={"100%"}>
        <Flex>
          <Box width={"66%"}>This is the publication content view</Box>

          <Box width={"33%"}>
            <Box>This is the info view</Box>
            <Box>This is the publication comments view</Box>
          </Box>
        </Flex>
      </Box>
    </Flex>
  )
}
