import {
  Code,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react"

import { Environment } from "../../client"

interface ViewEnvProps {
  environment: Environment
  isOpen: boolean
  onClose: () => void
}

const ViewEnvironment = ({ environment, isOpen, onClose }: ViewEnvProps) => {
  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="full" isCentered>
        <ModalOverlay />
        <ModalContent overflow="auto" alignItems="center">
          <ModalHeader>
            View environment: <Code fontSize="large">{environment.name}</Code>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Code
              whiteSpace="pre"
              overflow="auto"
              p={2}
              height="87vh"
              width="800px"
            >
              {environment.file_content}
            </Code>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  )
}

export default ViewEnvironment
