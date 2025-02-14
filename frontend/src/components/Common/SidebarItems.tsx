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
import { SiJupyter } from "react-icons/si"
import { MdOutlineDashboard } from "react-icons/md"
import useAuth from "../../hooks/useAuth"
import { TiFlowMerge } from "react-icons/ti"
import { FaCubes } from "react-icons/fa"

const items = [
  { icon: FiHome, title: "Project home", path: "" },
  { icon: MdOutlineDashboard, title: "App", path: "/app" },
  { icon: TiFlowMerge, title: "Pipeline", path: "/pipeline" },
  { icon: FaCubes, title: "Environments", path: "/environments" },
  { icon: FiDatabase, title: "Datasets", path: "/datasets" },
  { icon: FiImage, title: "Figures", path: "/figures" },
  { icon: FiBookOpen, title: "Publications", path: "/publications" },
  { icon: SiJupyter, title: "Notebooks", path: "/notebooks" },
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
  const itemsRequireLogin = ["Collaborators", "Local machine"]
  const { user } = useAuth()
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
    <>
      {itemsRequireLogin.includes(title) && !user ? (
        ""
      ) : (
        <>
          <Flex
            as={Link}
            to={basePath + path}
            w="100%"
            p={2}
            key={title}
            activeOptions={{ exact: true, includeSearch: false }}
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
        </>
      )}
    </>
  ))

  return (
    <>
      <Box>{listItems}</Box>
    </>
  )
}

export default SidebarItems
