import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Text,
  Badge,
  Card,
  CardBody,
  CardHeader,
  SimpleGrid,
  Stack,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Select,
  FormControl,
  FormLabel,
} from "@chakra-ui/react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import {
  type ApiError,
  type SubscriptionUpdate,
  type UserSubscription,
  type SubscriptionPlan,
  UsersService,
  MiscService,
} from "../../client"
import useAuth from "../../hooks/useAuth"
import useCustomToast from "../../hooks/useCustomToast"
import { handleError, formatTimestamp } from "../../utils"

const Subscription = () => {
  const queryClient = useQueryClient()
  const showToast = useCustomToast()
  const { user: currentUser } = useAuth()
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [selectedPlan, setSelectedPlan] = useState<string>("standard")
  const [selectedPeriod, setSelectedPeriod] = useState<"monthly" | "annual">(
    "monthly",
  )

  // Fetch available subscription plans
  const plansQuery = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => MiscService.getSubscriptionPlans(),
  })

  // Current subscription from user data
  const currentSubscription = currentUser?.subscription

  // Mutation for creating/updating subscription
  const subscriptionMutation = useMutation({
    mutationFn: async (data: SubscriptionUpdate) => {
      if (currentSubscription) {
        const result = await UsersService.putUserSubscription({
          requestBody: data,
        })
        return result
      } else {
        const result = await UsersService.postUserSubscription({
          requestBody: data,
        })
        // Extract the subscription from the NewSubscriptionResponse
        return result.subscription as UserSubscription
      }
    },
    onSuccess: () => {
      showToast("Success!", "Subscription updated successfully.", "success")
      onClose()
    },
    onError: (err: ApiError) => {
      handleError(err, showToast)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "me"] })
    },
  })

  const handleUpgrade = () => {
    subscriptionMutation.mutate({
      plan_name: selectedPlan as "free" | "standard" | "professional",
      period: selectedPeriod,
    })
  }

  const formatPrice = (price: number, period: number) => {
    if (price === 0) return "Free"
    const monthlyPrice = price
    return period === 1
      ? `$${monthlyPrice}/month`
      : `$${monthlyPrice}/month (billed annually)`
  }

  const getStatusColor = (
    subscription: UserSubscription | null | undefined,
  ) => {
    if (!subscription || subscription.plan_name === "free") return "gray"
    if (!subscription.is_active) return "red"
    return "green"
  }

  const getStatusText = (subscription: UserSubscription | null | undefined) => {
    if (!subscription || subscription.plan_name === "free") return "Free Plan"
    if (!subscription.is_active) return "Inactive"
    return "Active"
  }

  if (plansQuery.isLoading) {
    return (
      <Container maxW="full">
        <Flex justify="center" align="center" height="200px">
          <Spinner size="lg" />
        </Flex>
      </Container>
    )
  }

  if (plansQuery.error) {
    return (
      <Container maxW="full">
        <Alert status="error">
          <AlertIcon />
          <AlertTitle>Error loading subscription plans</AlertTitle>
          <AlertDescription>
            Unable to load subscription information. Please try again later.
          </AlertDescription>
        </Alert>
      </Container>
    )
  }

  const plans = plansQuery.data || []
  const currentPlan =
    plans.find(
      (plan: SubscriptionPlan) => plan.name === currentSubscription?.plan_name,
    ) || plans.find((plan: SubscriptionPlan) => plan.name === "free")

  return (
    <>
      <Container maxW="full">
        <Heading size="md" py={4}>
          Subscription
        </Heading>
        {/* Current subscription status */}
        <Card mb={6}>
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Heading size="sm">Current plan</Heading>
              <Badge colorScheme={getStatusColor(currentSubscription)}>
                {getStatusText(currentSubscription)}
              </Badge>
            </Flex>
          </CardHeader>
          <CardBody>
            <Stack spacing={3}>
              <Flex justify="space-between">
                <Text fontWeight="semibold">Plan:</Text>
                <Text>{currentPlan?.name || "Free"}</Text>
              </Flex>
              <Flex justify="space-between">
                <Text fontWeight="semibold">Price:</Text>
                <Text>
                  {currentSubscription
                    ? formatPrice(
                        currentSubscription.price,
                        currentSubscription.period_months,
                      )
                    : "Free"}
                </Text>
              </Flex>
              {currentSubscription && (
                <>
                  <Flex justify="space-between">
                    <Text fontWeight="semibold">Paid until:</Text>
                    <Text>
                      {currentSubscription.paid_until
                        ? formatTimestamp(currentSubscription.paid_until)
                        : "N/A"}
                    </Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontWeight="semibold">Billing cycle:</Text>
                    <Text>
                      {currentSubscription.period_months === 1
                        ? "Monthly"
                        : "Annual"}
                    </Text>
                  </Flex>
                </>
              )}
              <Flex justify="space-between">
                <Text fontWeight="semibold">Private projects:</Text>
                <Text>
                  {currentPlan?.private_projects_limit === null
                    ? "Unlimited"
                    : currentPlan?.private_projects_limit || "0"}
                </Text>
              </Flex>
              <Flex justify="space-between">
                <Text fontWeight="semibold">Storage limit:</Text>
                <Text>
                  {currentPlan
                    ? `${currentPlan.storage_limit.toFixed(0)} GB`
                    : "N/A"}
                </Text>
              </Flex>
            </Stack>
            {/* Change plan button */}
            <Button variant={"primary"} mt={4} onClick={onOpen} size="sm">
              Change plan
            </Button>
          </CardBody>
        </Card>
      </Container>

      {/* Upgrade modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Change subscription</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl>
                <FormLabel>Select plan</FormLabel>
                <Select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                >
                  {plans
                    .filter((plan: SubscriptionPlan) => plan.name !== "free")
                    .map((plan: SubscriptionPlan) => (
                      <option key={plan.id} value={plan.name}>
                        {plan.name}: ${plan.price}/month
                      </option>
                    ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Billing period</FormLabel>
                <Select
                  value={selectedPeriod}
                  onChange={(e) =>
                    setSelectedPeriod(e.target.value as "monthly" | "annual")
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual (save TODO%)</option>
                </Select>
              </FormControl>

              <Alert status="info">
                <AlertIcon />
                <Box>
                  <AlertTitle>Billing information</AlertTitle>
                  <AlertDescription>
                    You will be redirected to our secure payment processor to
                    complete your subscription.
                  </AlertDescription>
                </Box>
              </Alert>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant={"primary"}
              onClick={handleUpgrade}
              isLoading={subscriptionMutation.isPending}
            >
              Proceed to payment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default Subscription
