import {
  Box,
  Heading,
  Spinner,
  Flex,
  Text,
  Code,
  Badge,
  SimpleGrid,
  Card,
  Menu,
  MenuButton,
  Icon,
  MenuList,
  MenuItem,
  Button,
  useDisclosure,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { FaPlus } from "react-icons/fa"

import { ProjectsService } from "../../../../../client"

export const Route = createFileRoute(
  "/_layout/$userName/$projectName/_layout/data",
)({
  component: ProjectData,
})

function ProjectDataView() {
  const { userName, projectName } = Route.useParams()
  const { isPending: dataPending, data: datasets } = useQuery({
    queryKey: ["projects", userName, projectName, "datasets"],
    queryFn: () =>
      ProjectsService.getProjectData({
        ownerName: userName,
        projectName: projectName,
      }),
  })
  const uploadDataModal = useDisclosure()
  const labelDataModal = useDisclosure()

  return (
    <>
      <Flex align={"center"} mb={2}>
        <Heading size="md">Datasets</Heading>
        <Menu>
          <MenuButton>
            <Button height={"25px"} width={"9px"} px={0.5} ml={2}>
              <Icon as={FaPlus} fontSize={"xs"} />
            </Button>
          </MenuButton>
          <MenuList>
            <MenuItem onClick={uploadDataModal.onOpen}>
              Upload new dataset
            </MenuItem>
            <MenuItem onClick={labelDataModal.onOpen}>
              Label existing file or folder as dataset
            </MenuItem>
          </MenuList>
        </Menu>
      </Flex>
      {dataPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <Box>
          <SimpleGrid columns={[3, null, 4]} gap={6}>
            {datasets?.map((dataset) => (
              <Card key={dataset.path} p={6} variant="elevated">
                <Heading size={"sm"} mb={2}>
                  <Code p={1}>
                    {dataset.path}
                    {dataset.imported_from ? (
                      <Badge ml={1} bgColor="green.500">
                        imported
                      </Badge>
                    ) : (
                      ""
                    )}
                  </Code>
                </Heading>
                {dataset.title ? (
                  <Text mb={1}>
                    <strong>Title:</strong> {dataset.title}
                  </Text>
                ) : (
                  ""
                )}
                {dataset.description ? (
                  <Text>
                    <strong>Description:</strong> {dataset.description}
                  </Text>
                ) : (
                  ""
                )}
              </Card>
            ))}
          </SimpleGrid>
        </Box>
      )}
    </>
  )
}

function ProjectData() {
  return <ProjectDataView />
}
