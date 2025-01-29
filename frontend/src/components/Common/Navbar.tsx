import type { ComponentType, ElementType } from "react"

import { Button, Flex, Icon, useDisclosure } from "@chakra-ui/react"
import { FaPlus } from "react-icons/fa"

interface NavbarProps {
  type: string
  addModalAs: ComponentType | ElementType
  verb?: string
}

const Navbar = ({ type, addModalAs, verb }: NavbarProps) => {
  const addModal = useDisclosure()

  const AddModal = addModalAs
  return (
    <>
      <Flex py={4} gap={4}>
        <Button
          variant="primary"
          gap={1}
          fontSize={{ base: "sm", md: "inherit" }}
          onClick={addModal.onOpen}
        >
          <Icon as={FaPlus} /> {verb ? verb : "Add"} {type}
        </Button>
        <AddModal isOpen={addModal.isOpen} onClose={addModal.onClose} />
      </Flex>
    </>
  )
}

export default Navbar
