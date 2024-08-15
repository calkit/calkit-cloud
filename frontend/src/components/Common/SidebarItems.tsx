import { Box, Flex, Icon, Text, useColorModeValue } from "@chakra-ui/react"
import { Link } from "@tanstack/react-router"
import { FiBriefcase, FiHome, FiSettings, FiUsers } from "react-icons/fi"

const items = [
  { icon: FiHome, title: "Project home", path: "" },
  { icon: FiBriefcase, title: "Questions", path: "/questions" },
  { icon: FiSettings, title: "Software", path: "/software" },
  { icon: FiUsers, title: "Collaborators", path: "/collaborators" },
]

interface SidebarItemsProps {
  onClose?: () => void
  basePath: string
}

const SidebarItems = ({ onClose, basePath }: SidebarItemsProps) => {
  const textColor = useColorModeValue("ui.main", "ui.light")
  const bgActive = useColorModeValue("#E2E8F0", "#4A5568")

  const finalItems = items

  const listItems = finalItems.map(({ icon, title, path }) => (
    <Flex
      as={Link}
      to={basePath + path}
      w="100%"
      p={2}
      key={title}
      activeProps={{
        style: {
          background: bgActive,
          borderRadius: "12px",
        },
      }}
      color={textColor}
      onClick={onClose}
    >
      <Icon as={icon} alignSelf="center" />
      <Text ml={2}>{title}</Text>
    </Flex>
  ))

  return (
    <>
      <Box>{listItems}</Box>
    </>
  )
}

export default SidebarItems
