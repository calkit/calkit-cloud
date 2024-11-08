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
  Checkbox,
  Flex,
  Text,
  Heading,
} from "@chakra-ui/react"

interface saveFilesProps {
  isOpen: boolean
  onClose: () => void
  changedFiles: string[]
  stagedFiles: string[]
}

const SaveFiles = ({
  isOpen,
  onClose,
  changedFiles,
  stagedFiles,
}: saveFilesProps) => {
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
            <Flex alignItems="center">
              <Checkbox />
              <Heading ml={1} size="sm">
                Selected files
              </Heading>
            </Flex>
            {changedFiles.map((fpath: string) => (
              <Flex key={fpath} alignItems="center">
                <Checkbox>
                  <Text color="red.500" mr={1}>
                    {fpath}
                  </Text>
                </Checkbox>
              </Flex>
            ))}
            <FormControl isRequired mb={2}>
              <FormLabel htmlFor="name">Commit message</FormLabel>
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
