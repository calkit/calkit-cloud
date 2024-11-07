import {
  Button,
  FormControl,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  Input,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
} from "@chakra-ui/react"

interface saveFilesProps {
  isOpen: boolean
  onClose: () => void
}

const SaveFiles = ({ isOpen, onClose }: saveFilesProps) => {
  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size={{ base: "sm", md: "md" }}
        isCentered
      >
        <ModalOverlay />
        <ModalContent as="form" onSubmit={console.log("submitting")}>
          <ModalHeader>Save uncommitted file changes</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={4}>
            <FormControl isRequired mb={2}>
              <FormLabel htmlFor="name">Commit Message</FormLabel>
              <Input id="name" placeholder="Ex: Update test.py" />
            </FormControl>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="primary" type="submit">
              Save
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default SaveFiles
