import { Box, Flex, Icon, Text, useColorModeValue } from "@chakra-ui/react"
import { Link, getRouteApi } from "@tanstack/react-router"
import {
  FiHome,
  FiUsers,
  FiHardDrive,
  FiBookOpen,
  FiDatabase,
  FiImage,
  FiFolder,
} from "react-icons/fi"
import { FaLaptop } from "react-icons/fa"
import { IoLibraryOutline } from "react-icons/io5"
import axios from "axios"
import { useQuery } from "@tanstack/react-query"
import { BsGear } from "react-icons/bs"

const items = [
  { icon: FiHome, title: "Project home", path: "" },
  { icon: BsGear, title: "Workflow", path: "/workflow" },
  { icon: FiDatabase, title: "Data", path: "/data" },
  { icon: FiImage, title: "Figures", path: "/figures" },
  { icon: FiBookOpen, title: "Publications", path: "/publications" },
  { icon: FiHardDrive, title: "Software", path: "/software" },
  { icon: FiUsers, title: "Collaborators", path: "/collaborators" },
  { icon: IoLibraryOutline, title: "References", path: "/references" },
  { icon: FiFolder, title: "All files", path: "/files" },
  { icon: FaLaptop, title: "Local machine", path: "/local" },
]

interface SidebarItemsProps {
  onClose?: () => void
  basePath: string
}

const SidebarItems = ({ onClose, basePath }: SidebarItemsProps) => {
  const textColor = useColorModeValue("ui.main", "ui.light")
  const bgActive = useColorModeValue("#E2E8F0", "#4A5568")
  const finalItems = items
  const routeApi = getRouteApi("/_layout/$userName/$projectName")
  const { userName, projectName } = routeApi.useParams()
  const {
    isPending: localServerPending,
    error: localServerError,
    data: localServerData,
  } = useQuery({
    queryKey: ["local-server-sidebar"],
    queryFn: () =>
      axios.get(`http://localhost:8866/projects/${userName}/${projectName}`),
    retry: false,
  })
  const localMachineColor =
    localServerError || localServerPending || !localServerData
      ? "gray"
      : "ui.success"

  const listItems = finalItems.map(({ icon, title, path }) => (
    <Flex
      as={Link}
      to={basePath + path}
      w="100%"
      p={2}
      key={title}
      activeOptions={{ exact: true }}
      activeProps={{
        style: {
          background: bgActive,
          borderRadius: "12px",
        },
      }}
      color={textColor}
      onClick={onClose}
    >
      <Icon
        as={icon}
        color={title === "Local machine" ? localMachineColor : "default"}
        alignSelf="center"
      />
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
