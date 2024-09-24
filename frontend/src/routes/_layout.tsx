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
import mixpanel from "mixpanel-browser"

import useAuth, { isLoggedIn } from "../hooks/useAuth"
import Topbar from "../components/Common/Topbar"
import {
  type ApiError,
  MiscService,
  type SubscriptionUpdate,
  type OrgSubscriptionUpdate,
  type UserPublic,
  UsersService,
  OrgsService,
} from "../client"
import { handleError } from "../utils"
import useCustomToast from "../hooks/useCustomToast"

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
  const [orgName, setOrgName] = useState("")
  const navigate = useNavigate()
  // TODO: These plans should probably come from the back end
  const plans = [
    { name: "Free", price: null, privateProjects: 1, storageGb: 1 },
    { name: "Standard", price: 10, privateProjects: 2, storageGb: 50 },
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
  const showToast = useCustomToast()
  const subscriptionMutation = useMutation({
    mutationFn: (data: SubscriptionUpdate | OrgSubscriptionUpdate) => {
      mixpanel.track("Clicked subscription option", {
        team: team,
        plan_name: data.plan_name,
        period: data.period,
      })
      if (team && "n_users" in data) {
        return OrgsService.postOrgSubscription({ requestBody: data, orgName })
      }
      return UsersService.postUserSubscription({ requestBody: data })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
      if (data.stripe_session_client_secret) {
        navigate({
          to: "/checkout",
          search: { client_secret: data.stripe_session_client_secret },
        })
      }
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
  })
  type PlanName = "free" | "standard" | "professional"
  const handleSubmit = (planName: string) => {
    if (!team) {
      subscriptionMutation.mutate({
        plan_name: planName as PlanName,
        period: annual ? "annual" : "monthly",
        discount_code: discountCode ? discountCode : null,
      })
    } else {
      subscriptionMutation.mutate({
        plan_name: planName as PlanName,
        period: annual ? "annual" : "monthly",
        discount_code: discountCode ? discountCode : null,
        n_users: teamSize,
      } as OrgSubscriptionUpdate)
    }
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
            <Input
              width="150px"
              placeholder="Ex: my-lab"
              mr={2}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
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
                    isLoading={subscriptionMutation.isPending}
                    onClick={() => handleSubmit(plan.name.toLowerCase())}
                    isDisabled={team && !orgName}
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

function InstallGitHubApp() {
  const appNameBase = "calkit"
  const apiUrl = String(import.meta.env.VITE_API_URL)
  const getAppName = () => {
    if (apiUrl.includes("localhost")) {
      return appNameBase + "-dev"
    }
    if (apiUrl.includes("staging")) {
      return appNameBase + "-staging"
    }
    return appNameBase
  }
  return (
    <>
      <Flex height="100vh" width="full" justify="center" align="center">
        <Link
          href={`https://github.com/apps/${getAppName()}/installations/new`}
        >
          <Button variant={"primary"}>Add the Calkit app to GitHub</Button>
        </Link>
      </Flex>
    </>
  )
}

function Layout() {
  const { isLoading, user, logout } = useAuth()
  if (user) {
    mixpanel.identify(user.id)
    mixpanel.people.set({
      $name: user.full_name,
      $email: user.email,
      $github_username: user.github_username,
      $plan_name: user.subscription?.plan_name,
    })
  } else if (!isLoading && !user) {
    logout()
  }
  const ghAppInstalledQuery = useQuery({
    queryKey: ["user", "github-app-installations"],
    queryFn: () => UsersService.getUserGithubAppInstallations(),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
  const appNameBase = "calkit"
  const apiUrl = String(import.meta.env.VITE_API_URL)
  const getAppName = () => {
    if (apiUrl.includes("localhost")) {
      return appNameBase + "-dev"
    }
    if (apiUrl.includes("staging")) {
      return appNameBase + "-staging"
    }
    return appNameBase
  }
  if (ghAppInstalledQuery.data && ghAppInstalledQuery.data?.total_count < 1) {
    location.href = `https://github.com/apps/${getAppName()}/installations/new`
  }

  return (
    <Box>
      {isLoading || ghAppInstalledQuery.isPending ? (
        <Flex justify="center" align="center" height="100vh" width="full">
          <Spinner size="xl" color="ui.main" />
        </Flex>
      ) : (
        <>
          {!ghAppInstalledQuery.data?.total_count ? (
            <InstallGitHubApp />
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
        </>
      )}
    </Box>
  )
}
