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
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Input,
  IconButton,
} from "@chakra-ui/react"
import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { MdCancel, MdCheck } from "react-icons/md"
import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"

import useAuth, { isLoggedIn } from "../hooks/useAuth"
import Topbar from "../components/Common/Topbar"
import {
  MiscService,
  type SubscriptionUpdate,
  type UserPublic,
  UsersService,
} from "../client"

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
  const [teamSize, setTeamSize] = useState(5)
  const navigate = useNavigate()
  // TODO: These plans should probably come from the back end
  const plans = [
    { name: "Free", price: null, privateProjects: 1, storageGb: 1 },
    { name: "Standard", price: 10, privateProjects: 2, storageGb: 10 },
    {
      name: "Professional",
      price: 50,
      privateProjects: "Unlimited",
      storageGb: 500,
    },
  ]
  const annualDiscount = 0.9
  const preferredPlanName = "Standard"
  const getPriceUnits = () => {
    if (team) {
      return "/user/mo"
    }
    return "/mo"
  }
  const getPlans = () => {
    if (team) {
      return plans.filter((plan) => plan.name !== "Free")
    }
    return plans
  }
  const [discountCode, setDiscountCode] = useState<string>("")
  const [discountQueryEnabled, setDiscountQueryEnabled] = useBoolean(false)
  const discountCodeCheckQuery = useQuery({
    queryKey: ["discount-codes", discountCode, team, teamSize],
    queryFn: () =>
      MiscService.getDiscountCode({
        discountCode,
        nUsers: team ? teamSize : 1,
      }),
    enabled:
      Boolean(discountCode) && discountQueryEnabled && discountCodeVisible,
    retry: 1,
  })
  const queryClient = useQueryClient()
  const calcPrice = (price: number | null, planName: string) => {
    const discountedPrice = discountCodeCheckQuery.data?.price
    const discountedPlanName = discountCodeCheckQuery.data?.plan_name
    if (planName.toLowerCase() === discountedPlanName) {
      return discountedPrice
    }
    if (!price) {
      return price
    }
    if (annual) {
      return price * annualDiscount
    }
    return price
  }
  const userSubscriptionMutation = useMutation({
    mutationFn: (data: SubscriptionUpdate) =>
      UsersService.postUserSubscription({ requestBody: data }),
    onSuccess: (data) => {
      if (data.stripe_session_client_secret) {
        navigate({
          to: "/checkout",
          search: { client_secret: data.stripe_session_client_secret },
        })
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
    },
  })
  type PlanName = "free" | "standard" | "professional"
  const handleSubmit = (planName: string) => {
    if (!team) {
      userSubscriptionMutation.mutate({
        plan_name: planName as PlanName,
        period: annual ? "annual" : "monthly",
        discount_code: discountCode ? discountCode : null,
      })
    }
    // TODO: Handle team subscription
  }

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
          <Text mr={1}>Monthly</Text>
          <Switch
            isChecked={annual}
            onChange={setAnnual.toggle}
            mr={1}
            colorScheme="green"
          />
          <Text mr={6}>Annual</Text>
          <Text mr={1}>Individual</Text>
          <Switch
            mr={1}
            isChecked={team}
            onChange={setTeam.toggle}
            colorScheme="blue"
          />
          <Text>Team</Text>
        </Flex>
        {team ? (
          <Flex mb={4} justify={"center"} align={"center"}>
            <Text mr={2}>GitHub org name:</Text>
            <Input width="150px" placeholder="Ex: my-lab" mr={2} />
            <Text mr={2}>Team size:</Text>
            <NumberInput
              defaultValue={5}
              min={2}
              max={50}
              width={"75px"}
              value={teamSize}
              onChange={(valueString) => setTeamSize(Number(valueString))}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </Flex>
        ) : (
          ""
        )}
        <Box mb={4}>
          <SimpleGrid spacing={4} columns={team ? 2 : 3}>
            {/* Cards for each plan */}
            {getPlans().map((plan) => (
              <Card
                align={"center"}
                key={plan.name}
                borderWidth={plan.name === preferredPlanName ? 2 : 0}
                borderColor={"green.500"}
              >
                <CardHeader>
                  <Heading size="md">
                    {plan.name}
                    {plan.price
                      ? `: $${calcPrice(plan.price, plan.name)}${getPriceUnits()}`
                      : ""}
                  </Heading>
                </CardHeader>
                <CardBody>
                  <UnorderedList>
                    <ListItem>Unlimited collaborators</ListItem>
                    <ListItem>Unlimited public projects</ListItem>
                    <ListItem>
                      {plan.privateProjects} private project
                      {typeof plan.privateProjects === "string" ||
                      plan.privateProjects > 1
                        ? "s"
                        : ""}
                      {team ? "/user" : ""}
                    </ListItem>
                    <ListItem>
                      {plan.storageGb} GB storage{team ? "/user" : ""}
                    </ListItem>
                  </UnorderedList>
                </CardBody>
                <CardFooter>
                  <Button
                    variant={
                      plan.name === preferredPlanName ? "primary" : undefined
                    }
                    isLoading={userSubscriptionMutation.isPending}
                    onClick={() => handleSubmit(plan.name.toLowerCase())}
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
                    <Input
                      value={discountCode}
                      onChange={({ target }) => setDiscountCode(target.value)}
                      placeholder="Enter discount code here"
                      isDisabled={
                        discountCodeCheckQuery.isLoading ||
                        discountCodeCheckQuery.data?.is_valid
                      }
                    />
                    <IconButton
                      aria-label="apply"
                      icon={<MdCheck />}
                      bg="none"
                      size={"s"}
                      p={1}
                      mx={1}
                      isDisabled={
                        !discountCode || discountCodeCheckQuery.data?.is_valid
                      }
                      isLoading={discountCodeCheckQuery.isLoading}
                      onClick={() => setDiscountQueryEnabled.on()}
                    />
                    <IconButton
                      aria-label="cancel"
                      icon={<MdCancel />}
                      bg="none"
                      size={"s"}
                      onClick={() => {
                        setDiscountCodeVisible.toggle()
                        setDiscountQueryEnabled.off()
                        queryClient.resetQueries({
                          queryKey: ["discount-codes"],
                        })
                        setDiscountCode("")
                      }}
                    />
                  </Flex>
                  {discountCodeCheckQuery.error ? (
                    <Text mt={1} color={"red"} fontSize="sm">
                      Discount code invalid.
                    </Text>
                  ) : (
                    ""
                  )}
                  {discountCodeCheckQuery.data?.is_valid ? (
                    <Text mt={1} color={"green.500"} fontSize="sm">
                      Discount code applied! (
                      {discountCodeCheckQuery.data.n_users} user
                      {discountCodeCheckQuery.data.n_users &&
                      discountCodeCheckQuery.data.n_users > 1
                        ? "s"
                        : ""}{" "}
                      for {discountCodeCheckQuery.data.months} months @ $
                      {discountCodeCheckQuery.data.price}/mo)
                    </Text>
                  ) : (
                    <>
                      {discountCodeCheckQuery.data?.reason ? (
                        <Text mt={1} color={"red"} fontSize="sm">
                          Discount code invalid.{" "}
                          {discountCodeCheckQuery.data?.reason}
                        </Text>
                      ) : (
                        ""
                      )}
                    </>
                  )}
                </>
              ) : (
                <Link onClick={setDiscountCodeVisible.toggle}>
                  <Text>Have a discount code? Click here.</Text>
                </Link>
              )}
            </Box>
            <Box mt={2} textAlign={"center"}>
              <Link
                href="mailto:sales@calkit.io?subject=Calkit enterprise license"
                isExternal
              >
                <Text fontSize="sm">
                  Looking for enterprise, on prem? Email us.
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
