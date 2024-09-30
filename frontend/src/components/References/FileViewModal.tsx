import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  Box,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react"

import { type ReferenceEntry } from "../../client"

interface FileViewProps {
  isOpen: boolean
  onClose: () => void
  entry?: ReferenceEntry
}

const FileViewModal = ({ isOpen, onClose, entry }: FileViewProps) => {
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={{ base: "xl", md: "xxl" }}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{entry?.file_path}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6} px={20}>
            <Box height="80vh">
              <object
                title="content"
                data={String(entry?.url)}
                type="application/pdf"
                width="100%"
                height="100%"
              />
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  )
}

export default FileViewModal
