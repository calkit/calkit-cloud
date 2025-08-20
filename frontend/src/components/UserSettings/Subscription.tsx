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
    const monthlyPrice = price / period
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

        {/* Current Subscription Status */}
        <Card mb={6}>
          <CardHeader>
            <Flex justify="space-between" align="center">
              <Heading size="sm">Current Plan</Heading>
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
                    <Text fontWeight="semibold">Paid Until:</Text>
                    <Text>
                      {currentSubscription.paid_until
                        ? formatTimestamp(currentSubscription.paid_until)
                        : "N/A"}
                    </Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontWeight="semibold">Billing Cycle:</Text>
                    <Text>
                      {currentSubscription.period_months === 1
                        ? "Monthly"
                        : "Annual"}
                    </Text>
                  </Flex>
                </>
              )}
              <Flex justify="space-between">
                <Text fontWeight="semibold">Private Projects:</Text>
                <Text>
                  {currentPlan?.private_projects_limit === null
                    ? "Unlimited"
                    : currentPlan?.private_projects_limit || "0"}
                </Text>
              </Flex>
              <Flex justify="space-between">
                <Text fontWeight="semibold">Storage Limit:</Text>
                <Text>
                  {currentPlan
                    ? `${(currentPlan.storage_limit / (1024 * 1024 * 1024)).toFixed(1)} GB`
                    : "N/A"}
                </Text>
              </Flex>
            </Stack>

            {(!currentSubscription ||
              currentSubscription.plan_name === "free") && (
              <Button colorScheme="blue" mt={4} onClick={onOpen} size="sm">
                Upgrade Plan
              </Button>
            )}
          </CardBody>
        </Card>

        {/* Available Plans */}
        <Heading size="sm" mb={4}>
          Available Plans
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
          {plans.map((plan: SubscriptionPlan) => (
            <Card
              key={plan.id}
              border={
                plan.name === currentSubscription?.plan_name
                  ? "2px solid"
                  : "1px solid"
              }
              borderColor={
                plan.name === currentSubscription?.plan_name
                  ? "blue.500"
                  : "gray.200"
              }
            >
              <CardHeader>
                <Flex justify="space-between" align="center">
                  <Heading size="sm" textTransform="capitalize">
                    {plan.name}
                  </Heading>
                  {plan.name === currentSubscription?.plan_name && (
                    <Badge colorScheme="blue">Current</Badge>
                  )}
                </Flex>
              </CardHeader>
              <CardBody>
                <Stack spacing={3}>
                  <Text fontSize="2xl" fontWeight="bold">
                    {plan.price === 0 ? "Free" : `$${plan.price}`}
                    {plan.price > 0 && (
                      <Text as="span" fontSize="sm" color="gray.500">
                        /month
                      </Text>
                    )}
                  </Text>

                  <Divider />

                  <Text>
                    <strong>Private Projects:</strong>{" "}
                    {plan.private_projects_limit === null
                      ? "Unlimited"
                      : plan.private_projects_limit}
                  </Text>
                  <Text>
                    <strong>Storage:</strong>{" "}
                    {(plan.storage_limit / (1024 * 1024 * 1024)).toFixed(1)} GB
                  </Text>

                  {plan.annual_discount_factor && (
                    <Text fontSize="sm" color="green.500">
                      Save {Math.round((1 - plan.annual_discount_factor) * 100)}
                      % with annual billing
                    </Text>
                  )}
                </Stack>
              </CardBody>
            </Card>
          ))}
        </SimpleGrid>
      </Container>

      {/* Upgrade Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Upgrade Subscription</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={4}>
              <FormControl>
                <FormLabel>Select Plan</FormLabel>
                <Select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                >
                  {plans
                    .filter((plan: SubscriptionPlan) => plan.name !== "free")
                    .map((plan: SubscriptionPlan) => (
                      <option key={plan.id} value={plan.name}>
                        {plan.name} - ${plan.price}/month
                      </option>
                    ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Billing Period</FormLabel>
                <Select
                  value={selectedPeriod}
                  onChange={(e) =>
                    setSelectedPeriod(e.target.value as "monthly" | "annual")
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual (Save money)</option>
                </Select>
              </FormControl>

              <Alert status="info">
                <AlertIcon />
                <Box>
                  <AlertTitle>Billing Information</AlertTitle>
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
              colorScheme="blue"
              onClick={handleUpgrade}
              isLoading={subscriptionMutation.isPending}
            >
              Proceed to Payment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

export default Subscription
