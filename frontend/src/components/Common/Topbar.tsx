import {
  Box,
  Flex,
  HStack,
  IconButton,
  useDisclosure,
  useColorModeValue,
  Image,
  Stack,
  Link,
} from "@chakra-ui/react"
import { Link as RouterLink } from "@tanstack/react-router"
import { HamburgerIcon, CloseIcon } from "@chakra-ui/icons"
import UserMenu from "./UserMenu"

interface Props {
  children: React.ReactNode
}

const Links = ["Projects", "Data", "Software", "Figures"]
const LinkRoutes = {
  Projects: "/",
  Data: "/data",
  Software: "/software",
  Figures: "/figures",
}

const NavLink = (props: Props) => {
  const { children } = props

  return (
    <Box
      as={RouterLink}
      px={2}
      py={1}
      rounded={"md"}
      _hover={{
        textDecoration: "none",
        bg: useColorModeValue("gray.200", "gray.700"),
      }}
      to={LinkRoutes[children?.toString()]}
    >
      {children}
    </Box>
  )
}

export default function Topbar() {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const secBgColor = useColorModeValue("ui.secondary", "ui.darkSlate")

  return (
    <>
      <Box bg={secBgColor} px={4}>
        <Flex h={16} alignItems={"center"} justifyContent={"space-between"}>
          <IconButton
            size={"md"}
            icon={isOpen ? <CloseIcon /> : <HamburgerIcon />}
            aria-label={"Open Menu"}
            display={{ md: "none" }}
            onClick={isOpen ? onClose : onOpen}
          />
          <HStack spacing={8} alignItems={"center"}>
            <Box px={8}>
              <Link as={RouterLink} to="/">
                <Image
                  width={20}
                  src="/assets/images/calkit.svg"
                  alt="Calkit logo"
                />
              </Link>
            </Box>
            <HStack
              as={"nav"}
              spacing={4}
              display={{ base: "none", md: "flex" }}
            >
              {Links.map((link) => (
                <NavLink key={link}>{link}</NavLink>
              ))}
            </HStack>
          </HStack>
          <Flex alignItems={"center"}>
            <UserMenu />
          </Flex>
        </Flex>
        {isOpen ? (
          <Box pb={4} display={{ md: "none" }}>
            <Stack as={"nav"} spacing={4}>
              {Links.map((link) => (
                <NavLink key={link}>{link}</NavLink>
              ))}
            </Stack>
          </Box>
        ) : null}
      </Box>
    </>
  )
}
