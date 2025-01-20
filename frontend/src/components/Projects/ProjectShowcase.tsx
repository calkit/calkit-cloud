import { Text, Flex, Spinner, Box } from "@chakra-ui/react"

import useProject from "../../hooks/useProject"
import FigureView from "../Figures/FigureView"

interface ProjectShowcaseProps {
  ownerName: string
  projectName: string
}

function ProjectShowcase({ ownerName, projectName }: ProjectShowcaseProps) {
  const { showcaseRequest } = useProject(ownerName, projectName, false)
  return (
    <>
      {showcaseRequest.isPending ? (
        <Flex justify="center" align="center" height="100px" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : showcaseRequest.data ? (
        <>
          {showcaseRequest.data.elements.map((item) => (
            <>
              {"figure" in item ? (
                <Box mt={2}>
                  <FigureView figure={item.figure} />
                </Box>
              ) : "text" in item ? (
                <Text mt={2}>{item.text}</Text>
              ) : (
                ""
              )}
            </>
          ))}
        </>
      ) : (
        ""
      )}
    </>
  )
}

export default ProjectShowcase
