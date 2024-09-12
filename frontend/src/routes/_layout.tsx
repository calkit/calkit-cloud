import {
  Flex,
  Spinner,
  Box,
  Container,
  Text,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Heading,
  UnorderedList,
  ListItem,
  Link,
  Switch,
  useBoolean,
  FormControl,
  Textarea,
  Input,
  IconButton,
} from "@chakra-ui/react"
import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import useAuth, { isLoggedIn } from "../hooks/useAuth"
import Topbar from "../components/Common/Topbar"
import { type UserPublic } from "../client"
import { MdCancel, MdCheck } from "react-icons/md"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

interface PickSubscriptionProps {
  user?: UserPublic | null
}

function PickSubscription({ user }: PickSubscriptionProps) {
  const [annual, setAnnual] = useBoolean(false)
  const [team, setTeam] = useBoolean(false)
  const [discountCodeVisible, setDiscountCodeVisible] = useBoolean(false)
  // TODO: These plans should probably come from the back end
  const plans = [
    { name: "Free", price: null, privateProjects: 1, storageGb: 1 },
    { name: "Standard", price: 10, privateProjects: 2, storageGb: 10 },
    { name: "Professional", price: 50, privateProjects: 10, storageGb: 100 },
  ]
  const annualDiscount = 0.9
  const calcPrice = (price: number | null) => {
    if (!price) {
      return price
    }
    if (annual) {
      return price * annualDiscount
    }
    return price
  }
  const preferredPlanName = "Standard"

  return (
    <Flex
      alignItems={"center"}
      alignContent={"center"}
      justifyContent={"center"}
      height={"100vh"}
      width={"full"}
    >
      <Box>
        <Flex justify={"center"}>
          <Heading size="lg" mb={4}>
            Choose your plan, {user?.github_username}:
          </Heading>
        </Flex>
        <Flex mb={4} align={"center"} justify={"center"} alignItems={"center"}>
          <Text mr={1}>Monthly/annual</Text>
          <Switch
            isChecked={annual}
            onChange={setAnnual.toggle}
            mr={4}
            colorScheme="green"
          />
          <Text mr={1}>Individual/team</Text>
          <Switch
            isChecked={team}
            onChange={setTeam.toggle}
            colorScheme="blue"
          />
        </Flex>
        <Box mb={4}>
          <SimpleGrid spacing={4} columns={3}>
            {/* Cards for each plan */}
            {plans.map((plan) => (
              <Card
                align={"center"}
                key={plan.name}
                borderWidth={plan.name === preferredPlanName ? 2 : 0}
                borderColor={"green.500"}
              >
                <CardHeader>
                  <Heading size="md">
                    {plan.name}
                    {plan.price ? `: $${calcPrice(plan.price)}/mo` : ""}
                  </Heading>
                </CardHeader>
                <CardBody>
                  <UnorderedList>
                    <ListItem>Unlimited collaborators</ListItem>
                    <ListItem>Unlimited public projects</ListItem>
                    <ListItem>
                      {plan.privateProjects} private project
                      {plan.privateProjects > 1 ? "s" : ""}
                    </ListItem>
                    <ListItem>{plan.storageGb} GB storage</ListItem>
                  </UnorderedList>
                </CardBody>
                <CardFooter>
                  <Button
                    variant={
                      plan.name === preferredPlanName ? "primary" : undefined
                    }
                  >
                    {plan.name === preferredPlanName ? "🚀 " : ""}Let's go!
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </SimpleGrid>
        </Box>
        <Flex justifyItems={"center"} justifyContent="center" width={"100%"}>
          <Box>
            <Box textAlign={"center"}>
              {discountCodeVisible ? (
                <>
                  <Flex align={"center"}>
                    <Input placeholder="Enter discount code here" />
                    <IconButton
                      aria-label="apply"
                      icon={<MdCheck />}
                      bg="none"
                      size={"s"}
                      p={1}
                      ml={1}
                    />
                    <IconButton
                      aria-label="cancel"
                      icon={<MdCancel />}
                      bg="none"
                      size={"s"}
                      p={1}
                      onClick={setDiscountCodeVisible.toggle}
                    />
                  </Flex>
                </>
              ) : (
                <Link onClick={setDiscountCodeVisible.toggle}>
                  <Text>Have a discount code? Click here.</Text>
                </Link>
              )}
            </Box>
            <Box mt={2}>
              <Link>
                <Text fontSize="sm">
                  Looking for enterprise, on prem? Click here.
                </Text>
              </Link>
            </Box>
          </Box>
        </Flex>
      </Box>
    </Flex>
  )
}

function Layout() {
  const { isLoading, user } = useAuth()

  return (
    <Box>
      {isLoading ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <>
          {/* If the user doesn't have a subscription, they need to pick one */}
          {user?.subscription ? (
            <Box>
              <Topbar />
              <Container px={0} maxW="full">
                <Outlet />
              </Container>
            </Box>
          ) : (
            <PickSubscription user={user} />
          )}
        </>
      )}
    </Box>
  )
}
