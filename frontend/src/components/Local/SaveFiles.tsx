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
  useDisclosure,
} from "@chakra-ui/react"

interface saveFilesProps {
  paths: Array<string>
}

const SaveFiles = ({ paths }: saveFilesProps) => {
  const saveFilesModal = useDisclosure()
  const discardModal = useDisclosure()
  return (
    <>
      <Button
        size="xs"
        variant="primary"
        ml={1}
        onClick={saveFilesModal.onOpen}
      >
        Save
      </Button>
      <Button size="xs" variant="danger" ml={1} onClick={discardModal.onOpen}>
        Discard
      </Button>

      <Modal
        isOpen={saveFilesModal.isOpen}
        onClose={saveFilesModal.onClose}
        size={{ base: "sm", md: "md" }}
        isCentered
      >
        <ModalOverlay />
        <ModalContent as="form" onSubmit={() => console.log("submitting")}>
          <ModalHeader>Save uncommitted file changes</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={4}>
            <FormControl isRequired mb={2}>
              <FormLabel htmlFor="name">Commit message</FormLabel>
              <Input id="name" placeholder="Ex: Update test.py" />
            </FormControl>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="primary" type="submit">
              Save
            </Button>
            <Button onClick={saveFilesModal.onClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default SaveFiles
