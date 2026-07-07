import { Box, Button, Code, Icon, Text } from "@chakra-ui/react"
import { MdEdit } from "react-icons/md"

import useProject from "../../hooks/useProject"
import LoadingSpinner from "../Common/LoadingSpinner"
import Markdown from "../Common/Markdown"
import FigureView from "../Figures/FigureView"
import NotebookView from "../Notebooks/NotebookView"
import PublicationView from "../Publications/PublicationView"

interface ProjectShowcaseProps {
  ownerName: string
  projectName: string
  gitRef?: string
  // Provided (with write access, on the live view) to let members open a
  // publication's LaTeX source in the in-browser editor.
  onEditLatex?: (texPath: string, deps?: string[] | null) => void
}

function ProjectShowcase({
  ownerName,
  projectName,
  gitRef,
  onEditLatex,
}: ProjectShowcaseProps) {
  const { showcaseRequest } = useProject(ownerName, projectName, gitRef)
  return (
    <>
      {showcaseRequest.isPending ? (
        <LoadingSpinner height="100px" />
      ) : showcaseRequest.data ? (
        <>
          {showcaseRequest.data.elements.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <Box mt={3} key={index}>
              {"figure" in item ? (
                <FigureView figure={item.figure} />
              ) : "publication" in item ? (
                <Box height="600px" position="relative">
                  {onEditLatex ? (
                    <Button
                      size="xs"
                      position="absolute"
                      top={1}
                      right={1}
                      zIndex={1}
                      onClick={() =>
                        onEditLatex(
                          item.publication.path.replace(/\.[^/.]+$/, ".tex"),
                          item.publication.stage_info?.deps,
                        )
                      }
                    >
                      <Icon as={MdEdit} mr={1} />
                      Edit LaTeX
                    </Button>
                  ) : null}
                  <PublicationView publication={item.publication} />
                </Box>
              ) : "text" in item ? (
                <Text>{item.text}</Text>
              ) : "markdown" in item ? (
                <Markdown>{item.markdown}</Markdown>
              ) : "yaml" in item ? (
                <Code whiteSpace="pre" width="100%" overflow="auto" p={2}>
                  {item.yaml}
                </Code>
              ) : "notebook" in item ? (
                <Box height="600px">
                  <NotebookView notebook={item.notebook} />
                </Box>
              ) : (
                ""
              )}
            </Box>
          ))}
        </>
      ) : (
        ""
      )}
    </>
  )
}

export default ProjectShowcase
