import { Text } from "@chakra-ui/react"

interface ProjectShowcaseProps {
  ownerName: string
  projectName: string
}

function ProjectShowcase({ ownerName, projectName }: ProjectShowcaseProps) {
  return (
    <>
      <Text>
        Showcase for {ownerName}/{projectName}
      </Text>
    </>
  )
}

export default ProjectShowcase
