import { Text, Flex, Spinner, Box, Code } from "@chakra-ui/react"

import LoadingSpinner from "../Common/LoadingSpinner"
import useProject from "../../hooks/useProject"
import FigureView from "../Figures/FigureView"
import PublicationView from "../Publications/PublicationView"
import Markdown from "../Common/Markdown"
import NotebookView from "../Notebooks/NotebookView"

interface ProjectShowcaseProps {
  ownerName: string
  projectName: string
}

function ProjectShowcase({ ownerName, projectName }: ProjectShowcaseProps) {
  const { showcaseRequest } = useProject(ownerName, projectName)
  return (
    <>
      {showcaseRequest.isPending ? (
        <LoadingSpinner height="100px" />
      ) : showcaseRequest.data ? (
        <>
          {showcaseRequest.data.elements.map((item) => (
            <>
              {"figure" in item ? (
                <Box mt={2}>
                  <FigureView figure={item.figure} />
                </Box>
              ) : "publication" in item ? (
                <Box mt={2} height="600px">
                  <PublicationView publication={item.publication} />
                </Box>
              ) : "text" in item ? (
                <Text mt={2}>{item.text}</Text>
              ) : "markdown" in item ? (
                <Markdown>{item.markdown}</Markdown>
              ) : "yaml" in item ? (
                <Code whiteSpace="pre" width="100%" overflow="auto" p={2}>
                  {item.yaml}
                </Code>
              ) : "notebook" in item ? (
                <Box mt={2} height="600px">
                  <NotebookView notebook={item.notebook} />
                </Box>
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
