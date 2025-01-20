import { Text, Flex, Spinner } from "@chakra-ui/react"

import useProject from "../../hooks/useProject"

interface ProjectShowcaseProps {
  ownerName: string
  projectName: string
}

function ProjectShowcase({ ownerName, projectName }: ProjectShowcaseProps) {
  const { showcaseRequest } = useProject(ownerName, projectName, false)
  return (
    <>
      {showcaseRequest.isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : showcaseRequest.data ? (
        <Text>Got some data</Text>
      ) : (
        ""
      )}
    </>
  )
}

export default ProjectShowcase
